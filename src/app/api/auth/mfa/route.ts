import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';

/**
 * 2FA / MFA API using Supabase Auth MFA
 *
 * POST /api/auth/mfa — Enroll (start setup), Verify (confirm), Unenroll (disable)
 * GET  /api/auth/mfa — Get current MFA status
 */

/**
 * GET — Check MFA enrollment status
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();

    if (factorError) {
      loggers.auth.error({ err: factorError }, 'MFA list factors error');
      return NextResponse.json({ success: false, error: 'Failed to get MFA status' }, { status: 500 });
    }

    const totpFactors = factors.totp || [];
    const verifiedFactor = totpFactors.find(f => f.status === 'verified');

    return NextResponse.json({
      success: true,
      data: {
        enabled: !!verifiedFactor,
        factorId: verifiedFactor?.id || null,
        factors: totpFactors.map(f => ({
          id: f.id,
          status: f.status,
          friendlyName: f.friendly_name,
          createdAt: f.created_at,
        })),
      },
    });
  } catch (error) {
    loggers.auth.error({ err: error }, 'MFA status error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST — Enroll, Verify, or Unenroll
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'enroll':
        return handleEnroll(supabase);
      case 'verify':
        return handleVerify(supabase, body.factorId, body.code);
      case 'unenroll':
        return handleUnenroll(supabase, body.factorId);
      default:
        return NextResponse.json({ success: false, error: 'Invalid action. Use: enroll, verify, unenroll' }, { status: 400 });
    }
  } catch (error) {
    loggers.auth.error({ err: error }, 'MFA action error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Step 1: Enroll — generates QR code and secret
 */
async function handleEnroll(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'AI Pajak Authenticator',
  });

  if (error) {
    loggers.auth.error({ err: error }, 'MFA enroll error');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  loggers.auth.info('MFA enrollment initiated');

  return NextResponse.json({
    success: true,
    data: {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
  });
}

/**
 * Step 2: Verify — confirm TOTP code to complete enrollment
 */
async function handleVerify(
  supabase: Awaited<ReturnType<typeof createClient>>,
  factorId: string,
  code: string
) {
  if (!factorId || !code) {
    return NextResponse.json({ success: false, error: 'factorId and code are required' }, { status: 400 });
  }

  // Create challenge
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });

  if (challengeError) {
    loggers.auth.error({ err: challengeError }, 'MFA challenge error');
    return NextResponse.json({ success: false, error: challengeError.message }, { status: 500 });
  }

  // Verify code
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });

  if (verifyError) {
    loggers.auth.warn({ err: verifyError }, 'MFA verify failed');
    return NextResponse.json({ success: false, error: 'Invalid verification code' }, { status: 400 });
  }

  loggers.auth.info('MFA enrollment verified successfully');

  return NextResponse.json({
    success: true,
    message: '2FA enabled successfully',
  });
}

/**
 * Unenroll — disable 2FA
 */
async function handleUnenroll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  factorId: string
) {
  if (!factorId) {
    return NextResponse.json({ success: false, error: 'factorId is required' }, { status: 400 });
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId });

  if (error) {
    loggers.auth.error({ err: error }, 'MFA unenroll error');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  loggers.auth.info('MFA unenrolled successfully');

  return NextResponse.json({
    success: true,
    message: '2FA disabled successfully',
  });
}
