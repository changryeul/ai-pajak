/**
 * POST /api/consultant-erp/counterparty/match
 *   body: { npwp }
 *   → 200 CounterpartyMatch (see counterparty-matcher.ts)
 *
 * Used by the parse-review panel when a withholding invoice row arrives
 * with a counterparty NPWP — surfaces trust, suggested PPh, and DGT-Form
 * signals without a full counterparty page open.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { matchByNpwp } from '@/lib/consultant-erp/counterparty-matcher';
import type { RequestWithSession } from '@/types/auth';

const schema = z.object({ npwp: z.string().min(1) });

async function handlePost(req: RequestWithSession): Promise<Response> {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const match = await matchByNpwp(parsed.data.npwp);
  return NextResponse.json({ success: true, data: match });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handlePost);
}
