import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

type AccountType = 'INDIVIDUAL' | 'COMPANY' | 'TAX_PARTNER';

/**
 * POST /api/auth/setup-account
 *
 * Called after registration to create the appropriate records based on accountType:
 *
 *   INDIVIDUAL → customer(INDIVIDUAL) + CUSTOMER role + FREE subscription
 *   COMPANY    → customer(COMPANY, company_name) + CUSTOMER role + FREE subscription
 *   TAX_PARTNER → tax_partner + consultant(self, PARTNER) + TAX_ADVISOR role
 *
 * Idempotent — safe to call multiple times.
 * Falls back to INDIVIDUAL if accountType is missing (backward compat).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Guard: do NOT auto-create a customer/CUSTOMER role for users that
    // already have a non-customer role (operator team, master, platform
    // admin, JTC consultant, etc.). Without this guard the dashboard's
    // fallback `useEffect(...setup-account)` would silently turn an
    // operator into a "customer" the first time they visit /dashboard,
    // and that ghost CUSTOMER row pollutes the sidebar with customer-only
    // menus like 연신고/월신고.
    const guardAdmin = getSupabaseAdmin();
    const { data: existingRoles } = await guardAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true);
    const NON_CUSTOMER_ROLES = new Set([
      'CONSULTANT',
      'TAX_ADVISOR',
      'TAX_OPERATOR',
      'TAX_OPERATOR_LEAD',
      'TAX_OPERATOR_SUPERVISOR',
      'TAX_OPERATOR_MASTER',
      'PLATFORM_ADMIN',
      'PLATFORM_MASTER',
      'FIRM_ADMIN',
      'SYSTEM',
    ]);
    if (existingRoles?.some((r) => NON_CUSTOMER_ROLES.has(r.role))) {
      loggers.api.info(
        { userId: user.id, roles: existingRoles.map((r) => r.role) },
        'setup-account skipped — user already has a non-customer role',
      );
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'User already has a non-customer role; no customer auto-creation',
      });
    }

    // Parse body (may be empty — fallback to metadata)
    let body: {
      accountType?: AccountType;
      fullName?: string;
      phone?: string;
      companyName?: string;
      npwp?: string;
      address?: string;
      kbliCodes?: string[];
      primaryKbli?: string;
      jtcAgreement?: {
        accepted?: boolean;
        version?: string;
        dataProcessing?: boolean;
        taxFilingAuthorization?: boolean;
      };
      firmName?: string;
      firmRegistrationNumber?: string;
    } = {};
    try { body = await request.json(); } catch { /* empty body allowed */ }

    const metadata = user.user_metadata || {};
    const accountType: AccountType = (body.accountType || metadata.account_type || 'INDIVIDUAL') as AccountType;
    const fullName = body.fullName || metadata.full_name || user.email?.split('@')[0] || 'User';
    const phone = body.phone || metadata.phone || null;
    const email = user.email || '';

    const admin = getSupabaseAdmin();

    if (accountType === 'TAX_PARTNER') {
      return await setupTaxPartner(admin, user.id, email, fullName, phone, body.firmName, body.firmRegistrationNumber);
    }

    // INDIVIDUAL or COMPANY → customer flow
    return await setupCustomer(
      admin, user.id, email, fullName, phone, accountType,
      body.companyName, body.npwp, body.address, body.kbliCodes, body.primaryKbli, body.jtcAgreement
    );
  } catch (error) {
    loggers.api.error({ err: error }, 'setup-account error');
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}

