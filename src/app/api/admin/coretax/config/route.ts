/**
 * GET   /api/admin/coretax/config — SUPERVISOR/MASTER. Returns toggle state.
 * PATCH /api/admin/coretax/config — MASTER only. Body { enabled: boolean }.
 *
 * Track D: env CORETAX_SUBMIT_ENABLED 를 대체하는 DB-backed 토글. Master
 * flip 후 lib cache 즉시 invalidate + audit_log 에 CORETAX_TOGGLE 행
 * 기록 (Track C 의 manual recordAudit 패턴).
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
import { invalidateEnabledCache } from '@/lib/coretax/client';

const KEY = 'coretax.submit_enabled';

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
    .eq('key', KEY)
    .single();

  const headers = { 'Cache-Control': 'no-store' };
  if (error && error.code !== 'PGRST116') {
    loggers.api.error(
      { err: error.message, code: error.code, route: '/api/admin/coretax/config' },
      'coretax config select failed',
    );
    return NextResponse.json({ error: 'Failed to load Coretax config' }, { status: 500, headers });
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
    .eq('key', KEY)
    .single();
  if (selErr) {
    if (selErr.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'coretax.submit_enabled row not seeded' },
        { status: 500 },
      );
    }
    loggers.api.error(
      { err: selErr.message, code: selErr.code, route: '/api/admin/coretax/config' },
      'coretax config pre-update select failed',
    );
    return NextResponse.json({ error: 'Failed to update Coretax config' }, { status: 500 });
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
    .eq('key', KEY)
    .select('value, updated_by, updated_at')
    .single();
  if (updErr) {
    loggers.api.error(
      { err: updErr.message, code: updErr.code, route: '/api/admin/coretax/config' },
      'coretax config update failed',
    );
    return NextResponse.json({ error: 'Failed to update Coretax config' }, { status: 500 });
  }

  // 3. Invalidate per-instance cache so isEnabled() picks up the new value immediately
  invalidateEnabledCache();

  // 4. Audit row only if value actually changed (skip no-op PATCH)
  if (oldEnabled !== newEnabled) {
    await recordAudit({
      action: 'CORETAX_TOGGLE',
      actorUserId: req.session.userId,
      actorRole: req.session.role,
      details: { key: KEY, before: oldEnabled, after: newEnabled },
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
