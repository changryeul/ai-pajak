import { randomBytes } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/notifications/email-service';
import { loggers } from '@/lib/logger';

/**
 * Firm-scoped staff invitation (P6 follow-up).
 *
 * staff_invitation 에 tax_partner_id 를 실은 초대 row 를 만들고 accept 링크
 * 메일을 보낸다. 수락 시 /api/auth/accept-invitation 이 이 tax_partner 로
 * consultant row + user_roles 를 연결한다.
 *
 * 사용처:
 *   - POST /api/firm-admin/staff (FIRM_ADMIN 이 직원 초대)
 *   - POST /api/auth/signup TAX_PARTNER 분기 (가입 시 관리자 계정 초대)
 *
 * 메일 실패는 non-fatal — row 는 보존되고 warn 로그만 남는다.
 */

export type FirmInviteRole = 'CONSULTANT' | 'TAX_ADVISOR' | 'FIRM_ADMIN';

export interface FirmInvitationParams {
  email: string;
  fullName?: string | null;
  role: FirmInviteRole;
  taxPartnerId: string;
  invitedBy: string;
  inviterRole: string;
}

export type FirmInvitationResult =
  | { ok: true; invitationId: string; email: string; role: FirmInviteRole; expiresAt: string }
  | { ok: false; status: number; error: string };

const ROLE_LABEL: Record<FirmInviteRole, string> = {
  CONSULTANT: 'Consultant',
  TAX_ADVISOR: 'Tax Advisor',
  FIRM_ADMIN: 'Firm Admin',
};

export async function createAndEmailFirmInvitation(
  params: FirmInvitationParams,
): Promise<FirmInvitationResult> {
  const { email, fullName, role, taxPartnerId, invitedBy, inviterRole } = params;
  const admin = getSupabaseAdmin();

  // 이미 어떤 법인이든 consultant 로 등록된 이메일 차단.
  // NOTE: auth.admin.listUsers 는 populated prod 에서 500 이라 쓰지 않는다 —
  // 기존 auth 계정과 겹치면 accept 시점의 createUser 가 email_exists 로 막는다.
  const { data: existingConsultant } = await admin
    .from('consultant')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingConsultant) {
    return { ok: false, status: 409, error: 'This email already belongs to a consultant' };
  }

  const { data: pending } = await admin
    .from('staff_invitation')
    .select('id')
    .eq('email', email)
    .is('accepted_at', null)
    .is('cancelled_at', null)
    .maybeSingle();
  if (pending) {
    return { ok: false, status: 409, error: 'A pending invitation already exists for this email' };
  }

  const { data: firm } = await admin
    .from('tax_partner')
    .select('name')
    .eq('id', taxPartnerId)
    .single();

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: inv, error: insErr } = await admin
    .from('staff_invitation')
    .insert({
      email,
      role,
      full_name: fullName || null,
      invited_by: invitedBy,
      inviter_role: inviterRole,
      token,
      expires_at: expiresAt,
      tax_partner_id: taxPartnerId,
    })
    .select('id, email, role, expires_at')
    .single();
  if (insErr || !inv) {
    loggers.api.error({ err: insErr, taxPartnerId }, 'firm invitation insert failed');
    return { ok: false, status: 500, error: 'Failed to create invitation' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app';
  const acceptUrl = `${appUrl}/ko/invite/accept?token=${token}`;
  const roleLabel = ROLE_LABEL[role];
  const firmName = firm?.name ?? 'your tax consulting firm';

  try {
    await sendEmail({
      to: email,
      subject: `[AI Pajak] You have been invited to ${firmName} as ${roleLabel}`,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #4338ca, #a21caf); color: white; padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">You're invited to ${firmName}</h1>
    <p style="margin: 10px 0 0; opacity: 0.9;">Join as ${roleLabel} on AI Pajak ERP</p>
  </div>
  <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 12px 12px;">
    <p>Hello${fullName ? ' ' + fullName : ''},</p>
    <p>You have been invited to <b>${firmName}</b> as <b>${roleLabel}</b>.</p>
    <p>Click the button below to create your account. The invitation expires in <b>7 days</b>.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptUrl}" style="display: inline-block; background: #4338ca; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        Accept invitation
      </a>
    </div>
    <p style="font-size: 12px; color: #6b7280;">Or copy this link into your browser:</p>
    <p style="font-size: 11px; color: #6b7280; word-break: break-all;">${acceptUrl}</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 11px; color: #9ca3af;">If you did not request this email, please ignore it.</p>
  </div>
</div>
      `,
      text: `${firmName} ${roleLabel} invitation on AI Pajak\n\nAccept link: ${acceptUrl}\n\nExpires in 7 days.`,
    });
  } catch (emailErr) {
    loggers.api.warn({ err: emailErr, email }, 'Firm invitation email failed (row kept)');
  }

  return {
    ok: true,
    invitationId: inv.id,
    email: inv.email,
    role: inv.role as FirmInviteRole,
    expiresAt: inv.expires_at,
  };
}
