/**
 * GET /api/consultant-erp/sessions/board
 *
 * Returns the board payload for the calling user, with two shapes:
 *   - CONSULTANT mode: customer-by-customer with the latest session for each.
 *   - SUPERVISOR mode: platform-wide list of recent sessions across all
 *     tax_partners. Optional `?status=PENDING_APPROVAL` filter so the
 *     supervisor can drill into their approval queue.
 *
 * The `mode` discriminator lets the UI render the right view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import {
  resolveConsultantContext,
  buildBoardForConsultant,
  buildBoardForSupervisor,
} from '@/lib/consultant-erp/session-helpers';
import type { RequestWithSession } from '@/types/auth';

const ALLOWED_STATUS = new Set([
  'DRAFT',
  'UPLOADING',
  'PARSING',
  'REVIEWING',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
]);

async function handleGet(req: RequestWithSession): Promise<Response> {
  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) {
    return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });
  }

  if (ctx.isSupervisor) {
    const url = new URL((req as unknown as NextRequest).url);
    const rawStatus = url.searchParams.get('status');
    const statusFilter = rawStatus && ALLOWED_STATUS.has(rawStatus) ? rawStatus : undefined;
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 500 ? rawLimit : 100;

    const data = await buildBoardForSupervisor({ statusFilter, limit });
    return NextResponse.json({
      success: true,
      data: { mode: 'SUPERVISOR' as const, ...data },
    });
  }

  const data = await buildBoardForConsultant(ctx);
  return NextResponse.json({
    success: true,
    data: { mode: 'CONSULTANT' as const, ...data },
  });
}

export async function GET(request: Request) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
