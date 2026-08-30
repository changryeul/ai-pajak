/**
 * MASTER CRUD for required_field_config — 고객 데이터 필수항목 레지스트리.
 *   GET    /api/admin/master/required-fields         (SUPERVISOR/MASTER 조회)
 *   POST   /api/admin/master/required-fields         (MASTER 추가)  {formKey, fieldKey, label, isRequired?}
 *   PATCH  /api/admin/master/required-fields?id=uuid (MASTER 변경)  {isRequired?, label?, sortOrder?}
 *   DELETE /api/admin/master/required-fields?id=uuid (MASTER 삭제)
 * (2026-08-30 필수항목 별표+입력유도 + 마스터 관리)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { recordAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole, type RequestWithSession } from '@/types/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORM_KEYS = ['company_profile', 'my_profile', 'pph23', 'ppn', 'payslip'] as const;

const createSchema = z.object({
  formKey: z.enum(FORM_KEYS),
  fieldKey: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/i, 'fieldKey: 영숫자/_ 만'),
  label: z.string().trim().min(1).max(120),
  isRequired: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional(),
});
const patchSchema = z.object({
  isRequired: z.boolean().optional(),
  label: z.string().trim().min(1).max(120).optional(),
  sortOrder: z.number().int().optional(),
}).refine(v => Object.values(v).some(x => x !== undefined), { message: '변경할 필드 필요' });

async function handleGet(_req: RequestWithSession): Promise<Response> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('required_field_config')
    .select('id, form_key, field_key, label, is_required, sort_order')
    .order('form_key', { ascending: true }).order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('required_field_config').insert({
    form_key: parsed.data.formKey, field_key: parsed.data.fieldKey, label: parsed.data.label,
    is_required: parsed.data.isRequired, sort_order: parsed.data.sortOrder ?? 99, updated_by: req.session.userId,
  }).select('id, form_key, field_key, label, is_required, sort_order').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '이미 존재하는 필드(form_key+field_key)' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await recordAudit({ action: 'REQUIRED_FIELD_UPDATE', actorUserId: req.session.userId, actorRole: req.session.role,
    details: { mutation: 'CREATE', after: data } });
  return NextResponse.json({ data }, { status: 201 });
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const id = new URL((req as unknown as NextRequest).url).searchParams.get('id');
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'id must be uuid' }, { status: 400 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const admin = getSupabaseAdmin();
  const patch: Record<string, unknown> = { updated_by: req.session.userId, updated_at: new Date().toISOString() };
  if (parsed.data.isRequired !== undefined) patch.is_required = parsed.data.isRequired;
  if (parsed.data.label !== undefined) patch.label = parsed.data.label;
  if (parsed.data.sortOrder !== undefined) patch.sort_order = parsed.data.sortOrder;
  const { data, error } = await admin.from('required_field_config').update(patch).eq('id', id)
    .select('id, form_key, field_key, label, is_required, sort_order').single();
  if (error) return NextResponse.json({ error: error.code === 'PGRST116' ? 'not found' : error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
  await recordAudit({ action: 'REQUIRED_FIELD_UPDATE', actorUserId: req.session.userId, actorRole: req.session.role,
    details: { mutation: 'UPDATE', id, after: data } });
  return NextResponse.json({ data });
}

async function handleDelete(req: RequestWithSession): Promise<Response> {
  const id = new URL((req as unknown as NextRequest).url).searchParams.get('id');
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'id must be uuid' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('required_field_config').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAudit({ action: 'REQUIRED_FIELD_UPDATE', actorUserId: req.session.userId, actorRole: req.session.role,
    details: { mutation: 'DELETE', id } });
  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER))(request as RequestWithSession, handleGet);
}
export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, requireRole(UserRole.TAX_OPERATOR_MASTER))(request as RequestWithSession, handlePost);
}
export async function PATCH(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, requireRole(UserRole.TAX_OPERATOR_MASTER))(request as RequestWithSession, handlePatch);
}
export async function DELETE(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, requireRole(UserRole.TAX_OPERATOR_MASTER))(request as RequestWithSession, handleDelete);
}
