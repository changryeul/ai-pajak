/**
 * GET /api/consultant-erp/supervisor/calendar?withinDays=60
 *   → { rows: CalendarEntry[] }
 *
 * 팀장용 ERP 마감 캘린더 (PDF p.18). Returns upcoming filing deadlines
 * across all customers sorted by daysToDeadline asc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { buildClosingCalendar } from '@/lib/consultant-erp/supervisor-views';
import { UserRole, type RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const url = new URL(req.url);
  const rawWithin = parseInt(url.searchParams.get('withinDays') ?? '', 10);
  const withinDays = Number.isFinite(rawWithin) && rawWithin > 0 && rawWithin <= 365 ? rawWithin : 60;
  const rows = await buildClosingCalendar({ withinDays });
  return NextResponse.json({ success: true, data: { rows } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
