import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * POST /api/auth/signup
 *
 * Server-side signup for INDIVIDUAL and TAX_PARTNER accounts.
 * Uses supabase.auth.signUp() (not admin.createUser) for GoTrue compatibility.
 * Email confirmation is disabled in config.toml → users can login immediately.
 * DB records (customer, user_roles, etc.) are created via admin DB client.
 */
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

    // Use anon client for signUp (GoTrue public endpoint)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const anonClient = createClient(supabaseUrl, anonKey);

    const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
          account_type: accountType,
        },
      },
    });

    if (signUpError) {
      loggers.api.error({ err: signUpError }, 'Signup: signUp failed');
      const msg = signUpError.message;
      if (msg.includes('already') || msg.includes('registered')) {
        return NextResponse.json({ error: '이미 등록된 이메일입니다' }, { status: 409 });
      }
      if (msg.includes('rate')) {
        return NextResponse.json({ error: '잠시 후 다시 시도해주세요' }, { status: 429 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      return NextResponse.json({ error: '계정 생성에 실패했습니다' }, { status: 500 });
    }

    // Use admin DB client (PostgREST) for DB records — this works fine
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
      const { data: org, error: orgError } = await admin.from('organization').insert({
        name: firmName,
        type: 'TAX_PARTNER',
        registration_number: firmRegistrationNumber || null,
        is_active: true,
      }).select('id').single();

      if (orgError || !org) {
        loggers.api.error({ err: orgError }, 'Signup: org record failed');
        return NextResponse.json({ error: orgError?.message || '조직 생성 실패' }, { status: 500 });
      }

      const { error: consultantError } = await admin.from('consultant').insert({
        user_id: userId,
        organization_id: org.id,
        full_name: fullName,
        email,
        phone: phone || null,
        is_representative: true,
      });

      if (consultantError) {
        loggers.api.warn({ err: consultantError }, 'Signup: consultant record failed (non-fatal)');
      }

      await admin.from('user_roles').insert({
        user_id: userId,
        role: 'TAX_ADVISOR_JTC',
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