async function setupCustomer(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  email: string,
  fullName: string,
  phone: string | null,
  customerType: 'INDIVIDUAL' | 'COMPANY',
  companyName?: string,
  npwp?: string,
  address?: string,
  kbliCodes?: string[],
  primaryKbli?: string,
  jtcAgreement?: {
    accepted?: boolean;
    version?: string;
    dataProcessing?: boolean;
    taxFilingAuthorization?: boolean;
  }
) {
  // 1. Upsert customer
  const { data: existing } = await admin
    .from('customer')
    .select('id, customer_type')
    .eq('user_id', userId)
    .maybeSingle();

  const agreementFields = jtcAgreement && jtcAgreement.accepted
    ? {
        jtc_agreement_accepted: true,
        jtc_agreement_version: jtcAgreement.version || 'v1.0',
        jtc_agreement_accepted_at: new Date().toISOString(),
        data_processing_consent: !!jtcAgreement.dataProcessing,
        tax_filing_authorization: !!jtcAgreement.taxFilingAuthorization,
      }
    : {};

  let customerId: string;
  if (existing) {
    await admin.from('customer').update({
      customer_type: customerType,
      full_name: fullName,
      ...(companyName ? { company_name: companyName } : {}),
      ...(npwp ? { npwp } : {}),
      ...(phone ? { phone } : {}),
      ...(address ? { address } : {}),
      ...agreementFields,
    }).eq('id', existing.id);
    customerId = existing.id;
  } else {
    const { data: newCustomer, error: custError } = await admin
      .from('customer')
      .insert({
        user_id: userId,
        customer_type: customerType,
        full_name: fullName,
        email,
        phone,
        address: address || null,
        company_name: customerType === 'COMPANY' ? (companyName || null) : null,
        npwp: npwp || null,
        ...agreementFields,
      })
      .select('id')
      .single();

    if (custError) {
      return NextResponse.json({ error: 'Failed to create customer: ' + custError.message }, { status: 500 });
    }
    customerId = newCustomer.id;
  }

  // 1b. Upsert KBLI codes (company only)
  if (customerType === 'COMPANY' && kbliCodes && kbliCodes.length > 0) {
    // Remove existing, insert fresh
    await admin.from('customer_kbli').delete().eq('customer_id', customerId);
    const rows = kbliCodes.map(code => ({
      customer_id: customerId,
      kbli_code: code,
      is_primary: code === primaryKbli,
    }));
    await admin.from('customer_kbli').insert(rows);
  }

  // 2. Assign CUSTOMER role
  const { data: existingRole } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'CUSTOMER')
    .maybeSingle();

  if (!existingRole) {
    await admin.from('user_roles').insert({
      user_id: userId,
      role: 'CUSTOMER',
      is_active: true,
    });
  }

  // 3. FREE subscription
  const { data: existingSub } = await admin
    .from('subscription')
    .select('id')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle();

  if (!existingSub) {
    const now = new Date();
    const yearEnd = new Date(now.getFullYear(), 11, 31);
    await admin.from('subscription').insert({
      customer_id: customerId,
      plan_type: 'FREE',
      billing_cycle: 'ANNUAL',
      price: 0,
      is_active: true,
      current_period_start: now.toISOString(),
      current_period_end: yearEnd.toISOString(),
    });
  }

  return NextResponse.json({
    success: true,
    data: { accountType: customerType, customerId, role: 'CUSTOMER', plan: 'free' },
  });
}

async function setupTaxPartner(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  email: string,
  fullName: string,
  phone: string | null,
  firmName?: string,
  _firmRegistrationNumber?: string
) {
  // 1. Create tax_partner (idempotent by user_id via consultant lookup)
  const { data: existingConsultant } = await admin
    .from('consultant')
    .select('id, tax_partner_id')
    .eq('user_id', userId)
    .maybeSingle();

  let taxPartnerId: string;
  let consultantId: string;

  if (existingConsultant) {
    taxPartnerId = existingConsultant.tax_partner_id;
    consultantId = existingConsultant.id;
  } else {
    const { data: newTp, error: tpError } = await admin
      .from('tax_partner')
      .insert({
        name: firmName || `${fullName}'s Firm`,
        is_active: true,
      })
      .select('id')
      .single();

    if (tpError) {
      return NextResponse.json({ error: 'Failed to create tax partner: ' + tpError.message }, { status: 500 });
    }
    taxPartnerId = newTp.id;

    const { data: newConsultant, error: consError } = await admin
      .from('consultant')
      .insert({
        user_id: userId,
        tax_partner_id: taxPartnerId,
        is_active: true,
        full_name: fullName,
        email,
        phone: phone || null,
        employment_start_date: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (consError) {
      return NextResponse.json({ error: 'Failed to create consultant: ' + consError.message }, { status: 500 });
    }
    consultantId = newConsultant.id;
  }

  // 2. Assign TAX_ADVISOR role (tax partner owners have full advisor privileges)
  const { data: existingRole } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'TAX_ADVISOR')
    .maybeSingle();

  if (!existingRole) {
    await admin.from('user_roles').insert({
      user_id: userId,
      role: 'TAX_ADVISOR',
      organization_id: taxPartnerId,
      organization_type: 'TAX_PARTNER',
      is_active: true,
    });
  }

  loggers.api.info({ userId, taxPartnerId, firmName }, 'Tax partner setup completed');

  return NextResponse.json({
    success: true,
    data: {
      accountType: 'TAX_PARTNER',
      taxPartnerId,
      consultantId,
      role: 'TAX_ADVISOR',
      firmName: firmName || `${fullName}'s Firm`,
    },
  });
}
