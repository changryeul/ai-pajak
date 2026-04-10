import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';

/**
 * GET  /api/counterparties
 *   → List current user's counterparties (customer-scoped from tax_counterparty)
 *
 * POST /api/counterparties
 *   body: { name, npwp?, kbli_code?, address?, country_code?, is_foreign?, licenses?, tax_treaty_info?, ... }
 *   → Create counterparty for current user.
 *     If NPWP is provided and already in global registry → link to registry (auto-fill).
 *     If NPWP is not in registry → create new registry entry + link.
 *     Returns the tax_counterparty row with merged data.
 */
async function getCustomerId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('customer')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.id || null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (role === 'CUSTOMER') {
      const customerId = await getCustomerId(supabase, user.id);
      if (!customerId) return NextResponse.json({ success: true, data: [] });

      const admin = getSupabaseAdmin();
      const { data } = await admin
        .from('tax_counterparty')
        .select('*, registry:registry_id(*)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      return NextResponse.json({ success: true, data: data || [] });
    }

    if (['CONSULTANT_JTC', 'TAX_ADVISOR_JTC'].includes(role || '')) {
      const admin = getSupabaseAdmin();
      const url = new URL(request.url);
      const customerFilter = url.searchParams.get('customerId');

      let query = admin
        .from('tax_counterparty')
        .select('*, registry:registry_id(*)')
        .order('created_at', { ascending: false });

      if (customerFilter) query = query.eq('customer_id', customerFilter);

      const { data } = await query;
      return NextResponse.json({ success: true, data: data || [] });
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    loggers.api.error({ err: error }, 'List counterparties error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['CUSTOMER', 'CONSULTANT_JTC', 'TAX_ADVISOR_JTC'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      customerId: bodyCustomerId,
      name,
      npwp,
      kbli_code,
      address,
      country_code,
      is_foreign,
      qualification_grade,
      has_cod,
      licenses,
      tax_treaty_info,
      type,                  // VENDOR | CLIENT | EMPLOYEE
      phone,
      email,
      is_related_party,
      nickname,
      notes,
      // Phase 2 withholding fields
      cor_document_url,
      cor_valid_from,
      cor_valid_until,
      dgt_form_type,
      dgt_form_url,
      dgt_form_valid_until,
      is_shareholder,
      shareholding_pct,
      is_beneficial_owner,
      receives_reinvested_dividend,
      is_entity,
      vendor_is_property_owner,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    // Resolve target customer
    let customerId = bodyCustomerId;
    if (!customerId) {
      if (role === 'CUSTOMER') {
        customerId = await getCustomerId(supabase, user.id);
      }
    }
    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Normalize NPWP: digits only
    const npwpDigits = npwp ? String(npwp).replace(/\D/g, '') : null;

    // Registry lookup/upsert
    let registryId: string | null = null;
    if (npwpDigits && npwpDigits.length >= 15) {
      const { data: existingReg } = await admin
        .from('counterparty_registry')
        .select('*')
        .eq('npwp', npwpDigits)
        .maybeSingle();

      if (existingReg) {
        registryId = existingReg.id;
        // Bump usage counter + update last_updated_by
        await admin
          .from('counterparty_registry')
          .update({
            usage_count: (existingReg.usage_count || 1) + 1,
            last_updated_by: customerId,
          })
          .eq('id', existingReg.id);
      } else {
        // Create new registry entry (using admin privileges because RLS blocks direct writes)
        const { data: newReg } = await admin
          .from('counterparty_registry')
          .insert({
            npwp: npwpDigits,
            name,
            kbli_code: kbli_code || null,
            address: address || null,
            country_code: country_code || 'ID',
            is_foreign: !!is_foreign,
            qualification_grade: qualification_grade || null,
            has_cod: !!has_cod,
            licenses: licenses || [],
            tax_treaty_info: tax_treaty_info || null,
            phone: phone || null,
            email: email || null,
            verification_source: 'USER',
            first_registered_by: customerId,
            last_updated_by: customerId,
            usage_count: 1,
          })
          .select('id')
          .single();
        registryId = newReg?.id || null;
      }
    }

    // Create customer-scoped tax_counterparty row
    const { data: counterparty, error: cpError } = await admin
      .from('tax_counterparty')
      .insert({
        customer_id: customerId,
        registry_id: registryId,
        name,
        npwp: npwpDigits,
        address: address || null,
        phone: phone || null,
        email: email || null,
        type: type || 'VENDOR',
        kbli_code: kbli_code || null,
        country: country_code || 'ID',
        is_resident: !is_foreign,
        is_foreign: !!is_foreign,
        qualification_grade: qualification_grade || null,
        has_cod: !!has_cod,
        licenses: licenses || null,
        tax_treaty_info: tax_treaty_info || null,
        is_related_party: !!is_related_party,
        nickname: nickname || null,
        notes: notes || null,
        // Phase 2 withholding fields
        cor_document_url: cor_document_url || null,
        cor_valid_from: cor_valid_from || null,
        cor_valid_until: cor_valid_until || null,
        dgt_form_type: dgt_form_type || null,
        dgt_form_url: dgt_form_url || null,
        dgt_form_valid_until: dgt_form_valid_until || null,
        is_shareholder: !!is_shareholder,
        shareholding_pct: shareholding_pct != null ? Number(shareholding_pct) : null,
        is_beneficial_owner: !!is_beneficial_owner,
        receives_reinvested_dividend: !!receives_reinvested_dividend,
        is_entity: is_entity !== undefined ? !!is_entity : true,
        vendor_is_property_owner: !!vendor_is_property_owner,
      })
      .select()
      .single();

    if (cpError) {
      loggers.api.error({ err: cpError }, 'Create counterparty failed');
      return NextResponse.json({ error: cpError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: counterparty });
  } catch (error) {
    loggers.api.error({ err: error }, 'Create counterparty error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/counterparties — update counterparty (body must include `id`)
 * Used for editing withholding fields (DGT, shareholder info, etc.)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['CUSTOMER', 'CONSULTANT_JTC', 'TAX_ADVISOR_JTC'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Ownership check: the counterparty must belong to an accessible customer
    const { data: existing } = await admin
      .from('tax_counterparty')
      .select('id, customer_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (role === 'CUSTOMER') {
      const myCustomerId = await getCustomerId(supabase, user.id);
      if (existing.customer_id !== myCustomerId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Whitelist updatable fields (including Phase 2 withholding fields)
    const allowed = [
      'name', 'npwp', 'address', 'phone', 'email', 'type', 'kbli_code',
      'country', 'is_resident', 'is_foreign', 'qualification_grade',
      'has_cod', 'licenses', 'tax_treaty_info', 'is_related_party',
      'nickname', 'notes',
      // Phase 2
      'cor_document_url', 'cor_valid_from', 'cor_valid_until',
      'dgt_form_type', 'dgt_form_url', 'dgt_form_valid_until',
      'is_shareholder', 'shareholding_pct', 'is_beneficial_owner',
      'receives_reinvested_dividend', 'is_entity', 'vendor_is_property_owner',
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowed) {
      if (rest[field] !== undefined) updates[field] = rest[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error: updateError } = await admin
      .from('tax_counterparty')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      loggers.api.error({ err: updateError }, 'Update counterparty failed');
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    loggers.api.info({ counterpartyId: id, fields: Object.keys(updates) }, 'Counterparty updated');
    return NextResponse.json({ success: true, data });
  } catch (error) {
    loggers.api.error({ err: error }, 'Update counterparty error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
