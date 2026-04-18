import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * POST /api/auth/signup-company
 *
 * Server-side signup for corporate (COMPANY) customers.
 * Uses supabase.auth.signUp() for GoTrue compatibility.
 * Email confirmation is disabled in config.toml → users can login immediately.
 * DB records created via admin DB client (PostgREST).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      fullName,
      phone,
      companyName,
      npwp,
      address,
      kbliCodes,
      primaryKbli,
      taxProfile,
      jtcAgreement,
    } = body as {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      companyName: string;
      npwp: string;
      address?: string;
      kbliCodes?: string[];
      primaryKbli?: string;
      taxProfile?: {
        annualRevenue?: number;
        revenueYear?: number;
        hasEmployees?: boolean;
        employeeCount?: number;
        isPkp?: boolean;
        paysServiceFees?: boolean;
        hasImportExport?: boolean;
        hasRentalBusiness?: boolean;
      };
      jtcAgreement?: {
        accepted?: boolean;
        version?: string;
        dataProcessing?: boolean;
        taxFilingAuthorization?: boolean;
      };
    };

    // Validation
    if (!email || !password || !fullName || !companyName || !npwp) {
      return NextResponse.json(
        { error: 'email, password, fullName, companyName, npwp are required' },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Kata sandi minimal 8 karakter' }, { status: 400 });
    }
    if (!jtcAgreement?.accepted) {
      return NextResponse.json({ error: 'Persetujuan syarat JTC diperlukan' }, { status: 400 });
    }

    const npwpDigits = npwp.replace(/\D/g, '');
    if (npwpDigits.length !== 15) {
      return NextResponse.json({ error: 'NPWP harus 15 digit angka' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Check duplicate NPWP
    const { data: existingNpwp } = await admin
      .from('customer')
      .select('id')
      .eq('npwp', npwpDigits)
      .maybeSingle();

    if (existingNpwp) {
      return NextResponse.json({ error: 'NPWP sudah terdaftar' }, { status: 409 });
    }

    // Try admin.createUser first (no email → no rate limit)
    // Falls back to signUp() if admin API fails (local GoTrue ES256 issue)
    const metadata = {
      full_name: fullName,
      phone: phone || null,
      account_type: 'COMPANY',
      company_name: companyName,
      npwp: npwpDigits,
    };

    let userId: string | undefined;

    try {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (!error && data?.user?.id) {
        userId = data.user.id;
      } else {
        loggers.api.warn({ err: error }, 'Company signup: admin.createUser failed, trying signUp');
      }
    } catch (err) {
      loggers.api.warn({ err }, 'Company signup: admin.createUser threw, trying signUp');
    }

    // Fallback: public signUp
    if (!userId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const anonClient = createClient(supabaseUrl, anonKey);

      const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });

      if (signUpError) {
        loggers.api.error({ err: signUpError }, 'Company signup: signUp failed');
        const msg = signUpError.message;
        if (msg.includes('already') || msg.includes('registered')) {
          return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
        }
        if (msg.includes('rate')) {
          return NextResponse.json({ error: 'Coba lagi beberapa saat lagi' }, { status: 429 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      // Defensive guard — see /api/auth/signup for context on the synthetic
      // user id Supabase returns when email confirmations are enabled and
      // the email is already registered.
      const candidateUserId = signUpData.user?.id;
      if (candidateUserId) {
        const verify = await admin.auth.admin.getUserById(candidateUserId);
        if (verify.error || !verify.data?.user) {
          loggers.api.warn({ userId: candidateUserId }, 'Company signup: signUp returned unresolved user id (likely existing email)');
          return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
        }
        userId = candidateUserId;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Gagal membuat akun' }, { status: 500 });
    }

    // Create customer record via admin DB client
    const { data: customer, error: custError } = await admin
      .from('customer')
      .insert({
        user_id: userId,
        customer_type: 'COMPANY',
        full_name: fullName,
        email,
        phone: phone || null,
        company_name: companyName,
        npwp: npwpDigits,
        address: address || null,
        jtc_agreement_accepted: true,
        jtc_agreement_version: jtcAgreement.version || 'v1.0',
        jtc_agreement_accepted_at: new Date().toISOString(),
        data_processing_consent: !!jtcAgreement.dataProcessing,
        tax_filing_authorization: !!jtcAgreement.taxFilingAuthorization,
        annual_revenue: taxProfile?.annualRevenue || null,
        revenue_year: taxProfile?.revenueYear || null,
        has_employees: !!taxProfile?.hasEmployees,
        employee_count: taxProfile?.employeeCount || null,
        is_pkp: !!taxProfile?.isPkp,
        pays_service_fees: !!taxProfile?.paysServiceFees,
        has_import_export: !!taxProfile?.hasImportExport,
        has_rental_business: !!taxProfile?.hasRentalBusiness,
      })
      .select('id')
      .single();

    if (custError || !customer) {
      loggers.api.error({ err: custError }, 'Company signup: customer record failed');
      return NextResponse.json(
        { error: custError?.message || 'Gagal menyimpan data pelanggan' },
        { status: 500 }
      );
    }

    const customerId = customer.id;

    // Insert KBLI codes
    if (kbliCodes && kbliCodes.length > 0) {
      const kbliRows = kbliCodes.map(code => ({
        customer_id: customerId,
        kbli_code: code,
        is_primary: code === primaryKbli,
      }));
      const { error: kbliError } = await admin.from('customer_kbli').insert(kbliRows);
      if (kbliError) {
        loggers.api.warn({ err: kbliError, customerId }, 'KBLI insert failed (non-fatal)');
      }
    }

    // Assign CUSTOMER role
    await admin.from('user_roles').insert({
      user_id: userId,
      role: 'CUSTOMER',
      is_active: true,
    });

    // Create FREE subscription
    const now = new Date();
    const yearEnd = new Date(now.getFullYear(), 11, 31);
    await admin.from('subscription').insert({
      customer_id: customerId,
      plan: 'free',
      billing_cycle: 'ANNUAL',
      price: 0,
      is_active: true,
      current_period_start: now.toISOString(),
      current_period_end: yearEnd.toISOString(),
    });

    loggers.api.info({ userId, customerId, npwp: npwpDigits }, 'Company signup completed');

    return NextResponse.json({
      success: true,
      data: {
        userId,
        customerId,
        email,
        npwp: npwpDigits,
        companyName,
      },
      message: 'Pendaftaran perusahaan berhasil. Mengalihkan ke halaman login.',
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Company signup error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Kesalahan saat pendaftaran' },
      { status: 500 }
    );
  }
}
