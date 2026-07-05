import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * GET /api/auth/accept-invitation?token=xxx
 *   → Verify token validity without consuming it (returns email, role)
 *
 * POST /api/auth/accept-invitation
 *   body: { token, password, fullName? }
 *   → Consume token, create auth user + consultant record + role assignment
 */
export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: inv } = await admin
      .from('staff_invitation')
      .select('email, role, team, full_name, expires_at, accepted_at, cancelled_at')
      .eq('token', token)
      .maybeSingle();

    if (!inv) return NextResponse.json({ errorKey: 'errors.invalidInvite' }, { status: 404 });
    if (inv.accepted_at) return NextResponse.json({ errorKey: 'errors.alreadyAccepted' }, { status: 410 });
    if (inv.cancelled_at) return NextResponse.json({ errorKey: 'errors.cancelled' }, { status: 410 });
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ errorKey: 'errors.expired' }, { status: 410 });
    }

    return NextResponse.json({
      success: true,
      data: {
        email: inv.email,
        role: inv.role,
        team: inv.team,
        fullName: inv.full_name,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accept-invitation GET error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password, fullName } = body as {
      token: string;
      password: string;
      fullName?: string;
    };

    if (!token || !password) {
      return NextResponse.json({ error: 'token and password required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ errorKey: 'errors.passwordRequired' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Load + validate invitation
    const { data: inv } = await admin
      .from('staff_invitation')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (!inv) return NextResponse.json({ errorKey: 'errors.invalidInvite' }, { status: 404 });
    if (inv.accepted_at) return NextResponse.json({ errorKey: 'errors.alreadyAccepted' }, { status: 410 });
    if (inv.cancelled_at) return NextResponse.json({ errorKey: 'errors.cancelled' }, { status: 410 });
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ errorKey: 'errors.expired' }, { status: 410 });
    }

    const displayName = fullName || inv.full_name || inv.email.split('@')[0];

    // Create auth user (email pre-confirmed)
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: inv.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: displayName,
        role: inv.role,
        team: inv.team,
        invited_by: inv.invited_by,
      },
    });

    if (authError || !authUser?.user) {
      loggers.api.error({ err: authError, email: inv.email }, 'Failed to create user from invitation');
      return NextResponse.json(
        { error: authError?.message, errorKey: authError?.message ? undefined : 'errors.signupCreateFailed' },
        { status: 500 },
      );
    }

    const userId = authUser.user.id;

    // Assign role
    await admin.from('user_roles').insert({
      user_id: userId,
      role: inv.role,
      is_active: true,
    });

    // For consultant-like roles, create consultant record linked to JTC tax_partner
    if (['TAX_ADVISOR', 'CONSULTANT'].includes(inv.role)) {
      const { data: jtc } = await admin
        .from('tax_partner')
        .select('id')
        .ilike('name', '%jakarta tax%')
        .maybeSingle();

      const taxPartnerId = jtc?.id;
      if (taxPartnerId) {
        await admin.from('consultant').insert({
          user_id: userId,
          tax_partner_id: taxPartnerId,
          is_active: true,
          full_name: displayName,
          email: inv.email,
          employment_start_date: new Date().toISOString().split('T')[0],
        });
      }
    }

    // For operator roles, create tax_operators record if that table exists
    // (optional — may not exist in all deployments)
    if (['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'].includes(inv.role)) {
      try {
        await admin.from('tax_operators').insert({
          user_id: userId,
          name: displayName,
          email: inv.email,
          role: inv.role,
          team: inv.team || null,
          is_active: true,
        });
      } catch (err) {
        loggers.api.warn({ err }, 'tax_operators insert skipped (table may not exist)');
      }
    }

    // Mark invitation as accepted
    await admin
      .from('staff_invitation')
      .update({
        accepted_at: new Date().toISOString(),
        accepted_user_id: userId,
      })
      .eq('id', inv.id);

    loggers.api.info({ userId, email: inv.email, role: inv.role }, 'Invitation accepted');

    return NextResponse.json({
      success: true,
      data: { email: inv.email, role: inv.role },
      messageKey: 'signupDone',
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accept invitation POST error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
