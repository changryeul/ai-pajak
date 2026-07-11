/**
 * GET   /api/admin/security/operator-mfa — SUPERVISOR/MASTER. Returns toggle state.
 * PATCH /api/admin/security/operator-mfa — MASTER only. Body { enabled: boolean }.
 *
 * 운영팀 2FA 강제 토글 (manuals/04 §2FA 필수 이행). Track D 의
 * /api/admin/coretax/config 와 동일한 계약: DB-backed system_setting row,
 * flip 후 lib cache invalidate + audit_log 에 OPERATOR_MFA_TOGGLE 기록.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { recordAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import { SETTING_KEY, invalidateOperatorMfaCache } from '@/lib/security/operator-mfa';

interface ConfigDTO {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

async function handleGet(_req: RequestWithSession): Promise<Response> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('system_setting')
    .select('value, updated_by, updated_at')
    .eq('key', SETTING_KEY)
    .single();

  const headers = { 'Cache-Control': 'no-store' };
  if (error && error.code !== 'PGRST116') {
    loggers.api.error(
      { err: error.message, code: error.code, route: '/api/admin/security/operator-mfa' },
      'operator-mfa config select failed',
    );
    return NextResponse.json({ error: 'Failed to load operator MFA config' }, { status: 500, headers });
  }
  const dto: ConfigDTO = {
    enabled: (data?.value as { enabled?: boolean } | undefined)?.enabled === true,
    updatedAt: data?.updated_at ?? null,
    updatedBy: data?.updated_by ?? null,
  };
  return NextResponse.json({ data: dto }, { headers });
}

const patchSchema = z.object({ enabled: z.boolean() });

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // 1. SELECT before — for audit diff
  const { data: before, error: selErr } = await admin
    .from('system_setting')
    .select('value')
    .eq('key', SETTING_KEY)
    .single();
  if (selErr) {
    if (selErr.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'security.operator_mfa_required row not seeded' },
        { status: 500 },
      );
    }
    loggers.api.error(
      { err: selErr.message, code: selErr.code, route: '/api/admin/security/operator-mfa' },
      'operator-mfa config pre-update select failed',
    );
    return NextResponse.json({ error: 'Failed to update operator MFA config' }, { status: 500 });
  }
  const oldEnabled = (before?.value as { enabled?: boolean } | undefined)?.enabled === true;
  const newEnabled = parsed.data.enabled;

  // 2. UPDATE
  const { data: after, error: updErr } = await admin
    .from('system_setting')
    .update({
      value: { enabled: newEnabled },
      updated_by: req.session.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('key', SETTING_KEY)
    .select('value, updated_by, updated_at')
    .single();
  if (updErr) {
    loggers.api.error(
      { err: updErr.message, code: updErr.code, route: '/api/admin/security/operator-mfa' },
      'operator-mfa config update failed',
    );
    return NextResponse.json({ error: 'Failed to update operator MFA config' }, { status: 500 });
  }

  // 3. Invalidate per-instance cache so checkOperatorMfaGate() picks up the new value immediately
  invalidateOperatorMfaCache();

  // 4. Audit row only if value actually changed (skip no-op PATCH)
  if (oldEnabled !== newEnabled) {
    await recordAudit({
      action: 'OPERATOR_MFA_TOGGLE',
      actorUserId: req.session.userId,
      actorRole: req.session.role,
      details: { key: SETTING_KEY, before: oldEnabled, after: newEnabled },
      ipAddress:
        req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        null,
      userAgent: req.headers.get('user-agent') || null,
    });
  }

  const dto: ConfigDTO = {
    enabled: (after?.value as { enabled?: boolean } | undefined)?.enabled === true,
    updatedAt: after?.updated_at ?? null,
    updatedBy: after?.updated_by ?? null,
  };
  return NextResponse.json({ data: dto });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handleGet);
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handlePatch);
}
