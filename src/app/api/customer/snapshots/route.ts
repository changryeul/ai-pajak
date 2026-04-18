/**
 * /api/customer/snapshots
 *
 * GET  — returns all asset + liability snapshots for the authenticated
 *        customer, grouped by year with pre-computed totals + foreign totals.
 * POST — upsert one snapshot row (asset or liability). See `body` schema
 *        below. Used by the SPT 1770 asset entry UI + dashboard chart seeds.
 *
 * Authorization: requireAuth + requireRole(CUSTOMER) + withAudit.
 * All writes hit RLS-scoped tables so a customer cannot touch another
 * customer's rows even if this endpoint were compromised.
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
import { sumByYear, sumForeignByYear } from '@/lib/snapshots/trend';

const assetCategories = [
  'CASH_BANK', 'RECEIVABLE', 'INVENTORY', 'INVESTMENT',
  'VEHICLE', 'LAND', 'BUILDING', 'BUSINESS_ASSET', 'OTHER',
] as const;

const liabilityCategories = [
  'BANK_LOAN', 'CREDIT_CARD', 'PERSONAL_LOAN', 'BUSINESS_LIABILITY', 'OTHER',
] as const;

const upsertSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('asset'),
    id: z.string().uuid().optional(),
    snapshot_year: z.number().int().min(2000).max(2100),
    category: z.enum(assetCategories),
    amount_idr: z.number().nonnegative(),
    currency: z.string().length(3).default('IDR'),
    amount_original: z.number().nonnegative().nullable().optional(),
    exchange_rate: z.number().positive().nullable().optional(),
    is_foreign: z.boolean().default(false),
    label: z.string().max(200).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  }),
  z.object({
    kind: z.literal('liability'),
    id: z.string().uuid().optional(),
    snapshot_year: z.number().int().min(2000).max(2100),
    category: z.enum(liabilityCategories),
    amount_idr: z.number().nonnegative(),
    creditor_name: z.string().max(200).nullable().optional(),
    label: z.string().max(200).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  }),
]);

const deleteSchema = z.object({
  kind: z.enum(['asset', 'liability']),
  id: z.string().uuid(),
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
    const [assetsRes, liabilitiesRes] = await Promise.all([
      admin.from('asset_snapshot').select('*').eq('customer_id', customerId).order('snapshot_year'),
      admin.from('liability_snapshot').select('*').eq('customer_id', customerId).order('snapshot_year'),
    ]);

    if (assetsRes.error || liabilitiesRes.error) {
      loggers.api.error(
        { assetErr: assetsRes.error, liaErr: liabilitiesRes.error },
        'snapshot fetch failed',
      );
      return NextResponse.json({ success: false, error: 'fetch_failed' }, { status: 500 });
    }

    const assets = assetsRes.data ?? [];
    const liabilities = liabilitiesRes.data ?? [];

    return NextResponse.json({
      success: true,
      data: {
        assets,
        liabilities,
        summary: {
          assetByYear:        sumByYear(assets as { snapshot_year: number; amount_idr: number }[]),
          foreignAssetByYear: sumForeignByYear(
            assets as { snapshot_year: number; amount_idr: number; is_foreign: boolean }[],
          ),
          liabilityByYear:    sumByYear(
            liabilities as { snapshot_year: number; amount_idr: number }[],
          ),
        },
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'snapshots GET exception');
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
    const row = { ...parsed.data, customer_id: customerId };
    delete (row as { kind?: string }).kind;
    const table = parsed.data.kind === 'asset' ? 'asset_snapshot' : 'liability_snapshot';

    let result;
    if (parsed.data.id) {
      // Update — scope by customer_id so a stolen id for another customer fails silently.
      result = await admin
        .from(table)
        .update(row)
        .eq('id', parsed.data.id)
        .eq('customer_id', customerId)
        .select('*')
        .single();
    } else {
      result = await admin
        .from(table)
        .insert(row)
        .select('*')
        .single();
    }

    if (result.error || !result.data) {
      loggers.api.error({ err: result.error, customerId }, 'snapshot upsert failed');
      return NextResponse.json({ success: false, error: 'upsert_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    loggers.api.error({ err }, 'snapshots POST exception');
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

async function handleDelete(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json().catch(() => null);
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }

    const { userId } = req.session;
    const customerId = await resolveCustomerId(userId);
    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customer_not_found' }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const table = parsed.data.kind === 'asset' ? 'asset_snapshot' : 'liability_snapshot';
    const { error } = await admin
      .from(table)
      .delete()
      .eq('id', parsed.data.id)
      .eq('customer_id', customerId);

    if (error) {
      loggers.api.error({ err: error, customerId }, 'snapshot delete failed');
      return NextResponse.json({ success: false, error: 'delete_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    loggers.api.error({ err }, 'snapshots DELETE exception');
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
    withAudit('SNAPSHOT_UPSERT'),
  )(request as RequestWithSession, handlePost);
}

export async function DELETE(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
    withAudit('SNAPSHOT_DELETE'),
  )(request as RequestWithSession, handleDelete);
}
