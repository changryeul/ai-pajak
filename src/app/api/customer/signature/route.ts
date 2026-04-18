/**
 * POST /api/customer/signature
 *
 * Accepts a base64 PNG data URL from the canvas signature pad, uploads it to
 * Supabase Storage under `signatures/<customer_id>/<uuid>.png`, and records
 * an immutable row in `signature_audit` with SHA256 + IP + UA per UU ITE
 * 11/2008 minimum-viable evidence (see 2026-04-18 /plan-eng-review outside
 * voice decision #2).
 *
 * Body: { purpose: 'POA_MANDATE' | 'SPT_SUBMISSION' | 'PROFILE_CHANGE' | 'OTHER',
 *         dataUrl: string }
 *
 * Returns: { signatureAuditId, storagePath, hashSha256 }
 *
 * Future: when PSrE (Privy/VIDA) integration arrives (T-009), this endpoint
 * will accept `provider: 'privy'` + the provider transaction id and skip the
 * canvas upload path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';

const BUCKET = 'signatures';
const MAX_BYTES = 1_000_000; // 1 MB

const bodySchema = z.object({
  purpose: z.enum(['POA_MANDATE', 'SPT_SUBMISSION', 'PROFILE_CHANGE', 'OTHER']),
  dataUrl: z.string().startsWith('data:image/png;base64,'),
  poaId: z.string().uuid().optional(),
});

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; size: number } {
  const commaIdx = dataUrl.indexOf(',');
  const b64 = dataUrl.slice(commaIdx + 1);
  const buffer = Buffer.from(b64, 'base64');
  return { buffer, size: buffer.length };
}

async function sha256Hex(buffer: Buffer): Promise<string> {
  // Node Buffer is an ArrayBufferView; Web Crypto wants a BufferSource. Pass
  // the underlying ArrayBuffer slice that Buffer wraps.
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function handleSignature(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }
    const { purpose, dataUrl, poaId } = parsed.data;

    const { userId } = req.session;
    const admin = getSupabaseAdmin();

    // Resolve customer_id from auth.uid
    const { data: customer } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'customer_not_found' },
        { status: 404 }
      );
    }

    const { buffer, size } = dataUrlToBuffer(dataUrl);
    if (size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'signature_too_large' },
        { status: 413 }
      );
    }
    if (size < 200) {
      // Guard against obviously empty / single-pixel canvas uploads
      return NextResponse.json(
        { success: false, error: 'signature_too_small' },
        { status: 400 }
      );
    }

    const hashSha256 = await sha256Hex(buffer);
    const storagePath = `${customer.id}/${hashSha256}-${Date.now()}.png`;

    // Upload to Supabase Storage (admin client bypasses RLS; ops created
    // bucket policy per migration comment).
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadErr) {
      loggers.api.error({ err: uploadErr, customerId: customer.id }, 'signature upload failed');
      return NextResponse.json(
        { success: false, error: 'upload_failed' },
        { status: 500 }
      );
    }

    // Evidence metadata from the request
    const xfwd = req.headers.get('x-forwarded-for');
    const ip = xfwd ? xfwd.split(',')[0].trim() : null;
    const userAgent = req.headers.get('user-agent');

    const { data: auditRow, error: auditErr } = await admin
      .from('signature_audit')
      .insert({
        customer_id: customer.id,
        purpose,
        signature_sha256: hashSha256,
        ip_address: ip,
        user_agent: userAgent,
        storage_path: storagePath,
        byte_size: size,
        external_provider: 'canvas',
        poa_id: poaId ?? null,
      })
      .select('id')
      .single();

    if (auditErr || !auditRow) {
      loggers.api.error({ err: auditErr, customerId: customer.id }, 'signature_audit insert failed');
      // Best-effort cleanup: delete the uploaded blob so we do not leak files without audit
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      return NextResponse.json(
        { success: false, error: 'audit_failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        signatureAuditId: auditRow.id,
        storagePath,
        hashSha256,
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'signature endpoint exception');
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
    withAudit('SIGNATURE_SUBMIT'),
  )(request as RequestWithSession, handleSignature);
}
