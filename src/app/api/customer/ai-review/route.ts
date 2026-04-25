/**
 * Customer-facing AI review inbox.
 *
 * When the AI/operator finds missing or unclear fields in the customer's
 * submitted data, the djp_submission_queue row is parked in DATA_REVIEW and
 * the flagged fields are written to `review_summary.ai_flagged_fields`.
 * The customer fixes them on /tax/billing; on submit the row advances to
 * PENDING_APPROVAL so the operator can re-check.
 *
 * GET    → list flagged items for the logged-in customer
 * POST   → { queueItemId, updatedFields } → merge corrections, clear flags,
 *          transition to PENDING_APPROVAL
 *
 * Shape of review_summary:
 * {
 *   ai_flagged_fields: [
 *     { key: 'gross_income', label: '급여 총액', reason: '...', currentValue: '...' }
 *   ],
 *   customer_submitted_data: { key: value },   // AI-captured snapshot
 *   customer_corrections:    { key: value },   // customer updates (history)
 *   last_customer_response_at: ISO string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { customerOperation } from '@/middleware/compose';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

interface FlaggedField {
  key: string;
  label: string;
  reason: string;
  currentValue?: string | number | null;
  suggestedValue?: string | number | null;
  inputType?: 'text' | 'number' | 'date';
}

interface ReviewSummary {
  ai_flagged_fields?: FlaggedField[];
  customer_submitted_data?: Record<string, unknown>;
  customer_corrections?: Record<string, unknown>;
  last_customer_response_at?: string;
}

interface QueueRow {
  id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number;
  status: string;
  review_summary: ReviewSummary | null;
  counterparty_name: string | null;
  created_at: string;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  try {
    const admin = getSupabaseAdmin();
    const { data: customer } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', req.session.userId)
      .single();
    if (!customer) {
      return NextResponse.json({ error: 'Customer record not found' }, { status: 404 });
    }

    const { data } = await admin
      .from('djp_submission_queue')
      .select(
        'id, tax_type, tax_period_month, tax_period_year, amount, status, review_summary, counterparty_name, created_at',
      )
      .eq('customer_id', customer.id)
      .eq('status', 'DATA_REVIEW')
      .order('created_at', { ascending: false });

    const rows = ((data ?? []) as QueueRow[])
      .filter((r) => {
        const flagged = r.review_summary?.ai_flagged_fields;
        return Array.isArray(flagged) && flagged.length > 0;
      })
      .map((r) => ({
        id: r.id,
        taxType: r.tax_type,
        period: `${r.tax_period_year}-${String(r.tax_period_month).padStart(2, '0')}`,
        amount: Number(r.amount),
        counterpartyName: r.counterparty_name,
        flaggedFields: r.review_summary?.ai_flagged_fields ?? [],
        submittedData: r.review_summary?.customer_submitted_data ?? {},
      }));

    return NextResponse.json({ success: true, data: { items: rows } });
  } catch (err) {
    loggers.api.error({ err }, 'customer ai-review GET failed');
    return NextResponse.json({ error: 'Failed to load review queue' }, { status: 500 });
  }
}

const postSchema = z.object({
  queueItemId: z.string().uuid(),
  updatedFields: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { queueItemId, updatedFields } = parsed.data;
    const admin = getSupabaseAdmin();

    const { data: customer } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', req.session.userId)
      .single();
    if (!customer) {
      return NextResponse.json({ error: 'Customer record not found' }, { status: 404 });
    }

    const { data: item } = await admin
      .from('djp_submission_queue')
      .select('id, customer_id, status, review_summary')
      .eq('id', queueItemId)
      .single();
    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }
    if (item.customer_id !== customer.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (item.status !== 'DATA_REVIEW') {
      return NextResponse.json(
        { error: `Cannot respond — current status is ${item.status}` },
        { status: 409 },
      );
    }

    const prev: ReviewSummary = (item.review_summary as ReviewSummary) ?? {};
    const mergedCorrections: Record<string, unknown> = {
      ...(prev.customer_corrections ?? {}),
      ...updatedFields,
    };
    const nextSummary: ReviewSummary = {
      ...prev,
      customer_submitted_data: {
        ...(prev.customer_submitted_data ?? {}),
        ...updatedFields,
      },
      customer_corrections: mergedCorrections,
      ai_flagged_fields: [],  // cleared — operator will re-check and re-flag if needed
      last_customer_response_at: new Date().toISOString(),
    };

    const { error: updErr } = await admin
      .from('djp_submission_queue')
      .update({
        review_summary: nextSummary,
        status: 'PENDING_APPROVAL',
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueItemId);
    if (updErr) {
      loggers.api.error({ err: updErr, queueItemId }, 'ai-review update failed');
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    await admin.from('audit_log').insert({
      customer_id: customer.id,
      actor_user_id: req.session.userId,
      actor_role: 'CUSTOMER',
      activity_type: 'UPDATE',
      activity_details: {
        scope: 'CUSTOMER_AI_REVIEW_RESPOND',
        queueItemId,
        fieldKeys: Object.keys(updatedFields),
      },
      ip_address: req.headers.get('x-forwarded-for') || null,
      user_agent: req.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    loggers.api.error({ err }, 'customer ai-review POST failed');
    return NextResponse.json({ error: 'Failed to submit review response' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return customerOperation()(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return customerOperation()(request as RequestWithSession, handlePost);
}
