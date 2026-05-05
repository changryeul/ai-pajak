import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const BUCKET = 'employee-photos';
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * POST /api/tax/employees/:id/photo  — multipart/form-data { file }
 *   Uploads the photo to Supabase Storage under
 *     customer/<customer_id>/employee/<employee_id>.<ext>
 *   and stores a signed URL on employee_payroll.photo_url.
 *
 * DELETE /api/tax/employees/:id/photo
 *   Removes the photo from storage and clears photo_url.
 */
async function handlePost(req: RequestWithSession, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const fd = await req.formData();
  const file = fd.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

  const mime = file.type || 'image/jpeg';
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: `Unsupported MIME type: ${mime}` }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  // Resolve customer_id from the employee row.
  const { data: emp } = await admin
    .from('employee_payroll')
    .select('customer_id')
    .eq('id', id)
    .maybeSingle();
  if (!emp?.customer_id) return NextResponse.json({ error: 'employee not found' }, { status: 404 });

  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const path = `customer/${emp.customer_id}/employee/${id}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Signed URL valid for 7 days; we re-issue on each load via /photo/sign.
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: signErr?.message || 'failed to sign URL' }, { status: 500 });
  }

  // Persist the storage path (not the signed URL) so we can reissue later.
  await admin.from('employee_payroll').update({ photo_url: path }).eq('id', id);

  return NextResponse.json({
    success: true,
    data: { path, signedUrl: signed.signedUrl },
  });
}

async function handleDelete(req: RequestWithSession, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: emp } = await admin
    .from('employee_payroll')
    .select('photo_url')
    .eq('id', id)
    .maybeSingle();

  const stored = emp?.photo_url;
  if (stored && !stored.startsWith('data:')) {
    await admin.storage.from(BUCKET).remove([stored]).catch(() => undefined);
  }
  await admin.from('employee_payroll').update({ photo_url: null }).eq('id', id);
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(
    request as RequestWithSession,
    (req) => handlePost(req, ctx),
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(
    request as RequestWithSession,
    (req) => handleDelete(req, ctx),
  );
}
