import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * POST /api/auth/signup-company
 *
 * Server-side signup flow for corporate customers. Bypasses the client-side
 * signUp → setup-account race condition (no session yet → 401).
 *
 * Uses admin client to:
 *   1. Create auth user with email_confirm=true (skip email verification for now)
 *   2. Create customer(COMPANY) record with NPWP, address, agreement fields
 *   3. Insert customer_kbli rows
 *   4. Assign CUSTOMER role
 *   5. Create FREE subscription
 *
 * Public endpoint (no auth required), but protected by:
 *   - rate-limit middleware (src/middleware.ts)
 *   - duplicate email / NPWP detection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      fullName,           // representative name
      phone,
      companyName,
      npwp,
      address,
      kbliCodes,
      primaryKbli,
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
      return NextResponse.json({ error: '비밀번호는 최소 8자 이상이어야 합니다' }, { status: 400 });
    }
    if (!jtcAgreement?.accepted) {
      return NextResponse.json({ error: 'JTC 약관 동의가 필요합니다' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Check duplicate NPWP
    const { data: existingNpwp } = await admin
      .from('customer')
      .select('id')
      .eq('npwp', npwp)
      .maybeSingle();

    if (existingNpwp) {
      return NextResponse.json(
        { error: '이미 등록된 NPWP입니다' },
        { status: 409 }
      );
    }

    // Create auth user (email pre-confirmed so user can log in immediately)
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || null,
        account_type: 'COMPANY',
        company_name: companyName,
        npwp,
      },
    });

    if (authError || !authUser?.user) {
      loggers.api.error({ err: authError }, 'Failed to create auth user');
      return NextResponse.json(
        { error: authError?.message || '계정 생성에 실패했습니다' },
        { status: 500 }
      );
    }

    const userId = authUser.user.id;

    // Create customer record
    const { data: customer, error: custError } = await admin
      .from('customer')
      .insert({
        user_id: userId,
        customer_type: 'COMPANY',
        full_name: fullName,
        email,
        phone: phone || null,
        company_name: companyName,
        npwp,
        address: address || null,
        jtc_agreement_accepted: true,
        jtc_agreement_version: jtcAgreement.version || 'v1.0',
        jtc_agreement_accepted_at: new Date().toISOString(),
        data_processing_consent: !!jtcAgreement.dataProcessing,
        tax_filing_authorization: !!jtcAgreement.taxFilingAuthorization,
      })
      .select('id')
      .single();

    if (custError || !customer) {
      // Rollback auth user
      await admin.auth.admin.deleteUser(userId);
      loggers.api.error({ err: custError }, 'Failed to create customer');
      return NextResponse.json(
        { error: custError?.message || '고객 정보 저장 실패' },
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

    loggers.api.info({ userId, customerId, npwp }, 'Company signup completed');

    return NextResponse.json({
      success: true,
      data: {
        userId,
        customerId,
        email,
        npwp,
        companyName,
      },
      message: '법인 가입이 완료되었습니다. 로그인 페이지로 이동합니다.',
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Company signup error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '가입 처리 중 오류' },
      { status: 500 }
    );
  }
}
