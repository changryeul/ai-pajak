/**
 * buildCustomerTrend smoke check:
 *  - login as supervisor
 *  - GET /sessions/board to find any session id
 *  - GET /supervisor/approval/:sessionId
 *  - assert `trend` is present
 *  - MONTHLY filings → 6 points with valid shape
 *  - ANNUAL filings   → empty array (we intentionally skip)
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.production.local', override: true });

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const base = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';

async function login() {
  const client = createClient(url, anon);
  const { data, error } = await client.auth.signInWithPassword({
    email: 'supervisor.test@aipajak.com',
    password: 'TestPassword123!',
  });
  if (error || !data.session) throw error || new Error('no session');
  return data.session.access_token;
}

(async () => {
  console.log('🔐 Login...');
  const token = await login();

  console.log('1️⃣  Fetch sessions/board to find a real session id');
  const r = await fetch(`${base}/api/consultant-erp/sessions/board`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`board ${r.status}`);
  const board = await r.json();
  const rows: Array<{ sessionId: string | null }> = board?.data?.rows ?? [];
  const sessionId = rows.find((row) => row.sessionId)?.sessionId;
  if (!sessionId) {
    console.log('⏭️  No session on prod — skipping (trend has nothing to assert against)');
    process.exit(0);
  }
  console.log(`   pick: ${sessionId}`);

  console.log('2️⃣  GET /supervisor/approval/:sessionId');
  const detailRes = await fetch(
    `${base}/api/consultant-erp/supervisor/approval/${sessionId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!detailRes.ok) throw new Error(`detail ${detailRes.status}`);
  const detail = await detailRes.json();
  const trend = detail?.data?.trend;
  const session = detail?.data?.session;

  if (!Array.isArray(trend)) throw new Error('trend missing or not array');
  if (session.filing_kind === 'MONTHLY') {
    if (trend.length !== 6) throw new Error(`MONTHLY expected 6 points, got ${trend.length}`);
    for (const p of trend) {
      if (!/^\d{4}-\d{2}$/.test(p.period)) throw new Error(`bad period: ${p.period}`);
      if (typeof p.totalCalc !== 'number') throw new Error(`bad totalCalc on ${p.period}`);
      if (typeof p.byKind !== 'object' || p.byKind === null) throw new Error(`bad byKind on ${p.period}`);
    }
    console.log(`   ✅ MONTHLY trend OK — periods: ${trend.map((p: { period: string }) => p.period).join(', ')}`);
  } else {
    if (trend.length !== 0) throw new Error(`ANNUAL expected empty trend, got ${trend.length}`);
    console.log(`   ✅ ANNUAL → empty trend (skipped as designed)`);
  }

  console.log('\n🎉 supervisor trend smoke PASS');
})().catch((e) => {
  console.error('💥', e.message);
  process.exit(1);
});
