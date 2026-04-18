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
import {
  resolveSignatureProvider,
  availableSignatureProviders,
} from '@/lib/signature/providers';

const BUCKET = 'signatures';

const bodySchema = z.object({
  purpose: z.enum(['POA_MANDATE', 'SPT_SUBMISSION', 'PROFILE_CHANGE', 'OTHER']),
  dataUrl: z.string().startsWith('data:image/png;base64,').optional(),
  providerRef: z.string().min(1).optional(),
  provider: z.enum(['canvas', 'privy', 'vida']).optional().default('canvas'),
  poaId: z.string().uuid().optional(),
});

async function handleSignature(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }
    const { purpose, dataUrl, providerRef, provider: requestedProvider, poaId } = parsed.data;

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

    // Resolve the requested provider with automatic fallback to canvas.
    const { provider, used, degraded } = resolveSignatureProvider(requestedProvider);

    // Build the provider-shaped input. Canvas needs dataUrl; PSrE needs providerRef.
    const input =
      used === 'canvas'
        ? { kind: 'canvas' as const, dataUrl: dataUrl ?? '' }
        : { kind: 'psre' as const, providerRef: providerRef ?? '' };

    if (used === 'canvas' && !dataUrl) {
      return NextResponse.json(
        { success: false, error: 'dataUrl_required' },
        { status: 400 }
      );
    }
    if (used !== 'canvas' && !providerRef) {
      return NextResponse.json(
        { success: false, error: 'providerRef_required' },
        { status: 400 }
      );
    }

    // Evidence metadata from the request
    const xfwd = req.headers.get('x-forwarded-for');
    const ip = xfwd ? xfwd.split(',')[0].trim() : null;
    const userAgent = req.headers.get('user-agent');

    let signResult;
    try {
      signResult = await provider.sign({
        customerId: customer.id,
        purpose,
        input,
        meta: { ipAddress: ip, userAgent },
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'sign_failed';
      loggers.api.error({ err, customerId: customer.id, used }, 'provider.sign failed');
      const status =
        code === 'signature_too_large' ? 413
        : code === 'signature_too_small' ? 400
        : code === 'not_configured' ? 503
        : code === 'not_implemented' ? 501
        : 500;
      return NextResponse.json({ success: false, error: code }, { status });
    }

    const { data: auditRow, error: auditErr } = await admin
      .from('signature_audit')
      .insert({
        customer_id: customer.id,
        purpose,
        signature_sha256: signResult.hashSha256,
        ip_address: ip,
        user_agent: userAgent,
        storage_path: signResult.storagePath,
        byte_size: signResult.byteSize,
        external_provider: signResult.provider,
        external_ref: signResult.externalRef,
        poa_id: poaId ?? null,
      })
      .select('id')
      .single();

    if (auditErr || !auditRow) {
      loggers.api.error({ err: auditErr, customerId: customer.id }, 'signature_audit insert failed');
      // Best-effort cleanup: delete the uploaded blob so we do not leak files without audit.
      if (signResult.storagePath) {
        await admin.storage.from(BUCKET).remove([signResult.storagePath]).catch(() => {});
      }
      return NextResponse.json(
        { success: false, error: 'audit_failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        signatureAuditId: auditRow.id,
        storagePath: signResult.storagePath,
        hashSha256: signResult.hashSha256,
        provider: signResult.provider,
        externalRef: signResult.externalRef,
        degraded,
        requestedProvider,
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'signature endpoint exception');
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

async function handleAvailable(_req: RequestWithSession): Promise<Response> {
  // Surfaces which providers are usable so the mandate UI can show
  // Privy/VIDA options when configured and fall back to canvas otherwise.
  return NextResponse.json({
    success: true,
    data: {
      providers: availableSignatureProviders(),
    },
  });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handleAvailable);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
    withAudit('SIGNATURE_SUBMIT'),
  )(request as RequestWithSession, handleSignature);
}
