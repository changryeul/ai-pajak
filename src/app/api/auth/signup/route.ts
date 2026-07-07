import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * POST /api/auth/signup
 *
 * Server-side signup for INDIVIDUAL and TAX_PARTNER accounts.
 *
 * Strategy: admin.createUser (no email sent, no rate limit) → fallback to signUp().
 * - Production Supabase: admin API works → no email, no rate limit
 * - Local dev (GoTrue v2.188.1 ES256): admin may fail → fallback to signUp()
 */

async function createAuthUser(
  email: string,
  password: string,
  metadata: Record<string, unknown>,
): Promise<{ userId: string; error?: string; errorCode?: string }> {
  const admin = getSupabaseAdmin();

  // Try admin API first (no email sent → no rate limit)
  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (!error && data?.user?.id) {
      return { userId: data.user.id };
    }

    // If admin fails (e.g., local GoTrue ES256 issue), fall through to signUp
    loggers.api.warn({ err: error }, 'Signup: admin.createUser failed, trying signUp fallback');
  } catch (err) {
    loggers.api.warn({ err }, 'Signup: admin.createUser threw, trying signUp fallback');
  }

  // Fallback: public signUp (may send email, subject to rate limit)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const anonClient = createClient(supabaseUrl, anonKey);

  const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (signUpError) {
    const msg = signUpError.message;
    if (msg.includes('already') || msg.includes('registered')) {
      return { userId: '', error: 'Email sudah terdaftar', errorCode: 'EMAIL_TAKEN' };
    }
    if (msg.includes('rate')) {
      return { userId: '', error: 'Coba lagi beberapa saat lagi', errorCode: 'RATE_LIMIT' };
    }
    return { userId: '', error: msg, errorCode: 'UNKNOWN' };
  }

  if (!signUpData.user?.id) {
    return { userId: '', error: 'Gagal membuat akun', errorCode: 'CREATE_USER_FAILED' };
  }

  // Defensive guard: with email confirmations enabled, signUp may return a
  // synthetic UUID for an already-registered email as a privacy measure.
  // That UUID is NOT present in auth.users, so a subsequent customer insert
  // would trigger customer_user_id_fkey. Verify first.
  const verify = await admin.auth.admin.getUserById(signUpData.user.id);
  if (verify.error || !verify.data?.user) {
    loggers.api.warn({ userId: signUpData.user.id }, 'Signup: signUp returned unresolved user id (likely existing email)');
    return { userId: '', error: 'Email sudah terdaftar', errorCode: 'EMAIL_TAKEN' };
  }

  return { userId: signUpData.user.id };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      fullName,
      phone,
      accountType,
      firmName,
      firmRegistrationNumber,
      npwp,
      nik,
    } = body as {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      accountType: 'INDIVIDUAL' | 'TAX_PARTNER';
      firmName?: string;
      firmRegistrationNumber?: string;
      npwp?: string;
      nik?: string;
    };

    // Validation
    if (!email || !password || !fullName || !accountType) {
      return NextResponse.json(
        { error: 'email, password, fullName, accountType are required', errorCode: 'MISSING_REQUIRED' },
        { status: 400 }
      );
    }
    if (!['INDIVIDUAL', 'TAX_PARTNER'].includes(accountType)) {
      return NextResponse.json(
        { error: 'accountType must be INDIVIDUAL or TAX_PARTNER', errorCode: 'MISSING_REQUIRED' },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Kata sandi minimal 8 karakter', errorCode: 'PASSWORD_TOO_SHORT' },
        { status: 400 }
      );
    }
    if (accountType === 'TAX_PARTNER' && !firmName) {
      return NextResponse.json(
        { error: 'Nama kantor konsultan wajib diisi', errorCode: 'MISSING_REQUIRED' },
        { status: 400 }
      );
    }

    // Create auth user (admin first → signUp fallback)
    const { userId, error: authError, errorCode: authErrorCode } = await createAuthUser(email, password, {
      full_name: fullName,
      phone: phone || null,
      account_type: accountType,
      ...(accountType === 'TAX_PARTNER' && {
        firm_name: firmName,
        firm_registration_number: firmRegistrationNumber,
      }),
    });

    if (authError) {
      const status = authErrorCode === 'EMAIL_TAKEN' ? 409 : authErrorCode === 'RATE_LIMIT' ? 429 : 500;
      return NextResponse.json({ error: authError, errorCode: authErrorCode || 'UNKNOWN' }, { status });
    }

    // Create DB records via admin client (PostgREST — always works)
    const admin = getSupabaseAdmin();

    if (accountType === 'INDIVIDUAL') {
      // Normalise NPWP/NIK to digits only so later validation + matching
      // (e.g., KYC checks against uploaded documents) have a single canonical form.
      const cleanNpwp = npwp ? npwp.replace(/\D/g, '') : '';
      const cleanNik = nik ? nik.replace(/\D/g, '') : '';
      const { error: custError } = await admin.from('customer').insert({
        user_id: userId,
        customer_type: 'INDIVIDUAL',
        full_name: fullName,
        email,
        phone: phone || null,
        npwp: cleanNpwp.length === 15 ? cleanNpwp : null,
        nik: cleanNik.length === 16 ? cleanNik : null,
        // INDIVIDUAL customers walk through 3-step onboarding
        // (/register → /register/terms → /register/mandate).
        onboarding_step: 1,
      });

      if (custError) {
        // Roll back the auth user so the email can be reused. Without this
        // a failed customer insert leaves an orphan auth.users row that
        // blocks any retry with 'Email sudah terdaftar'.
        loggers.api.error({ err: custError, userId }, 'Signup: customer insert failed — rolling back auth user');
        await admin.auth.admin.deleteUser(userId).catch((e) =>
          loggers.api.error({ err: e, userId }, 'Signup: auth rollback failed'),
        );
        return NextResponse.json({ error: custError.message }, { status: 500 });
      }

      await admin.from('user_roles').insert({
        user_id: userId,
        role: 'CUSTOMER',
        is_active: true,
      });
    } else if (accountType === 'TAX_PARTNER') {
      // Look up the AI Pajak platform id (needed for tax_partner.platform_id FK)
      const { data: platform } = await admin
        .from('platform')
        .select('id')
        .eq('name', 'AI Pajak')
        .maybeSingle();

      if (!platform) {
        loggers.api.error({}, 'Signup: platform row not found');
        return NextResponse.json(
          { error: 'Konfigurasi platform tidak ditemukan. Hubungi administrator.' },
          { status: 500 }
        );
      }

      // Create a new external tax_partner row for this firm
      const { data: partner, error: partnerError } = await admin
        .from('tax_partner')
        .insert({
          platform_id: platform.id,
          name: firmName,
          legal_name: firmName,
          partner_type: 'EXTERNAL',
          is_default_filing_partner: false,
          tax_license_number: firmRegistrationNumber || null,
          email,
          phone: phone || null,
          is_active: true,
        })
        .select('id')
        .single();

      if (partnerError || !partner) {
        loggers.api.error({ err: partnerError, userId }, 'Signup: tax_partner insert failed — rolling back auth user');
        await admin.auth.admin.deleteUser(userId).catch((e) =>
          loggers.api.error({ err: e, userId }, 'Signup: auth rollback failed'),
        );
        return NextResponse.json(
          { error: partnerError?.message || 'Gagal mendaftarkan kantor konsultan' },
          { status: 500 }
        );
      }

      // Create the representative consultant record (the founder/signup user)
      const { error: consultantError } = await admin.from('consultant').insert({
        user_id: userId,
        tax_partner_id: partner.id,
        full_name: fullName,
        email,
        phone: phone || null,
        is_active: true,
      });

      if (consultantError) {
        loggers.api.error({ err: consultantError, userId }, 'Signup: consultant insert failed — rolling back auth user + tax_partner');
        await admin.from('tax_partner').delete().eq('id', partner.id);
        await admin.auth.admin.deleteUser(userId).catch((e) =>
          loggers.api.error({ err: e, userId }, 'Signup: auth rollback failed'),
        );
        return NextResponse.json(
          { error: consultantError.message },
          { status: 500 }
        );
      }

      // Grant TAX_ADVISOR role (name preserved for backward compat;
      // role now covers both JTC staff and external consulting firm reps).
      await admin.from('user_roles').insert({
        user_id: userId,
        role: 'TAX_ADVISOR',
        organization_id: partner.id,
        organization_type: 'TAX_PARTNER',
        is_active: true,
      });
    }

    loggers.api.info({ userId, accountType, email }, 'Signup completed');

    return NextResponse.json({
      success: true,
      data: { userId, email, accountType },
      message: accountType === 'INDIVIDUAL'
        ? 'Pendaftaran perorangan berhasil'
        : 'Pendaftaran kantor konsultan berhasil',
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Signup error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Kesalahan saat pendaftaran' },
      { status: 500 }
    );
  }
}
