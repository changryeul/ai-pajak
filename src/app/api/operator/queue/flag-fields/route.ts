/**
 * Operator-side endpoint for the keynote slide-21 customer-feedback loop.
 *
 *   POST /api/operator/queue/flag-fields
 *
 *   Body:
 *     {
 *       queueItemId: uuid,
 *       fields: [
 *         { key, label, reason, currentValue?, suggestedValue?, inputType? }
 *       ],
 *       submittedDataPatch?: { key: value, ... }   // optional snapshot tweak
 *     }
 *
 *   Behaviour:
 *     - Overwrites review_summary.ai_flagged_fields with the new list
 *       (empty array clears all flags).
 *     - If `fields.length > 0`, parks the queue row in DATA_REVIEW so the
 *       customer's /tax/billing surfaces the AI Review section.
 *     - Audit-logs the action for the operator.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

const OPERATOR_ROLES = [
  'TAX_OPERATOR',
  'TAX_OPERATOR_LEAD',
  'TAX_OPERATOR_SUPERVISOR',
  'TAX_OPERATOR_MASTER',
];

const fieldSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  reason: z.string().min(1).max(400),
  currentValue: z.union([z.string(), z.number(), z.null()]).optional(),
  suggestedValue: z.union([z.string(), z.number(), z.null()]).optional(),
  inputType: z.enum(['text', 'number', 'date']).optional(),
});

const bodySchema = z.object({
  queueItemId: z.string().uuid(),
  fields: z.array(fieldSchema).max(40),
  submittedDataPatch: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = getSupabaseAdmin();
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
      return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { queueItemId, fields, submittedDataPatch } = parsed.data;

    const { data: existing } = await admin
      .from('djp_submission_queue')
      .select('id, customer_id, status, review_summary')
      .eq('id', queueItemId)
      .single();
    if (!existing) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    type Summary = {
      ai_flagged_fields?: unknown;
      customer_submitted_data?: Record<string, unknown>;
      customer_corrections?: Record<string, unknown>;
      [k: string]: unknown;
    };
    const prev = (existing.review_summary as Summary | null) ?? {};
    const nextSummary: Summary = {
      ...prev,
      ai_flagged_fields: fields,
      customer_submitted_data: {
        ...(prev.customer_submitted_data ?? {}),
        ...(submittedDataPatch ?? {}),
      },
      ai_flagged_at: new Date().toISOString(),
      ai_flagged_by_user_id: user.id,
    };

    // If we have flags, park the row at DATA_REVIEW so the customer sees it.
    // If `fields` is empty (operator clears flags), keep status untouched
    // unless the row is currently DATA_REVIEW, in which case bump it forward
    // to PENDING_APPROVAL (operator decided no further customer input needed).
    const shouldUpdateStatus = fields.length === 0
      ? existing.status === 'DATA_REVIEW'
      : existing.status !== 'DATA_REVIEW';
    const nextStatus = fields.length === 0 ? 'PENDING_APPROVAL' : 'DATA_REVIEW';

    const updatePayload: Record<string, unknown> = {
      review_summary: nextSummary,
      updated_at: new Date().toISOString(),
    };
    if (shouldUpdateStatus) updatePayload.status = nextStatus;

    const { error: updErr } = await admin
      .from('djp_submission_queue')
      .update(updatePayload)
      .eq('id', queueItemId);
    if (updErr) {
      loggers.api.error({ err: updErr, queueItemId }, 'flag-fields update failed');
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    await admin.from('audit_log').insert({
      customer_id: existing.customer_id,
      actor_user_id: user.id,
      actor_role: roleRow.role,
      activity_type: 'UPDATE',
      activity_details: {
        scope: 'OPERATOR_FLAG_FIELDS',
        queueItemId,
        fieldCount: fields.length,
        statusFrom: existing.status,
        statusTo: shouldUpdateStatus ? nextStatus : existing.status,
      },
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({
      success: true,
      data: {
        queueItemId,
        status: shouldUpdateStatus ? nextStatus : existing.status,
        flaggedCount: fields.length,
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'operator flag-fields error');
    return NextResponse.json({ error: 'Failed to flag fields' }, { status: 500 });
  }
}
