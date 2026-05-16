/**
 * GET  /api/consultant-erp/legality?customerId=
 *   → 200 { customers, documents }
 *     - customers: assigned to caller's tax_partner (for the dropdown)
 *     - documents: legality_document rows for the selected customer
 *
 * POST /api/consultant-erp/legality   (multipart/form-data)
 *   form fields:
 *     customerId, category, validUntil?, note?, file
 *   → 201 { documentId, storagePath, version }
 *
 *   Reuses the `consultant-erp-docs` bucket — path `legality/<customerId>/
 *   <category>/v<n>-<ts>-<safe>.<ext>`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveConsultantContext } from '@/lib/consultant-erp/session-helpers';
import type { RequestWithSession } from '@/types/auth';

const ALLOWED_CATEGORIES = new Set([
  'AKTA_PENDIRIAN',
  'AKTA_PERUBAHAN',
  'NIB_OSS',
  'LICENSE_SBU_SKK',
  'COMPANY_NPWP',
  'CORETAX_ACCESS',
]);
const STORAGE_BUCKET = 'consultant-erp-docs';

async function handleGet(req: RequestWithSession): Promise<Response> {
  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const url = new URL(req.url);
  const customerId = url.searchParams.get('customerId');

  const admin = getSupabaseAdmin();

  // 1) customers visible to caller's tax_partner (assignment join)
  const { data: peers } = await admin
    .from('consultant')
    .select('id')
    .eq('tax_partner_id', ctx.taxPartnerId);
  const peerIds = (peers ?? []).map((p) => p.id);
  const { data: assignments } = await admin
    .from('customer_consultant')
    .select('customer_id')
    .eq('is_active', true)
    .in('consultant_id', peerIds.length > 0 ? peerIds : ['00000000-0000-0000-0000-000000000000']);
  const customerIds = Array.from(new Set((assignments ?? []).map((a) => a.customer_id)));

  let customers: Array<{ id: string; full_name: string; company_name: string | null; npwp: string | null; customer_type: string }> = [];
  if (customerIds.length > 0) {
    const { data } = await admin
      .from('customer')
      .select('id, full_name, company_name, npwp, customer_type')
      .in('id', customerIds)
      .order('company_name', { ascending: true });
    customers = data ?? [];
  }

  // 2) documents (only when a customerId is provided AND it's in our scope)
  let documents: Array<unknown> = [];
  if (customerId && customerIds.includes(customerId)) {
    const { data } = await admin
      .from('legality_document')
      .select('*')
      .eq('customer_id', customerId)
      .order('uploaded_at', { ascending: false });
    documents = data ?? [];
  }

  return NextResponse.json({ success: true, data: { customers, documents } });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  }
  const customerId = String(formData.get('customerId') ?? '');
  const category = String(formData.get('category') ?? '');
  const validUntilRaw = formData.get('validUntil');
  const noteRaw = formData.get('note');
  const file = formData.get('file');

  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });
  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ error: `Unknown category ${category}` }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'file too large (20 MB max)' }, { status: 413 });
  }

  const admin = getSupabaseAdmin();

  // Confirm customer is within the consultant's tax_partner scope.
  const { data: assignment } = await admin
    .from('customer_consultant')
    .select('consultant_id')
    .eq('customer_id', customerId)
    .eq('is_active', true);
  const consultantIds = new Set((assignment ?? []).map((a) => a.consultant_id));
  const { data: scoped } = await admin
    .from('consultant')
    .select('id')
    .eq('tax_partner_id', ctx.taxPartnerId)
    .in('id', Array.from(consultantIds.size > 0 ? consultantIds : new Set(['00000000-0000-0000-0000-000000000000'])));
  if (!scoped || scoped.length === 0) {
    return NextResponse.json({ error: 'Customer is not in your tax_partner' }, { status: 403 });
  }

  // Latest version for this customer + category
  const { data: prev } = await admin
    .from('legality_document')
    .select('version')
    .eq('customer_id', customerId)
    .eq('category', category)
    .order('version', { ascending: false })
    .limit(1);
  const nextVersion = (prev?.[0]?.version ?? 0) + 1;
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const storagePath = `legality/${customerId}/${category}/v${nextVersion}-${Date.now()}-${safeName}`;

  const arrayBuf = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, new Uint8Array(arrayBuf), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 500 });

  const validUntil = typeof validUntilRaw === 'string' && validUntilRaw ? validUntilRaw : null;
  const note = typeof noteRaw === 'string' && noteRaw ? noteRaw : null;

  const { data, error } = await admin
    .from('legality_document')
    .insert({
      customer_id: customerId,
      category,
      is_required: category !== 'CORETAX_ACCESS', // 모두 필수, Coretax 접속정보는 선택
      storage_path: storagePath,
      original_filename: file.name,
      valid_until: validUntil,
      note,
      uploaded_by: ctx.userId,
      version: nextVersion,
    })
    .select('id, version')
    .single();
  if (error) {
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, data: { documentId: data.id, storagePath, version: nextVersion } },
    { status: 201 },
  );
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_LEGALITY_UPLOAD'),
  )(request as unknown as RequestWithSession, handlePost);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
