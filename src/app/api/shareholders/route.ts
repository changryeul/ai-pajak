import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';

/**
 * GET  /api/shareholders?customerId=xxx — list active shareholders
 * POST /api/shareholders                  — add shareholder
 * PUT  /api/shareholders                  — update (requires body.id)
 * DELETE /api/shareholders?id=xxx         — remove
 */

async function getCustomerId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase.from('customer').select('id').eq('user_id', userId).maybeSingle();
  return data?.id || null;
}

async function resolveCustomerIdForRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  role: string | null,
  providedCustomerId: string | null,
): Promise<{ customerId: string | null; error?: string }> {
  if (role === 'CUSTOMER') {
    const own = await getCustomerId(supabase, userId);
    return { customerId: own };
  }
  if (role === 'CONSULTANT' || role === 'TAX_ADVISOR') {
    if (!providedCustomerId) return { customerId: null, error: 'customerId required for consultants' };
    // Verify consultant has access to this customer
    const { data: consultant } = await admin.from('consultant').select('id').eq('user_id', userId).maybeSingle();
    if (!consultant) return { customerId: null, error: 'Consultant record not found' };
    const { data: assignment } = await admin
      .from('customer_consultant')
      .select('customer_id')
      .eq('consultant_id', consultant.id)
      .eq('customer_id', providedCustomerId)
      .eq('is_active', true)
      .maybeSingle();
    if (!assignment) return { customerId: null, error: 'Not assigned to this customer' };
    return { customerId: providedCustomerId };
  }
  return { customerId: null, error: 'Forbidden' };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    const admin = getSupabaseAdmin();
    const providedCustomerId = new URL(request.url).searchParams.get('customerId');
    const { customerId, error } = await resolveCustomerIdForRequest(supabase, admin, user.id, role, providedCustomerId);
    if (!customerId) return NextResponse.json({ error: error || 'No customer' }, { status: 403 });

    const { data, error: queryError } = await admin
      .from('company_shareholder')
      .select('*')
      .eq('customer_id', customerId)
      .is('exited_date', null)
      .order('shareholding_pct', { ascending: false });

    if (queryError) {
      loggers.api.error({ err: queryError }, 'List shareholders failed');
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    // Also compute total shareholding for validation
    const total = (data || []).reduce((sum, s) => sum + Number(s.shareholding_pct || 0), 0);
    return NextResponse.json({ success: true, data: data || [], meta: { totalPct: total } });
  } catch (err) {
    loggers.api.error({ err }, 'List shareholders error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    const admin = getSupabaseAdmin();
    const body = await request.json();
    const { customerId, error } = await resolveCustomerIdForRequest(supabase, admin, user.id, role, body.customerId || null);
    if (!customerId) return NextResponse.json({ error: error || 'No customer' }, { status: 403 });

    const {
      name, is_entity, npwp, nik, country_code, is_resident,
      shareholding_pct, capital_amount, share_class, is_beneficial_owner, is_voting_rights,
      is_director, is_commissioner, joined_date, counterparty_id, source, source_document_url, notes,
    } = body;

    if (!name || shareholding_pct === undefined || shareholding_pct === null) {
      return NextResponse.json({ error: 'name and shareholding_pct required' }, { status: 400 });
    }

    const { data, error: insertError } = await admin.from('company_shareholder').insert({
      customer_id: customerId,
      name,
      is_entity: is_entity !== false,
      npwp: npwp || null,
      nik: nik || null,
      country_code: (country_code || 'ID').toUpperCase(),
      is_resident: is_resident !== false,
      shareholding_pct: Number(shareholding_pct),
      capital_amount: capital_amount != null ? Number(capital_amount) : null,
      share_class: share_class || null,
      is_beneficial_owner: is_beneficial_owner !== false,
      is_voting_rights: is_voting_rights !== false,
      is_director: !!is_director,
      is_commissioner: !!is_commissioner,
      joined_date: joined_date || null,
      counterparty_id: counterparty_id || null,
      source: source || 'MANUAL',
      source_document_url: source_document_url || null,
      notes: notes || null,
    }).select().single();

    if (insertError) {
      loggers.api.error({ err: insertError }, 'Create shareholder failed');
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    loggers.api.info({ customerId, shareholderId: data.id }, 'Shareholder created');
    return NextResponse.json({ success: true, data });
  } catch (err) {
    loggers.api.error({ err }, 'Create shareholder error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    const admin = getSupabaseAdmin();
    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Ownership check
    const { data: existing } = await admin
      .from('company_shareholder')
      .select('id, customer_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { customerId } = await resolveCustomerIdForRequest(supabase, admin, user.id, role, existing.customer_id);
    if (customerId !== existing.customer_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allowed = [
      'name', 'is_entity', 'npwp', 'nik', 'country_code', 'is_resident',
      'shareholding_pct', 'capital_amount', 'share_class', 'is_beneficial_owner',
      'is_voting_rights', 'is_director', 'is_commissioner', 'joined_date',
      'exited_date', 'counterparty_id', 'notes',
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowed) {
      if (rest[field] !== undefined) updates[field] = rest[field];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error: updateError } = await admin
      .from('company_shareholder')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      loggers.api.error({ err: updateError }, 'Update shareholder failed');
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    loggers.api.error({ err }, 'Update shareholder error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    const admin = getSupabaseAdmin();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: existing } = await admin
      .from('company_shareholder')
      .select('id, customer_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { customerId } = await resolveCustomerIdForRequest(supabase, admin, user.id, role, existing.customer_id);
    if (customerId !== existing.customer_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await admin
      .from('company_shareholder')
      .delete()
      .eq('id', id);

    if (deleteError) {
      loggers.api.error({ err: deleteError }, 'Delete shareholder failed');
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    loggers.api.error({ err }, 'Delete shareholder error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
