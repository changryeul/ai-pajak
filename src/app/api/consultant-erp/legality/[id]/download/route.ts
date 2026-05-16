/**
 * GET /api/consultant-erp/legality/:id/download
 *   → 200 { signedUrl }
 *
 * Returns a Supabase Storage signed URL good for 5 minutes so the consultant
 * (or supervisor) can preview the original PDF / image / Excel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveConsultantContext } from '@/lib/consultant-erp/session-helpers';
import type { RequestWithSession } from '@/types/auth';

const BUCKET = 'consultant-erp-docs';
const TTL = 60 * 5; // 5 minutes

function getId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/legality\/([^/]+)\/download/);
  return m?.[1] ?? null;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const id = getId(req as unknown as NextRequest);
  if (!id) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const admin = getSupabaseAdmin();
  const { data: doc } = await admin
    .from('legality_document')
    .select('id, customer_id, storage_path, original_filename')
    .eq('id', id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Confirm scope
  const { data: ccs } = await admin
    .from('customer_consultant')
    .select('consultant_id')
    .eq('customer_id', doc.customer_id)
    .eq('is_active', true);
  const consultantIds = (ccs ?? []).map((c) => c.consultant_id);
  if (consultantIds.length === 0)
    return NextResponse.json({ error: 'No active assignment' }, { status: 403 });
  const { data: peers } = await admin
    .from('consultant')
    .select('id')
    .eq('tax_partner_id', ctx.taxPartnerId)
    .in('id', consultantIds);
  if (!peers || peers.length === 0)
    return NextResponse.json({ error: 'Out of scope' }, { status: 403 });

  if (!doc.storage_path) {
    return NextResponse.json({ error: 'No file stored' }, { status: 404 });
  }
  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, TTL);
  if (error || !signed) {
    return NextResponse.json({ error: error?.message ?? 'sign failed' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: { signedUrl: signed.signedUrl, filename: doc.original_filename, expiresIn: TTL },
  });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
