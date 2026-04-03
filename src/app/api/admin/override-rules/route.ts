import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Override Rules CRUD — PLATFORM_ADMIN only
 *
 * GET  /api/admin/override-rules — List all rules
 * POST /api/admin/override-rules — Create rule
 * PUT  /api/admin/override-rules — Update rule
 */

async function checkAdmin(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: role } = await getSupabaseAdmin()
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (role?.role !== 'PLATFORM_ADMIN') return null;
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await getSupabaseAdmin()
      .from('tax_override_rule')
      .select('*')
      .order('priority', { ascending: false })
      .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data || [] });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await checkAdmin(request);
    if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = await request.json();
    const { name, description, priority, conditionServiceCategory, conditionRecipientType,
      conditionVendorIsOwner, conditionIsRelatedParty, conditionKbliPattern, conditionCountry,
      resultTaxType, resultRate, resultIsFinal, resultReason, resultLegalBasis } = body;

    if (!name || !resultTaxType || resultRate === undefined || !resultReason || !resultLegalBasis) {
      return NextResponse.json({ error: 'name, resultTaxType, resultRate, resultReason, resultLegalBasis required' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('tax_override_rule')
      .insert({
        name,
        description,
        priority: priority || 100,
        condition_service_category: conditionServiceCategory || null,
        condition_recipient_type: conditionRecipientType || null,
        condition_vendor_is_owner: conditionVendorIsOwner ?? null,
        condition_is_related_party: conditionIsRelatedParty ?? null,
        condition_kbli_pattern: conditionKbliPattern || null,
        condition_country: conditionCountry || null,
        result_tax_type: resultTaxType,
        result_rate: resultRate,
        result_is_final: resultIsFinal ?? false,
        result_reason: resultReason,
        result_legal_basis: resultLegalBasis,
        created_by: user.id,
      })
      .select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await checkAdmin(request);
    if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (fields.name !== undefined) updateData.name = fields.name;
    if (fields.description !== undefined) updateData.description = fields.description;
    if (fields.isActive !== undefined) updateData.is_active = fields.isActive;
    if (fields.priority !== undefined) updateData.priority = fields.priority;
    if (fields.conditionServiceCategory !== undefined) updateData.condition_service_category = fields.conditionServiceCategory;
    if (fields.conditionRecipientType !== undefined) updateData.condition_recipient_type = fields.conditionRecipientType;
    if (fields.conditionVendorIsOwner !== undefined) updateData.condition_vendor_is_owner = fields.conditionVendorIsOwner;
    if (fields.conditionIsRelatedParty !== undefined) updateData.condition_is_related_party = fields.conditionIsRelatedParty;
    if (fields.conditionKbliPattern !== undefined) updateData.condition_kbli_pattern = fields.conditionKbliPattern;
    if (fields.conditionCountry !== undefined) updateData.condition_country = fields.conditionCountry;
    if (fields.resultTaxType !== undefined) updateData.result_tax_type = fields.resultTaxType;
    if (fields.resultRate !== undefined) updateData.result_rate = fields.resultRate;
    if (fields.resultIsFinal !== undefined) updateData.result_is_final = fields.resultIsFinal;
    if (fields.resultReason !== undefined) updateData.result_reason = fields.resultReason;
    if (fields.resultLegalBasis !== undefined) updateData.result_legal_basis = fields.resultLegalBasis;

    const { error } = await getSupabaseAdmin()
      .from('tax_override_rule')
      .update(updateData)
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'Rule updated' });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
