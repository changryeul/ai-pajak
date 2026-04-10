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
): Promise<{ userId: string; error?: string }> {
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
      return { userId: '', error: '이미 등록된 이메일입니다' };
    }
    if (msg.includes('rate')) {
      return { userId: '', error: '잠시 후 다시 시도해주세요' };
    }
    return { userId: '', error: msg };
  }

  if (!signUpData.user?.id) {
    return { userId: '', error: '계정 생성에 실패했습니다' };
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
    } = body as {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      accountType: 'INDIVIDUAL' | 'TAX_PARTNER';
      firmName?: string;
      firmRegistrationNumber?: string;
    };

    // Validation
    if (!email || !password || !fullName || !accountType) {
      return NextResponse.json(
        { error: 'email, password, fullName, accountType are required' },
        { status: 400 }
      );
    }
    if (!['INDIVIDUAL', 'TAX_PARTNER'].includes(accountType)) {
      return NextResponse.json(
        { error: 'accountType must be INDIVIDUAL or TAX_PARTNER' },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: '비밀번호는 최소 8자 이상이어야 합니다' },
        { status: 400 }
      );
    }
    if (accountType === 'TAX_PARTNER' && !firmName) {
      return NextResponse.json(
        { error: '세무법인명은 필수입니다' },
        { status: 400 }
      );
    }

    // Create auth user (admin first → signUp fallback)
    const { userId, error: authError } = await createAuthUser(email, password, {
      full_name: fullName,
      phone: phone || null,
      account_type: accountType,
      ...(accountType === 'TAX_PARTNER' && {
        firm_name: firmName,
        firm_registration_number: firmRegistrationNumber,
      }),
    });

    if (authError) {
      const status = authError.includes('이미') ? 409 : authError.includes('잠시') ? 429 : 500;
      return NextResponse.json({ error: authError }, { status });
    }

    // Create DB records via admin client (PostgREST — always works)
    const admin = getSupabaseAdmin();

    if (accountType === 'INDIVIDUAL') {
      const { error: custError } = await admin.from('customer').insert({
        user_id: userId,
        customer_type: 'INDIVIDUAL',
        full_name: fullName,
        email,
        phone: phone || null,
      });

      if (custError) {
        loggers.api.error({ err: custError }, 'Signup: customer record failed');
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
          { error: '플랫폼 설정을 찾을 수 없습니다. 관리자에게 문의하세요.' },
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
          is_platform_partner: false,
          tax_license_number: firmRegistrationNumber || null,
          email,
          phone: phone || null,
          is_active: true,
        })
        .select('id')
        .single();

      if (partnerError || !partner) {
        loggers.api.error({ err: partnerError }, 'Signup: tax_partner record failed');
        return NextResponse.json(
          { error: partnerError?.message || '세무법인 등록 실패' },
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
        loggers.api.error({ err: consultantError }, 'Signup: consultant record failed');
        return NextResponse.json(
          { error: consultantError.message },
          { status: 500 }
        );
      }

      // Grant TAX_ADVISOR_JTC role (name preserved for backward compat;
      // role now covers both JTC staff and external consulting firm reps).
      await admin.from('user_roles').insert({
        user_id: userId,
        role: 'TAX_ADVISOR_JTC',
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
        ? '개인 가입이 완료되었습니다.'
        : '세무법인 가입이 완료되었습니다.',
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Signup error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '가입 처리 중 오류' },
      { status: 500 }
    );
  }
}
