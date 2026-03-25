import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import type { RequestWithSession, UserRole } from '@/types/auth';
import { EFakturService } from '@/lib/efaktur';
import type { CreateFakturRequest } from '@/lib/efaktur';

/**
 * GET /api/ppn/faktur - List Faktur Pajak
 */
async function handleList(request: RequestWithSession): Promise<Response> {
  const { session } = request;
  const { searchParams } = new URL(request.url);

  const customerId = session.customerId || searchParams.get('customerId');
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'Customer ID required' }, { status: 400 });
  }

  const result = await EFakturService.list(customerId, {
    transactionType: searchParams.get('type') || undefined,
    taxPeriod: searchParams.get('period') || undefined,
    status: searchParams.get('status') || undefined,
    page: Number(searchParams.get('page')) || 1,
    perPage: Number(searchParams.get('per_page')) || 20,
  });

  return NextResponse.json({ success: true, data: result.data, total: result.total });
}

/**
 * POST /api/ppn/faktur - Create new Faktur Pajak
 */
async function handleCreate(request: RequestWithSession): Promise<Response> {
  const { session } = request;
  const body = await request.json() as CreateFakturRequest & { customerId?: string };

  const customerId = session.customerId || body.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'Customer ID required' }, { status: 400 });
  }

  if (!body.items || body.items.length === 0) {
    return NextResponse.json({ success: false, error: 'At least one item required' }, { status: 400 });
  }

  const faktur = await EFakturService.create(customerId, body, session.consultantId);
  return NextResponse.json({ success: true, data: faktur }, { status: 201 });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole('CUSTOMER' as UserRole, 'CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole),
  )(request as RequestWithSession, handleList);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole('CUSTOMER' as UserRole, 'CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole),
    withAudit('FAKTUR_CREATE'),
  )(request as RequestWithSession, handleCreate);
}
