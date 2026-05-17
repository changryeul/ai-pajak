/**
 * GET /api/consultant-erp/counterparty/stats
 *   → { totalRegistered, avgTrust, pendingCandidates, needsEvidence, verified }
 *
 * Aggregate strip for the 공동 거래처 DB 상단 (PDF p.5 of the 팀장용 ERP
 * + matches the existing 직원용 'Counterparty Master' card).
 *
 *   - totalRegistered  = COUNT(counterparty_master)
 *   - avgTrust         = AVG(overall_trust)
 *   - pendingCandidates = COUNT(counterparty_update_candidate WHERE status='PROPOSED')
 *   - needsEvidence    = COUNT(counterparty_master WHERE overall_trust < 40)
 *   - verified         = COUNT(counterparty_master WHERE overall_trust >= 80)
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

async function handleGet(_req: RequestWithSession): Promise<Response> {
  try {
    const admin = getSupabaseAdmin();

    const [totalRes, candidateRes, lowRes, highRes, trustRes] = await Promise.all([
      admin.from('counterparty_master').select('id', { count: 'exact', head: true }),
      admin
        .from('counterparty_update_candidate')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PROPOSED'),
      admin
        .from('counterparty_master')
        .select('id', { count: 'exact', head: true })
        .lt('overall_trust', 40),
      admin
        .from('counterparty_master')
        .select('id', { count: 'exact', head: true })
        .gte('overall_trust', 80),
      admin.from('counterparty_master').select('overall_trust').limit(1000),
    ]);

    const trusts = (trustRes.data ?? [])
      .map((r) => Number(r.overall_trust))
      .filter((n) => Number.isFinite(n));
    const avgTrust = trusts.length
      ? Math.round(trusts.reduce((s, n) => s + n, 0) / trusts.length)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalRegistered: totalRes.count ?? 0,
        avgTrust,
        pendingCandidates: candidateRes.count ?? 0,
        needsEvidence: lowRes.count ?? 0,
        verified: highRes.count ?? 0,
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'counterparty stats failed');
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
