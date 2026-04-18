/**
 * /api/customer/funding-source
 *
 * Surfaces the user's answer to the asset-growth anomaly survey (T-003).
 * One row per (customer, snapshot_year). POST upserts by (customer_id, year).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';

const fundingKinds = [
  'SALARY', 'BUSINESS', 'INVESTMENT', 'LOAN', 'INHERITANCE', 'OTHER',
] as const;

const upsertSchema = z.object({
  snapshot_year: z.number().int().min(2000).max(2100),
  sources: z.array(z.enum(fundingKinds)),
  note: z.string().max(2000).nullable().optional(),
});

async function resolveCustomerId(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('customer')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  try {
    const { userId } = req.session;
    const customerId = await resolveCustomerId(userId);
    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customer_not_found' }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('customer_funding_source')
      .select('*')
      .eq('customer_id', customerId)
      .order('snapshot_year', { ascending: false });

    if (error) {
      loggers.api.error({ err: error, customerId }, 'funding-source fetch failed');
      return NextResponse.json({ success: false, error: 'fetch_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    loggers.api.error({ err }, 'funding-source GET exception');
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json().catch(() => null);
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'invalid_body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { userId } = req.session;
    const customerId = await resolveCustomerId(userId);
    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customer_not_found' }, { status: 404 });
    }

    const admin = getSupabaseAdmin();

    // Upsert by (customer_id, snapshot_year) — the table has a UNIQUE
    // constraint on that pair. Using onConflict keeps this idempotent.
    const { data, error } = await admin
      .from('customer_funding_source')
      .upsert(
        {
          customer_id: customerId,
          snapshot_year: parsed.data.snapshot_year,
          sources: parsed.data.sources,
          note: parsed.data.note ?? null,
        },
        { onConflict: 'customer_id,snapshot_year' },
      )
      .select('*')
      .single();

    if (error || !data) {
      loggers.api.error({ err: error, customerId }, 'funding-source upsert failed');
      return NextResponse.json({ success: false, error: 'upsert_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    loggers.api.error({ err }, 'funding-source POST exception');
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
    withAudit('FUNDING_SOURCE_UPSERT'),
  )(request as RequestWithSession, handlePost);
}
