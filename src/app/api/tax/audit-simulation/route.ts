/**
 * POST /api/tax/audit-simulation
 *
 * Two modes, dispatched by `mode`:
 *
 *   'prepare' — body: { scenarioId }
 *     Pulls the caller's SPT Tahunan filings, builds the dashboard trend,
 *     runs risk-detector to surface audit triggers specific to this
 *     customer, and returns a scenario prep bundle (risks, documents,
 *     predicted questions).
 *
 *   'turn' — body: { scenarioId, messages, lastResponse }
 *     Delegates to Anthropic for the next auditor follow-up question
 *     AND returns a deterministic per-turn score so the UI can annotate
 *     each taxpayer response without waiting on a second LLM call.
 *
 * Customer role only — their own data. Not available to advisors in this
 * endpoint (advisors can use /tax/audit-simulation directly with
 * manual input).
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import { buildDashboardTrend, type TrendFiling } from '@/lib/tax/trend-from-filings';
import {
  detectAuditRisks,
  evaluateTurn,
  type AuditScenarioId,
} from '@/lib/audit/risk-detector';

const VALID_SCENARIOS: AuditScenarioId[] = ['pph21', 'ppn', 'tp', 'umkm', 'general'];

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode as 'prepare' | 'turn';
    const scenarioId = body.scenarioId as AuditScenarioId;

    if (!VALID_SCENARIOS.includes(scenarioId)) {
      return NextResponse.json({ error: 'invalid_scenario' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { userId } = req.session;
    const { data: customer } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!customer) {
      return NextResponse.json({ error: 'customer_not_found' }, { status: 404 });
    }

    if (mode === 'prepare') {
      const { data: filings } = await admin
        .from('tax_filing')
        .select('id, tax_type, tax_period, status, tax_data, created_at')
        .eq('customer_id', customer.id)
        .eq('tax_type', 'SPT_TAHUNAN')
        .order('created_at', { ascending: false })
        .limit(10);
      const trend = buildDashboardTrend((filings as TrendFiling[]) || []);
      const prep = detectAuditRisks(trend, scenarioId);
      return NextResponse.json({ success: true, data: prep });
    }

    if (mode === 'turn') {
      const messages = (body.messages || []) as { role: 'auditor' | 'taxpayer'; content: string }[];
      const lastResponse = (body.lastResponse || '') as string;
      const score = evaluateTurn(lastResponse);

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          success: true,
          data: {
            score,
            auditorFollowup: 'Terima kasih. Pertanyaan lanjutan sementara tidak tersedia.',
            done: messages.length >= 8,
          },
        });
      }

      const anthropic = new Anthropic({ apiKey });
      const convo = messages
        .map((m) => `${m.role === 'auditor' ? 'Pemeriksa' : 'Wajib Pajak'}: ${m.content}`)
        .join('\n');
      const prompt = `Anda adalah pemeriksa pajak DJP dalam simulasi audit ${scenarioId}.
Lanjutkan pemeriksaan dengan SATU pertanyaan tindak lanjut yang spesifik (≤ 3 kalimat).
Setelah 5+ pertanyaan, berikan ringkasan kelemahan utama dan skor akhir 0-100.

Percakapan sejauh ini:
${convo}`;

      try {
        const resp = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = resp.content
          .map((b) => (b.type === 'text' ? b.text : ''))
          .join('\n')
          .trim();

        // Heuristic: once auditor gives "skor akhir" mark done.
        const done = /skor akhir|score\s*:\s*\d/i.test(text) || messages.length >= 10;
        return NextResponse.json({
          success: true,
          data: { score, auditorFollowup: text, done },
        });
      } catch (err) {
        loggers.api.warn({ err }, 'audit-simulation: anthropic call failed');
        return NextResponse.json({
          success: true,
          data: {
            score,
            auditorFollowup: 'Pemeriksa sedang menyusun pertanyaan lanjutan…',
            done: false,
          },
        });
      }
    }

    return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
  } catch (err) {
    loggers.api.error({ err }, 'audit-simulation POST error');
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handlePost);
}
