/**
 * GET  /api/consultant-erp/supervisor/settings
 *   → { company, rbac, approval, security, channels }
 *
 * PATCH /api/consultant-erp/supervisor/settings
 *   body: partial { company?, approval?, channels? }
 *   → 200 { saved }
 *
 * Settings page for the 팀장용 ERP (PDF p.33-38). Persists the
 * platform tax_partner's company fields. Other tabs (RBAC matrix,
 * Coretax security defaults) are display-only — the values surfaced
 * here come from the codebase, not DB.
 *
 * Approval + channel toggles persist into tax_partner.settings (jsonb
 * already on the table per the BETA+ schema; if absent we store the
 * merged result anyway and a future migration can split it).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';

interface ApprovalSettings {
  requireSupervisorApproval: boolean;
  allowRevisionAfterReject: boolean;
  autoAdvanceToBilling: boolean;
  slaMaxReviewDays: number;
  slaReminderHours: number;
}

interface ChannelSettings {
  whatsApp: boolean;
  email: boolean;
  telegram: boolean;
  approvalPending: boolean;
  deadlineNearing: boolean;
  idBillingNtpn: boolean;
  revisionResubmit: boolean;
  legalityExpiry: boolean;
}

const DEFAULT_APPROVAL: ApprovalSettings = {
  requireSupervisorApproval: true,
  allowRevisionAfterReject: true,
  autoAdvanceToBilling: true,
  slaMaxReviewDays: 2,
  slaReminderHours: 12,
};
const DEFAULT_CHANNELS: ChannelSettings = {
  whatsApp: true,
  email: true,
  telegram: false,
  approvalPending: true,
  deadlineNearing: true,
  idBillingNtpn: true,
  revisionResubmit: true,
  legalityExpiry: true,
};

// Hardcoded RBAC matrix — surfaced to the UI as read-only since the
// actual enforcement is in the middleware + Supabase RLS.
const RBAC_MATRIX = [
  {
    role: 'TEAM_MEMBER',
    upload: true,
    parsingEdit: true,
    submit: true,
    teamView: false,
    approval: false,
    settings: false,
    credentialReveal: false,
  },
  {
    role: 'SUPERVISOR',
    upload: false,
    parsingEdit: false,
    submit: false,
    teamView: true,
    approval: true,
    settings: true,
    credentialReveal: false,
  },
  {
    role: 'OWNER',
    upload: true,
    parsingEdit: true,
    submit: true,
    teamView: true,
    approval: true,
    settings: true,
    credentialReveal: true,
  },
];

const SECURITY_DEFAULTS = {
  passwordMasking: true,
  accessLog: true,
  sensitiveInfoGuard: true,
  twoFactor: true,
  sessionTimeoutMinutes: 30,
  credentialRotationDays: 90,
  ipAllowlist: 'Office IP / VPN only',
};

async function getPlatformPartner() {
  const admin = getSupabaseAdmin();
  // Prefer the explicit platform partner if one is flagged.
  let { data } = await admin
    .from('tax_partner')
    .select('id, name, legal_name, npwp, email, phone, address, partner_type, is_active, settings')
    .eq('is_platform_partner', true)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!data) {
    // Fallback to the first active row.
    const res = await admin
      .from('tax_partner')
      .select('id, name, legal_name, npwp, email, phone, address, partner_type, is_active, settings')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    data = res.data;
  }
  return data;
}

function mergeApproval(stored: unknown): ApprovalSettings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<ApprovalSettings>;
  return {
    requireSupervisorApproval:
      typeof s.requireSupervisorApproval === 'boolean' ? s.requireSupervisorApproval : DEFAULT_APPROVAL.requireSupervisorApproval,
    allowRevisionAfterReject:
      typeof s.allowRevisionAfterReject === 'boolean' ? s.allowRevisionAfterReject : DEFAULT_APPROVAL.allowRevisionAfterReject,
    autoAdvanceToBilling:
      typeof s.autoAdvanceToBilling === 'boolean' ? s.autoAdvanceToBilling : DEFAULT_APPROVAL.autoAdvanceToBilling,
    slaMaxReviewDays:
      typeof s.slaMaxReviewDays === 'number' ? s.slaMaxReviewDays : DEFAULT_APPROVAL.slaMaxReviewDays,
    slaReminderHours:
      typeof s.slaReminderHours === 'number' ? s.slaReminderHours : DEFAULT_APPROVAL.slaReminderHours,
  };
}

function mergeChannels(stored: unknown): ChannelSettings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<ChannelSettings>;
  const out: ChannelSettings = { ...DEFAULT_CHANNELS };
  for (const key of Object.keys(DEFAULT_CHANNELS) as Array<keyof ChannelSettings>) {
    if (typeof s[key] === 'boolean') out[key] = s[key] as boolean;
  }
  return out;
}

const patchSchema = z.object({
  company: z
    .object({
      name: z.string().min(1).optional(),
      legalName: z.string().min(1).optional(),
      npwp: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  approval: z
    .object({
      requireSupervisorApproval: z.boolean().optional(),
      allowRevisionAfterReject: z.boolean().optional(),
      autoAdvanceToBilling: z.boolean().optional(),
      slaMaxReviewDays: z.number().int().min(0).max(30).optional(),
      slaReminderHours: z.number().int().min(0).max(720).optional(),
    })
    .optional(),
  channels: z
    .object({
      whatsApp: z.boolean().optional(),
      email: z.boolean().optional(),
      telegram: z.boolean().optional(),
      approvalPending: z.boolean().optional(),
      deadlineNearing: z.boolean().optional(),
      idBillingNtpn: z.boolean().optional(),
      revisionResubmit: z.boolean().optional(),
      legalityExpiry: z.boolean().optional(),
    })
    .optional(),
});

async function handleGet(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const partner = await getPlatformPartner();
  if (!partner) {
    return NextResponse.json({ error: 'No platform partner configured' }, { status: 404 });
  }
  const stored = (partner.settings ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    success: true,
    data: {
      company: {
        id: partner.id,
        name: partner.name,
        legalName: partner.legal_name,
        npwp: partner.npwp,
        email: partner.email,
        phone: partner.phone,
        address: partner.address,
        partnerType: partner.partner_type,
      },
      rbac: RBAC_MATRIX,
      approval: mergeApproval(stored.approval),
      security: SECURITY_DEFAULTS,
      channels: mergeChannels(stored.channels),
    },
  });
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { company, approval, channels } = parsed.data;
  const partner = await getPlatformPartner();
  if (!partner) {
    return NextResponse.json({ error: 'No platform partner configured' }, { status: 404 });
  }
  const admin = getSupabaseAdmin();

  // 1) tax_partner column updates (company fields).
  if (company) {
    const patch: Record<string, unknown> = {};
    if (company.name !== undefined) patch.name = company.name;
    if (company.legalName !== undefined) patch.legal_name = company.legalName;
    if (company.npwp !== undefined) patch.npwp = company.npwp;
    if (company.email !== undefined) patch.email = company.email;
    if (company.phone !== undefined) patch.phone = company.phone;
    if (company.address !== undefined) patch.address = company.address;
    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from('tax_partner').update(patch).eq('id', partner.id);
      if (error) {
        loggers.api.error({ err: error }, 'tax_partner column update failed');
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  // 2) tax_partner.settings JSONB updates (approval + channels).
  if (approval || channels) {
    const stored = (partner.settings ?? {}) as Record<string, unknown>;
    const nextSettings: Record<string, unknown> = { ...stored };
    if (approval) {
      const current = (stored.approval ?? {}) as Record<string, unknown>;
      nextSettings.approval = { ...current, ...approval };
    }
    if (channels) {
      const current = (stored.channels ?? {}) as Record<string, unknown>;
      nextSettings.channels = { ...current, ...channels };
    }
    const { error } = await admin
      .from('tax_partner')
      .update({ settings: nextSettings })
      .eq('id', partner.id);
    if (error) {
      loggers.api.error({ err: error }, 'tax_partner settings JSONB update failed');
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, data: { saved: true } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('SUPERVISOR_SETTINGS_PATCH'),
  )(request as unknown as RequestWithSession, handlePatch);
}
