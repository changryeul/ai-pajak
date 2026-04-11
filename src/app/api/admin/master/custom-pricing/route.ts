/**
 * Custom pricing quote CRUD — Phase K-3.3
 *
 * Master-only endpoint for registering and managing bespoke pricing quotes
 * for customers whose usage exceeds the Pro plan, or who need special
 * services (tax audit, transfer pricing, advisory).
 *
 * GET    /api/admin/master/custom-pricing
 *          → list all quotes (filtered by ?status= or ?customerId=)
 * POST   /api/admin/master/custom-pricing
 *          body: { customerId, quoteTitle, serviceType, monthlyPriceIdr?,
 *                  oneTimePriceIdr?, validUntil?, notes? }
 *          → create DRAFT quote (master then sends it to customer)
 * PATCH  /api/admin/master/custom-pricing
 *          body: { id, ...patchable fields }
 *          → update DRAFT quote, or transition status (DRAFT→SENT, SENT→CANCELED/EXPIRED)
 *
 * All operations require TAX_OPERATOR_MASTER role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';

const VALID_SERVICE_TYPES = ['CORPORATE_PLAN', 'TAX_AUDIT', 'TRANSFER_PRICING', 'ADVISORY', 'OTHER'];
const VALID_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELED'];

async function requireMaster(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const role = await resolveUserRole(supabase, userId);
  return role === 'TAX_OPERATOR_MASTER';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await requireMaster(supabase, user.id)) {
      return NextResponse.json({ error: '마스터 권한이 필요합니다' }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const customerId = url.searchParams.get('customerId');

    let query = admin
      .from('custom_pricing_quote')
      .select('*, customer:customer_id(id, full_name, company_name, customer_type)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (customerId) query = query.eq('customer_id', customerId);

    const { data, error } = await query;

    if (error) {
      loggers.api.error({ err: error }, 'Failed to list custom pricing quotes');
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    loggers.api.error({ err }, 'GET /api/admin/master/custom-pricing error');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await requireMaster(supabase, user.id)) {
      return NextResponse.json({ error: '마스터 권한이 필요합니다' }, { status: 403 });
    }

    const body = await request.json();
    const {
      customerId,
      quoteTitle,
      quoteDescription,
      serviceType,
      monthlyPriceIdr,
      oneTimePriceIdr,
      validFrom,
      validUntil,
      usageEmployees,
      usageWithholdingPerMonth,
      usagePpnPerMonth,
      notes,
    } = body;

    if (!customerId || !quoteTitle) {
      return NextResponse.json(
        { error: 'customerId와 quoteTitle은 필수입니다' },
        { status: 400 }
      );
    }

    const svcType = serviceType || 'CORPORATE_PLAN';
    if (!VALID_SERVICE_TYPES.includes(svcType)) {
      return NextResponse.json(
        { error: `serviceType must be one of: ${VALID_SERVICE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (monthlyPriceIdr == null && oneTimePriceIdr == null) {
      return NextResponse.json(
        { error: 'monthlyPriceIdr 또는 oneTimePriceIdr 중 하나는 필수입니다' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from('custom_pricing_quote')
      .insert({
        customer_id: customerId,
        quote_title: quoteTitle,
        quote_description: quoteDescription || null,
        service_type: svcType,
        monthly_price_idr: monthlyPriceIdr ?? null,
        one_time_price_idr: oneTimePriceIdr ?? null,
        valid_from: validFrom || new Date().toISOString().slice(0, 10),
        valid_until: validUntil || null,
        usage_employees: usageEmployees ?? null,
        usage_withholding_per_month: usageWithholdingPerMonth ?? null,
        usage_ppn_per_month: usagePpnPerMonth ?? null,
        status: 'DRAFT',
        created_by_user_id: user.id,
        notes: notes || null,
      })
      .select()
      .single();

    if (error || !data) {
      loggers.api.error({ err: error }, 'Failed to create custom pricing quote');
      return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
    }

    loggers.api.info(
      { quoteId: data.id, customerId, serviceType: svcType, createdBy: user.id },
      'Custom pricing quote created'
    );

    return NextResponse.json({ success: true, data });
  } catch (err) {
    loggers.api.error({ err }, 'POST /api/admin/master/custom-pricing error');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await requireMaster(supabase, user.id)) {
      return NextResponse.json({ error: '마스터 권한이 필요합니다' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Whitelist updatable fields
    const allowed = [
      'quote_title', 'quote_description', 'service_type',
      'monthly_price_idr', 'one_time_price_idr',
      'valid_from', 'valid_until',
      'usage_employees', 'usage_withholding_per_month', 'usage_ppn_per_month',
      'status', 'notes',
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowed) {
      if (rest[field] !== undefined) updates[field] = rest[field];
    }

    if (updates.status && !VALID_STATUSES.includes(updates.status as string)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Status transition side-effects
    if (updates.status === 'SENT') {
      updates.sent_at = new Date().toISOString();
    }
    if (updates.status === 'ACCEPTED') {
      updates.accepted_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('custom_pricing_quote')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      loggers.api.error({ err: error, quoteId: id }, 'Failed to update custom pricing quote');
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    loggers.api.info({ quoteId: id, updatedBy: user.id, changedFields: Object.keys(updates) }, 'Custom pricing quote updated');
    return NextResponse.json({ success: true, data });
  } catch (err) {
    loggers.api.error({ err }, 'PATCH /api/admin/master/custom-pricing error');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}
