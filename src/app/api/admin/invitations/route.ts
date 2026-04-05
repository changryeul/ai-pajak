import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { sendEmail } from '@/lib/notifications/email-service';
import { loggers } from '@/lib/logger';

type StaffRole = 'TAX_OPERATOR' | 'TAX_OPERATOR_SUPERVISOR' | 'TAX_ADVISOR_JTC' | 'CONSULTANT_JTC';

/**
 * GET /api/admin/invitations
 *   → List invitations created by the current user (or all if MASTER)
 *
 * POST /api/admin/invitations
 *   body: { email, role, team?, fullName? }
 *   → Create invitation + send email
 *
 * Permission matrix:
 *   - TAX_ADVISOR_JTC (Master): can invite any role
 *   - TAX_OPERATOR_SUPERVISOR: can invite TAX_OPERATOR only
 *   - Others: forbidden
 */
function canInvite(inviterRole: string, targetRole: StaffRole): boolean {
  if (inviterRole === 'TAX_ADVISOR_JTC') {
    return ['TAX_OPERATOR', 'TAX_OPERATOR_SUPERVISOR', 'TAX_ADVISOR_JTC', 'CONSULTANT_JTC'].includes(targetRole);
  }
  if (inviterRole === 'TAX_OPERATOR_SUPERVISOR') {
    return targetRole === 'TAX_OPERATOR';
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['TAX_ADVISOR_JTC', 'TAX_OPERATOR_SUPERVISOR'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    let query = admin
      .from('staff_invitation')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    // Supervisors only see their own invitations; master sees all
    if (role === 'TAX_OPERATOR_SUPERVISOR') {
      query = query.eq('invited_by', user.id);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    loggers.api.error({ err: error }, 'List invitations error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['TAX_ADVISOR_JTC', 'TAX_OPERATOR_SUPERVISOR'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { email, role: targetRole, team, fullName } = body as {
      email: string;
      role: StaffRole;
      team?: string;
      fullName?: string;
    };

    if (!email || !targetRole) {
      return NextResponse.json({ error: 'email and role required' }, { status: 400 });
    }

    if (!canInvite(role!, targetRole)) {
      return NextResponse.json(
        { error: `${role}는 ${targetRole} 역할을 초대할 수 없습니다` },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Check if email already has a pending invitation
    const { data: existing } = await admin
      .from('staff_invitation')
      .select('id')
      .eq('email', email)
      .is('accepted_at', null)
      .is('cancelled_at', null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: '이미 대기 중인 초대가 있습니다' },
        { status: 409 }
      );
    }

    // Check if email already has a user account
    const { data: existingAuth } = await admin.auth.admin.listUsers();
    if (existingAuth?.users?.some(u => u.email === email)) {
      return NextResponse.json(
        { error: '이미 가입된 이메일입니다' },
        { status: 409 }
      );
    }

    // Create invitation with 7-day expiry
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inv, error: insertError } = await admin
      .from('staff_invitation')
      .insert({
        email,
        role: targetRole,
        team: team || null,
        full_name: fullName || null,
        invited_by: user.id,
        inviter_role: role,
        token,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError || !inv) {
      loggers.api.error({ err: insertError }, 'Failed to create invitation');
      return NextResponse.json({ error: '초대 생성 실패' }, { status: 500 });
    }

    // Send invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app';
    const acceptUrl = `${appUrl}/ko/invite/accept?token=${token}`;

    const roleLabel =
      targetRole === 'TAX_ADVISOR_JTC' ? '세무사 (Tax Advisor)' :
      targetRole === 'CONSULTANT_JTC' ? '컨설턴트' :
      targetRole === 'TAX_OPERATOR_SUPERVISOR' ? '백오피스 수퍼바이저' :
      '백오피스 상담원';

    try {
      await sendEmail({
        to: email,
        subject: `[AI Pajak] ${roleLabel}으로 초대되었습니다`,
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af, #4338ca); color: white; padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">AI Pajak에 초대되었습니다</h1>
    <p style="margin: 10px 0 0; opacity: 0.9;">${roleLabel} 역할로 합류하세요</p>
  </div>
  <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 12px 12px;">
    <p>안녕하세요${fullName ? ' ' + fullName + '님' : ''},</p>
    <p>Jakarta Tax Consulting(AI Pajak) 팀에 <b>${roleLabel}</b>으로 초대되었습니다.</p>
    <p>아래 버튼을 클릭하여 계정을 생성하세요. 초대는 <b>7일 후 만료</b>됩니다.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        초대 수락하기
      </a>
    </div>
    <p style="font-size: 12px; color: #6b7280;">또는 아래 링크를 브라우저에 복사:</p>
    <p style="font-size: 11px; color: #6b7280; word-break: break-all;">${acceptUrl}</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 11px; color: #9ca3af;">본 이메일을 요청하지 않으셨다면 무시해 주세요.</p>
  </div>
</div>
        `,
        text: `AI Pajak ${roleLabel} 초대\n\n계정 생성 링크: ${acceptUrl}\n\n7일 후 만료됩니다.`,
      });
    } catch (emailErr) {
      loggers.api.warn({ err: emailErr, email }, 'Email send failed (invitation still created)');
    }

    loggers.api.info({ inviterId: user.id, email, targetRole }, 'Staff invitation created');

    return NextResponse.json({
      success: true,
      data: {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expires_at,
      },
      message: '초대 이메일을 발송했습니다',
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Create invitation error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
