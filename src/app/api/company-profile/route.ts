import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';

/**
 * GET /api/company-profile — Load company tax profile
 * PUT /api/company-profile — Save company tax profile + recalculate completeness
 */
async function getCustomerIdForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  role: string | null,
): Promise<string | null> {
  if (role === 'CUSTOMER') {
    const { data } = await supabase.from('customer').select('id').eq('user_id', userId).maybeSingle();
    return data?.id || null;
  }
  // Consultant: return first assigned customer (TODO: add customerId param)
  const { data: consultant } = await admin.from('consultant').select('id').eq('user_id', userId).maybeSingle();
  if (!consultant) return null;
  const { data: assignment } = await admin.from('customer_consultant').select('customer_id').eq('consultant_id', consultant.id).eq('is_active', true).limit(1).maybeSingle();
  return assignment?.customer_id || null;
}

function calculateCompleteness(profile: Record<string, unknown>): number {
  const checks = [
    !!profile.company_name,
    !!profile.npwp,
    !!profile.business_category,
    !!profile.legal_form,
    profile.annual_revenue != null,
    profile.established_year != null,
    profile.has_employees != null,
    profile.is_pkp != null,
    profile.is_umkm != null,
    // Income sources (at least one answered)
    profile.pays_service_fees != null || profile.has_import_export != null || profile.has_rental_business != null,
    // Ownership
    profile.has_foreign_shareholders != null,
    // Tax regime determined
    !!profile.tax_regime,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    const admin = getSupabaseAdmin();
    const customerId = new URL(request.url).searchParams.get('customerId')
      || await getCustomerIdForUser(supabase, admin, user.id, role);

    if (!customerId) return NextResponse.json({ error: 'No customer found' }, { status: 404 });

    const { data, error } = await admin.from('customer').select('*').eq('id', customerId).single();
    if (error || !data) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: { ...data, profile_completeness: calculateCompleteness(data) } });
  } catch (error) {
    loggers.api.error({ err: error }, 'Company profile GET error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const admin = getSupabaseAdmin();
    const role = await resolveUserRole(supabase, user.id);
    const customerId = body.id || await getCustomerIdForUser(supabase, admin, user.id, role);

    if (!customerId) return NextResponse.json({ error: 'No customer found' }, { status: 404 });

    // Whitelist updatable fields
    const allowedFields = [
      'business_category', 'legal_form', 'established_year', 'authorized_capital', 'paid_up_capital',
      'annual_revenue', 'revenue_year', 'has_employees', 'employee_count', 'is_pkp',
      'has_foreign_shareholders', 'foreign_ownership_pct', 'parent_company_name', 'parent_company_country',
      'is_umkm', 'umkm_final_tax_start_year',
      'has_construction_sbu', 'sbu_qualification', 'sbu_number', 'sbu_expires_at',
      'sells_property', 'property_type', 'is_restaurant', 'is_catering',
      'receives_dividends', 'receives_interest', 'receives_royalties', 'has_franchise',
      'pays_rent', 'pays_service_fees', 'has_import_export', 'has_rental_business',
      'is_digital_platform', 'has_shipping_business', 'has_mining_license',
      'ai_profile_questions',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    updates.profile_completeness = calculateCompleteness({ ...body, ...updates });

    const { data, error } = await admin.from('customer').update(updates).eq('id', customerId).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    loggers.api.info({ customerId, completeness: updates.profile_completeness }, 'Company profile updated');
    return NextResponse.json({ success: true, data: { ...data, profile_completeness: updates.profile_completeness } });
  } catch (error) {
    loggers.api.error({ err: error }, 'Company profile PUT error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
