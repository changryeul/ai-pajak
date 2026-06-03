/**
 * MASTER CRUD for customer_ai_template (Phase 2.4 reply snippets).
 *
 *   GET    /api/admin/master/customer-ai-templates
 *     → 200 { data: CustomerAiTemplate[] }
 *     RBAC: TAX_OPERATOR_SUPERVISOR / TAX_OPERATOR_MASTER
 *
 *   POST   /api/admin/master/customer-ai-templates
 *     body: { title, body, category?, is_active?, display_order? }
 *     → 201 { data: CustomerAiTemplate }
 *     RBAC: TAX_OPERATOR_MASTER
 *     audit: CUSTOMER_AI_TEMPLATE_UPDATE (mutation='CREATE')
 *
 *   PATCH  /api/admin/master/customer-ai-templates?id=<uuid>
 *     body: partial of POST body (at least one field)
 *     → 200 { data: CustomerAiTemplate }
 *     RBAC: TAX_OPERATOR_MASTER
 *     audit: CUSTOMER_AI_TEMPLATE_UPDATE (mutation='UPDATE', diff)
 *
 *   DELETE /api/admin/master/customer-ai-templates?id=<uuid>
 *     → 200 { data: { ok: true } }
 *     RBAC: TAX_OPERATOR_MASTER
 *     audit: CUSTOMER_AI_TEMPLATE_UPDATE (mutation='DELETE', removed row)
 *
 * Mirrors luxury-classifications/route.ts (commit f242e9f).
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
import type { CustomerAiTemplate } from '@/types/customer-ai-template';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTE = '/api/admin/master/customer-ai-templates';

const createSchema = z.object({
  title:         z.string().trim().min(1, 'title required').max(120),
  body:          z.string().trim().min(1, 'body required'),
  category:      z.string().trim().max(40).nullable().optional(),
  is_active:     z.boolean().optional(),
  display_order: z.number().int().optional(),
});

const patchSchema = z
  .object({
    title:         z.string().trim().min(1).max(120).optional(),
    body:          z.string().trim().min(1).optional(),
    category:      z.string().trim().max(40).nullable().optional(),
    is_active:     z.boolean().optional(),
    display_order: z.number().int().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'at least one field is required',
  });

const PATCHABLE_FIELDS = [
  'title',
  'body',
  'category',
  'is_active',
  'display_order',
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
    .from('customer_ai_template')
    .select('*')
    .order('display_order', { ascending: true })
    .order('title', { ascending: true });

  const headers = { 'Cache-Control': 'no-store' };
  if (error) {
    loggers.api.error(
      { err: error.message, route: ROUTE, code: error.code },
      'customer_ai_template select failed',
    );
    return NextResponse.json(
      { error: 'Failed to load templates' },
      { status: 500, headers },
    );
  }
  return NextResponse.json(
    { data: (data ?? []) as CustomerAiTemplate[] },
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
    title:         parsed.data.title,
    body:          parsed.data.body,
    category:      parsed.data.category ?? null,
    is_active:     parsed.data.is_active ?? true,
    display_order: parsed.data.display_order ?? 0,
  };

  const { data: inserted, error } = await admin
    .from('customer_ai_template')
    .insert(insertRow)
    .select('*')
    .single();

  if (error || !inserted) {
    loggers.api.error(
      { err: error?.message, route: ROUTE, code: error?.code },
      'customer_ai_template insert failed',
    );
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 },
    );
  }

  const row = inserted as CustomerAiTemplate;
  await recordAudit({
    action: 'CUSTOMER_AI_TEMPLATE_UPDATE',
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

  // 1. SELECT before — for diff capture in audit log.
  const { data: before, error: selErr } = await admin
    .from('customer_ai_template')
    .select('*')
    .eq('id', id)
    .single();
  if (selErr) {
    if (selErr.code === 'PGRST116') {
      return NextResponse.json({ error: 'template not found' }, { status: 404 });
    }
    loggers.api.error(
      { err: selErr.message, route: ROUTE, code: selErr.code },
      'customer_ai_template pre-update select failed',
    );
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 },
    );
  }

  // 2. UPDATE.
  const patchRow: Record<string, unknown> = {};
  for (const k of PATCHABLE_FIELDS) {
    if (parsed.data[k] !== undefined) patchRow[k] = parsed.data[k];
  }
  const { data: after, error: updErr } = await admin
    .from('customer_ai_template')
    .update(patchRow)
    .eq('id', id)
    .select('*')
    .single();
  if (updErr || !after) {
    loggers.api.error(
      { err: updErr?.message, route: ROUTE, code: updErr?.code },
      'customer_ai_template update failed',
    );
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 },
    );
  }

  // 3. Diff.
  const beforeRow = before as CustomerAiTemplate;
  const afterRow = after as CustomerAiTemplate;
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const k of PATCHABLE_FIELDS) {
    if (parsed.data[k] !== undefined && beforeRow[k] !== afterRow[k]) {
      diff[k] = { before: beforeRow[k], after: afterRow[k] };
    }
  }

  // 4. Audit only on real change.
  if (Object.keys(diff).length > 0) {
    await recordAudit({
      action: 'CUSTOMER_AI_TEMPLATE_UPDATE',
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

  // 1. SELECT before — preserve in audit so DELETE is reversible from log.
  const { data: before, error: selErr } = await admin
    .from('customer_ai_template')
    .select('*')
    .eq('id', id)
    .single();
  if (selErr) {
    if (selErr.code === 'PGRST116') {
      return NextResponse.json({ error: 'template not found' }, { status: 404 });
    }
    loggers.api.error(
      { err: selErr.message, route: ROUTE, code: selErr.code },
      'customer_ai_template pre-delete select failed',
    );
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 },
    );
  }

  // 2. DELETE.
  const { error: delErr } = await admin
    .from('customer_ai_template')
    .delete()
    .eq('id', id);
  if (delErr) {
    loggers.api.error(
      { err: delErr.message, route: ROUTE, code: delErr.code },
      'customer_ai_template delete failed',
    );
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 },
    );
  }

  await recordAudit({
    action: 'CUSTOMER_AI_TEMPLATE_UPDATE',
    actorUserId: req.session.userId,
    actorRole: req.session.role,
    details: { mutation: 'DELETE', id, removed: before as CustomerAiTemplate },
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
