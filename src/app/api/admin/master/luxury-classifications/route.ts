/**
 * MASTER CRUD for luxury_item_classifications (PMK 131/2024 분류 시드).
 *
 *   GET    /api/admin/master/luxury-classifications
 *     → 200 { data: LuxuryClassification[] }
 *     RBAC: TAX_OPERATOR_SUPERVISOR / TAX_OPERATOR_MASTER
 *
 *   POST   /api/admin/master/luxury-classifications
 *     body: { item_name, category, hs_code?, ppn_treatment?, legal_basis? }
 *     → 201 { data: LuxuryClassification }
 *     RBAC: TAX_OPERATOR_MASTER
 *     audit: LUXURY_CLASSIFICATION_UPDATE (action='CREATE')
 *
 *   PATCH  /api/admin/master/luxury-classifications?id=<uuid>
 *     body: partial of POST body (at least one field)
 *     → 200 { data: LuxuryClassification }
 *     RBAC: TAX_OPERATOR_MASTER
 *     audit: LUXURY_CLASSIFICATION_UPDATE (action='UPDATE', diff included)
 *
 *   DELETE /api/admin/master/luxury-classifications?id=<uuid>
 *     → 200 { data: { ok: true } }
 *     RBAC: TAX_OPERATOR_MASTER
 *     audit: LUXURY_CLASSIFICATION_UPDATE (action='DELETE', removed row included)
 *
 * Tax Code Rule (commit 4ec1a0e, Track B) 의 패턴을 차용:
 *   - composeMiddleware + requireRole 게이트
 *   - admin client 로 SELECT before → mutate → diff → recordAudit 직접 호출
 *   - 5xx 만 sentry, 4xx 는 응답만
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
import type { LuxuryClassification } from '@/types/luxury-classification';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTE = '/api/admin/master/luxury-classifications';

const categoryEnum = z.enum(['LUXURY', 'ESSENTIAL', 'SPECIAL']);

const createSchema = z.object({
  item_name:     z.string().trim().min(1, 'item_name required').max(255),
  hs_code:       z.string().trim().max(10).nullable().optional(),
  category:      categoryEnum,
  ppn_treatment: z.string().trim().max(500).nullable().optional(),
  legal_basis:   z.string().trim().max(100).nullable().optional(),
});

const patchSchema = z
  .object({
    item_name:     z.string().trim().min(1).max(255).optional(),
    hs_code:       z.string().trim().max(10).nullable().optional(),
    category:      categoryEnum.optional(),
    ppn_treatment: z.string().trim().max(500).nullable().optional(),
    legal_basis:   z.string().trim().max(100).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'at least one field is required',
  });

const PATCHABLE_FIELDS = [
  'item_name',
  'hs_code',
  'category',
  'ppn_treatment',
  'legal_basis',
] as const;

function ipFrom(req: RequestWithSession): string | null {
  return (
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    null
  );
}

function uaFrom(req: RequestWithSession): string | null {
  return req.headers.get('user-agent') || null;
}

// ── GET ─────────────────────────────────────────────────────────────────
async function handleGet(_req: RequestWithSession): Promise<Response> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('luxury_item_classifications')
    .select('*')
    .order('category', { ascending: true })
    .order('item_name', { ascending: true });

  const headers = { 'Cache-Control': 'no-store' };
  if (error) {
    loggers.api.error(
      { err: error.message, route: ROUTE, code: error.code },
      'luxury_item_classifications select failed',
    );
    return NextResponse.json(
      { error: 'Failed to load luxury classifications' },
      { status: 500, headers },
    );
  }
  return NextResponse.json(
    { data: (data ?? []) as LuxuryClassification[] },
    { headers },
  );
}

// ── POST ────────────────────────────────────────────────────────────────
async function handlePost(req: RequestWithSession): Promise<Response> {
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const insertRow = {
    item_name:     parsed.data.item_name,
    hs_code:       parsed.data.hs_code ?? null,
    category:      parsed.data.category,
    ppn_treatment: parsed.data.ppn_treatment ?? null,
    legal_basis:   parsed.data.legal_basis ?? null,
  };

  const { data: inserted, error } = await admin
    .from('luxury_item_classifications')
    .insert(insertRow)
    .select('*')
    .single();

  if (error || !inserted) {
    loggers.api.error(
      { err: error?.message, route: ROUTE, code: error?.code },
      'luxury_item_classifications insert failed',
    );
    return NextResponse.json(
      { error: 'Failed to create luxury classification' },
      { status: 500 },
    );
  }

  const row = inserted as LuxuryClassification;
  await recordAudit({
    action: 'LUXURY_CLASSIFICATION_UPDATE',
    actorUserId: req.session.userId,
    actorRole: req.session.role,
    details: { mutation: 'CREATE', id: row.id, after: row },
    ipAddress: ipFrom(req),
    userAgent: uaFrom(req),
  });

  return NextResponse.json({ data: row }, { status: 201 });
}

// ── PATCH ───────────────────────────────────────────────────────────────
async function handlePatch(req: RequestWithSession): Promise<Response> {
  const id = new URL((req as unknown as NextRequest).url).searchParams.get('id');
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'id query param must be uuid' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // 1. SELECT before — needed for diff capture in audit log.
  const { data: before, error: selErr } = await admin
    .from('luxury_item_classifications')
    .select('*')
    .eq('id', id)
    .single();
  if (selErr) {
    if (selErr.code === 'PGRST116') {
      return NextResponse.json({ error: 'classification not found' }, { status: 404 });
    }
    loggers.api.error(
      { err: selErr.message, route: ROUTE, code: selErr.code },
      'luxury_item_classifications pre-update select failed',
    );
    return NextResponse.json(
      { error: 'Failed to update classification' },
      { status: 500 },
    );
  }

  // 2. UPDATE. Normalize undefined → no-op, null → null.
  const patchRow: Record<string, unknown> = {};
  for (const k of PATCHABLE_FIELDS) {
    if (parsed.data[k] !== undefined) patchRow[k] = parsed.data[k];
  }
  const { data: after, error: updErr } = await admin
    .from('luxury_item_classifications')
    .update(patchRow)
    .eq('id', id)
    .select('*')
    .single();
  if (updErr || !after) {
    loggers.api.error(
      { err: updErr?.message, route: ROUTE, code: updErr?.code },
      'luxury_item_classifications update failed',
    );
    return NextResponse.json(
      { error: 'Failed to update classification' },
      { status: 500 },
    );
  }

  // 3. Compute diff — only fields that actually changed.
  const beforeRow = before as LuxuryClassification;
  const afterRow = after as LuxuryClassification;
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const k of PATCHABLE_FIELDS) {
    if (parsed.data[k] !== undefined && beforeRow[k] !== afterRow[k]) {
      diff[k] = { before: beforeRow[k], after: afterRow[k] };
    }
  }

  // 4. Audit only if a real change happened (skip no-op).
  if (Object.keys(diff).length > 0) {
    await recordAudit({
      action: 'LUXURY_CLASSIFICATION_UPDATE',
      actorUserId: req.session.userId,
      actorRole: req.session.role,
      details: { mutation: 'UPDATE', id, diff },
      ipAddress: ipFrom(req),
      userAgent: uaFrom(req),
    });
  }

  return NextResponse.json({ data: afterRow });
}

// ── DELETE ──────────────────────────────────────────────────────────────
async function handleDelete(req: RequestWithSession): Promise<Response> {
  const id = new URL((req as unknown as NextRequest).url).searchParams.get('id');
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'id query param must be uuid' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // 1. SELECT before — preserve in audit log so DELETE is reversible from log.
  const { data: before, error: selErr } = await admin
    .from('luxury_item_classifications')
    .select('*')
    .eq('id', id)
    .single();
  if (selErr) {
    if (selErr.code === 'PGRST116') {
      return NextResponse.json({ error: 'classification not found' }, { status: 404 });
    }
    loggers.api.error(
      { err: selErr.message, route: ROUTE, code: selErr.code },
      'luxury_item_classifications pre-delete select failed',
    );
    return NextResponse.json(
      { error: 'Failed to delete classification' },
      { status: 500 },
    );
  }

  // 2. DELETE
  const { error: delErr } = await admin
    .from('luxury_item_classifications')
    .delete()
    .eq('id', id);
  if (delErr) {
    loggers.api.error(
      { err: delErr.message, route: ROUTE, code: delErr.code },
      'luxury_item_classifications delete failed',
    );
    return NextResponse.json(
      { error: 'Failed to delete classification' },
      { status: 500 },
    );
  }

  await recordAudit({
    action: 'LUXURY_CLASSIFICATION_UPDATE',
    actorUserId: req.session.userId,
    actorRole: req.session.role,
    details: { mutation: 'DELETE', id, removed: before as LuxuryClassification },
    ipAddress: ipFrom(req),
    userAgent: uaFrom(req),
  });

  return NextResponse.json({ data: { ok: true } });
}

// ── exports ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_MASTER),
    // recordAudit called from handler so DB diff is included in details.
  )(request as RequestWithSession, handlePost);
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handlePatch);
}

export async function DELETE(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handleDelete);
}
