/**
 * End-to-end trend verification on prod with seed-then-cleanup:
 *  1. Seed 2 MONTHLY consultant_session rows (current month + previous month)
 *     for PT Example Indonesia (00000000-0000-0000-0000-000000000011)
 *  2. Seed one consultant_session_calc per session
 *  3. GET /supervisor/approval/:sessionId
 *  4. Assert trend.length=6, last 2 periods have totalCalc > 0, others 0
 *  5. Cleanup seed rows (calc → session)
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.production.local', override: true });

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const base = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';

const CUSTOMER_ID = '00000000-0000-0000-0000-000000000011'; // PT Example Indonesia
const CONSULTANT_ID = 'e9d88904-dd85-4082-800e-698a529aa69d';
const TAX_PARTNER_ID = '00000000-0000-0000-0000-000000000003';

const admin = createClient(url, serviceKey);

async function loginSupervisor() {
  const c = createClient(url, anon);
  const { data, error } = await c.auth.signInWithPassword({
    email: 'supervisor.test@aipajak.com',
    password: 'TestPassword123!',
  });
  if (error || !data.session) throw error || new Error('no session');
  return data.session.access_token;
}

function periodDate(monthsAgo: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

(async () => {
  const sessionIds: string[] = [];
  try {
    // Pre-cleanup — a previous run that crashed mid-script may have left
    // sessions behind. They'd collide with the unique
    // (customer_id, filing_kind, tax_period) constraint on re-run.
    const periods = [periodDate(0), periodDate(1)];
    const { data: stale } = await admin
      .from('consultant_session')
      .select('id')
      .eq('customer_id', CUSTOMER_ID)
      .eq('filing_kind', 'MONTHLY')
      .in('tax_period', periods);
    if (stale && stale.length > 0) {
      const staleIds = stale.map((s) => s.id);
      console.log(`0️⃣  Pre-cleanup ${staleIds.length} stale session(s) from prior runs`);
      await admin.from('consultant_session_calc').delete().in('session_id', staleIds);
      await admin.from('consultant_session').delete().in('id', staleIds);
    }

    console.log('1️⃣  Seed 2 MONTHLY sessions');
    for (const monthsAgo of [0, 1]) {
      const taxPeriod = periodDate(monthsAgo);
      const { data, error } = await admin
        .from('consultant_session')
        .insert({
          customer_id: CUSTOMER_ID,
          tax_partner_id: TAX_PARTNER_ID,
          consultant_id: CONSULTANT_ID,
          filing_kind: 'MONTHLY',
          tax_period: taxPeriod,
          status: monthsAgo === 0 ? 'PENDING_APPROVAL' : 'COMPLETED',
          current_step: monthsAgo === 0 ? 5 : 5,
        })
        .select('id')
        .single();
      if (error) throw error;
      sessionIds.push(data.id);
      console.log(`   ${taxPeriod} → ${data.id}`);
    }

    console.log('2️⃣  Seed calcs');
    const calcInserts = [
      { session_id: sessionIds[0], kind: 'PPH21_TER', amount: 5_000_000 },
      { session_id: sessionIds[0], kind: 'WITHHOLDING_SUMMARY', amount: 2_000_000 },
      { session_id: sessionIds[1], kind: 'PPH21_TER', amount: 4_500_000 },
      { session_id: sessionIds[1], kind: 'WITHHOLDING_SUMMARY', amount: 1_800_000 },
    ];
    const { error: calcErr } = await admin
      .from('consultant_session_calc')
      .insert(calcInserts);
    if (calcErr) throw calcErr;

    console.log('3️⃣  Login + GET approval detail');
    const token = await loginSupervisor();
    const r = await fetch(
      `${base}/api/consultant-erp/supervisor/approval/${sessionIds[0]}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) throw new Error(`detail ${r.status} ${await r.text()}`);
    const detail = await r.json();
    const trend = detail?.data?.trend;
    if (!Array.isArray(trend)) throw new Error('trend missing');
    if (trend.length !== 6) throw new Error(`trend length ${trend.length}, expected 6`);

    const last = trend[5];
    const prev = trend[4];
    if (last.totalCalc !== 7_000_000)
      throw new Error(`last totalCalc=${last.totalCalc}, expected 7,000,000`);
    if (prev.totalCalc !== 6_300_000)
      throw new Error(`prev totalCalc=${prev.totalCalc}, expected 6,300,000`);
    for (let i = 0; i < 4; i++) {
      if (trend[i].totalCalc !== 0)
        throw new Error(`trend[${i}] (${trend[i].period}) totalCalc should be 0`);
    }
    // byKind sanity for the current month.
    if (last.byKind.PPH21_TER !== 5_000_000)
      throw new Error(`byKind.PPH21_TER=${last.byKind.PPH21_TER}`);
    if (last.byKind.WITHHOLDING_SUMMARY !== 2_000_000)
      throw new Error(`byKind.WITHHOLDING_SUMMARY=${last.byKind.WITHHOLDING_SUMMARY}`);

    console.log(
      `   ✅ trend OK — periods ${trend.map((p: { period: string; totalCalc: number }) => `${p.period}:${p.totalCalc}`).join(' ')}`,
    );

    console.log('\n🎉 trend seed+verify PASS');
  } catch (e) {
    console.error('💥', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    console.log('\n🧹 Cleanup');
    if (sessionIds.length > 0) {
      await admin.from('consultant_session_calc').delete().in('session_id', sessionIds);
      await admin.from('consultant_session').delete().in('id', sessionIds);
      console.log(`   deleted ${sessionIds.length} sessions + their calcs`);
    }
  }
})();
