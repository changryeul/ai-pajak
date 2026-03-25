import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import type { RequestWithSession, UserRole } from '@/types/auth';
import { BulkFilingService } from '@/lib/bulk-filing';
import type { BulkFilingRequest } from '@/lib/bulk-filing';

/**
 * POST /api/tax/bulk - Create bulk draft filings
 * Only TAX_ADVISOR_JTC can use this
 */
async function handleBulkCreate(request: RequestWithSession): Promise<Response> {
  const { session } = request;

  if (!session.consultantId) {
    return NextResponse.json({ success: false, error: 'Consultant ID required' }, { status: 400 });
  }

  const body = await request.json() as BulkFilingRequest;

  if (!body.customerIds || body.customerIds.length === 0) {
    return NextResponse.json({ success: false, error: 'At least one customer required' }, { status: 400 });
  }

  if (body.customerIds.length > 50) {
    return NextResponse.json({ success: false, error: 'Maximum 50 customers per batch' }, { status: 400 });
  }

  if (!body.taxType || !body.taxPeriod || !body.taxYear) {
    return NextResponse.json({ success: false, error: 'taxType, taxPeriod, and taxYear required' }, { status: 400 });
  }

  const result = await BulkFilingService.createBulkDrafts(
    session.consultantId,
    session.userId,
    body,
  );

  return NextResponse.json({
    success: true,
    data: result,
    summary: {
      total: result.totalItems,
      success: result.completedItems,
      failed: result.failedItems,
      status: result.status,
    },
  }, { status: 201 });
}

/**
 * GET /api/tax/bulk - Get assigned customers for bulk selection
 */
async function handleGetCustomers(request: RequestWithSession): Promise<Response> {
  const { session } = request;
  const consultantId = session.consultantId;
  if (!consultantId) {
    return NextResponse.json({ success: false, error: 'Consultant ID required' }, { status: 400 });
  }

  const customers = await BulkFilingService.getAssignedCustomers(consultantId);

  return NextResponse.json({ success: true, data: customers });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole('TAX_ADVISOR_JTC' as UserRole),
    withAudit('BULK_FILING_CREATE'),
  )(request as RequestWithSession, handleBulkCreate);
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole('CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole),
  )(request as RequestWithSession, handleGetCustomers);
}
