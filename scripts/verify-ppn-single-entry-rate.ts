/**
 * Verify POST /api/tax/ppn-faktur-monthly preserves body.ppn (UI-side calc)
 * and falls back to 12% when ppn is omitted.
 *
 * Run after fixing the 0.11 hard-code so the single-entry path matches the
 * bulk-import path (both PMK 131/2024 12%).
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-ppn-single-entry-rate.ts
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`✗ ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const BASE_URL =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = 'company.test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const PERIOD = '2026-99'; // sentinel; cleanup afterwards

async function main() {
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: auth, error } = await sbAnon.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (error || !auth.session) { console.error('✗ login:', error?.message); process.exit(1); }
  const token = auth.session.access_token;
  const { data: cust } = await sbAdmin.from('customer').select('id').eq('user_id', auth.user!.id).maybeSingle();
  if (!cust) { console.error('✗ no customer'); process.exit(1); }

  // Pre-cleanup
  await sbAdmin.from('ppn_faktur_monthly').delete().eq('customer_id', cust.id).eq('tax_period', PERIOD);

  const post = (body: Record<string, unknown>) => fetch(`${BASE_URL}/api/tax/ppn-faktur-monthly`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: cust.id, taxPeriod: PERIOD, fakturType: 'KELUARAN', fakturDate: '2026-01-15', counterpartyName: 'TEST', ...body }),
  });

  let pass = 0, fail = 0;

  // 1. body.ppn 전달 시 그 값 그대로 저장
  const r1 = await post({ dpp: 1000000, ppn: 123456 });
  const j1 = await r1.json();
  if (j1.success && j1.data?.ppn === 123456) { console.log(`✅ 1. body.ppn preserved → ${j1.data.ppn}`); pass++; }
  else { console.error('✗ 1.', j1); fail++; }

  // 2. body.ppn 없으면 dpp × 0.12 fallback
  const r2 = await post({ dpp: 1000000, fakturNumber: 'NO-PPN' });
  const j2 = await r2.json();
  if (j2.success && j2.data?.ppn === 120000) { console.log(`✅ 2. fallback 12% → ${j2.data.ppn}`); pass++; }
  else { console.error('✗ 2.', j2); fail++; }

  // 3. body.ppn=0 도 fallback (옛 hard-code 였으면 0 으로 저장됨)
  const r3 = await post({ dpp: 500000, ppn: 0, fakturNumber: 'ZERO-PPN' });
  const j3 = await r3.json();
  if (j3.success && j3.data?.ppn === 60000) { console.log(`✅ 3. ppn=0 → fallback ${j3.data.ppn}`); pass++; }
  else { console.error('✗ 3.', j3); fail++; }

  // 4. body.dppNilaiLain 전달 시 그 값 그대로 저장 (Phase 3.1)
  const r4 = await post({ dpp: 1200000, dppNilaiLain: 1100000, ppn: 132000, fakturNumber: 'DPPNL-EXPLICIT' });
  const j4 = await r4.json();
  if (j4.success && Number(j4.data?.dpp_nilai_lain) === 1100000) { console.log(`✅ 4. body.dppNilaiLain preserved → ${j4.data.dpp_nilai_lain}`); pass++; }
  else { console.error('✗ 4.', j4); fail++; }

  // 5. body.dppNilaiLain 없으면 PPNCalculator.adjustDPP fallback (essential, 2026 → ×11/12)
  const r5 = await post({ dpp: 1200000, fakturDate: '2026-03-15', fakturNumber: 'DPPNL-FALLBACK' });
  const j5 = await r5.json();
  const expected = Math.round(1200000 * (11 / 12));
  if (j5.success && Number(j5.data?.dpp_nilai_lain) === expected) { console.log(`✅ 5. fallback adjustDPP → ${j5.data.dpp_nilai_lain}`); pass++; }
  else { console.error(`✗ 5. expected ${expected}, got ${j5.data?.dpp_nilai_lain}`, j5); fail++; }

  // cleanup
  await sbAdmin.from('ppn_faktur_monthly').delete().eq('customer_id', cust.id).eq('tax_period', PERIOD);

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
