import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import type { RequestWithSession, UserRole } from '@/types/auth';
import { EFakturService } from '@/lib/efaktur';

/**
 * POST /api/ppn/faktur/[id] - Approve (issue serial number)
 */
async function handleApprove(request: RequestWithSession, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const faktur = await EFakturService.approve(id);
  return NextResponse.json({ success: true, data: faktur });
}

/**
 * DELETE /api/ppn/faktur/[id] - Void faktur
 */
async function handleVoid(request: RequestWithSession, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = await request.json() as { reason: string };

  if (!body.reason) {
    return NextResponse.json({ success: false, error: 'Void reason required' }, { status: 400 });
  }

  const faktur = await EFakturService.void_(id, body.reason);
  return NextResponse.json({ success: true, data: faktur });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole('CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole),
    withAudit('FAKTUR_APPROVE'),
  )(request as RequestWithSession, (req) => handleApprove(req, context));
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole('CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole),
    withAudit('FAKTUR_VOID'),
  )(request as RequestWithSession, (req) => handleVoid(req, context));
}
