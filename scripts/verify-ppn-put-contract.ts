/**
 * Verify PUT /api/tax/ppn-faktur-monthly contract:
 *   - body field updates: counterparty / faktur no / faktur date / type
 *   - dpp change → server: ppn = round(dpp × 0.12) if ppn not in body
 *   - dpp change → server: dpp_nilai_lain via PPNCalculator.adjustDPP if not in body
 *   - explicit ppn / dppNilaiLain in body win (no fallback overwrite)
 *   - isLuxury=true → adjustDPP returns dpp unchanged (no 11/12)
 *
 * Mirrors verify-ppn-single-entry-rate.ts pattern. Sentinel tax_period '2026-99'.
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-ppn-put-contract.ts
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
const PERIOD = '2026-99'; // sentinel — cleanup after

async function main() {
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (authErr || !auth.session) { console.error('✗ login:', authErr?.message); process.exit(1); }
  const token = auth.session.access_token;
  const { data: cust } = await sbAdmin.from('customer').select('id').eq('user_id', auth.user!.id).maybeSingle();
  if (!cust) { console.error('✗ no customer'); process.exit(1); }

  // Pre-cleanup sentinel period
  await sbAdmin.from('ppn_faktur_monthly').delete().eq('customer_id', cust.id).eq('tax_period', PERIOD);

  // Seed a faktur directly via admin client. POST endpoint is covered by
  // verify-ppn-single-entry-rate.ts; this script focuses on PUT only.
  const { data: createdRow, error: insertErr } = await sbAdmin
    .from('ppn_faktur_monthly')
    .insert({
      customer_id: cust.id,
      tax_period: PERIOD,
      faktur_type: 'KELUARAN',
      faktur_number: 'PUT-TEST-001',
      faktur_date: '2026-01-15',
      counterparty_name: 'PUT TEST VENDOR',
      counterparty_npwp: '01.234.567.8-901.000',
      dpp: 1000000,
      dpp_nilai_lain: Math.round(1000000 * (11 / 12)),
      is_luxury: false,
      ppn: 120000,
    })
    .select('id')
    .single();
  if (insertErr || !createdRow) {
    console.error('✗ seed insert failed:', insertErr?.message);
    process.exit(1);
  }
  const fakturId = createdRow.id;
  console.log(`✅ setup: seeded faktur ${fakturId} (KELUARAN, dpp 1M)`);

  const put = (body: Record<string, unknown>) => fetch(`${BASE_URL}/api/tax/ppn-faktur-monthly`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const readRow = async () => {
    const { data } = await sbAdmin.from('ppn_faktur_monthly').select('*').eq('id', fakturId).single();
    return data;
  };

  let pass = 0, fail = 0;

  // 1. PUT counterpartyName + counterpartyNpwp
  const r1 = await put({ id: fakturId, counterpartyName: 'NEW VENDOR', counterpartyNpwp: '02.345.678.9-012.000' });
  const j1 = await r1.json();
  const row1 = await readRow();
  if (j1.success && row1.counterparty_name === 'NEW VENDOR' && row1.counterparty_npwp === '02.345.678.9-012.000') {
    console.log(`✅ 1. counterparty updated`); pass++;
  } else { console.error('✗ 1.', j1, row1?.counterparty_name); fail++; }

  // 2. PUT fakturNumber + fakturDate
  const r2 = await put({ id: fakturId, fakturNumber: 'PUT-RENAMED-002', fakturDate: '2026-02-10' });
  const j2 = await r2.json();
  const row2 = await readRow();
  if (j2.success && row2.faktur_number === 'PUT-RENAMED-002' && row2.faktur_date === '2026-02-10') {
    console.log(`✅ 2. faktur no/date updated`); pass++;
  } else { console.error('✗ 2.', j2, row2?.faktur_number, row2?.faktur_date); fail++; }

  // 3. PUT dpp without ppn (essential row, 2026) → PMK 131/2024 정합:
  //    adjustedDPP = 2M × 11/12 = 1,833,333; ppn = 12% × adjusted = 220,000.
  //    (이전 expectation 240,000 = 12% × original 2M 은 11/12 보정 미적용
  //     상태였던 PPNCalculator 버그를 가정한 값 — 2026-06-29 fix 후 갱신.)
  const r3 = await put({ id: fakturId, dpp: 2000000, fakturDate: '2026-03-15' });
  const j3 = await r3.json();
  const row3 = await readRow();
  const expectedPpn3 = Math.round(Math.round(2000000 * (11 / 12)) * 0.12); // 220,000
  if (j3.success && Number(row3.dpp) === 2000000 && Number(row3.ppn) === expectedPpn3) {
    console.log(`✅ 3. dpp→${row3.dpp} + ppn fallback=${row3.ppn} (essential 11% effective)`); pass++;
  } else { console.error(`✗ 3. expected ppn=${expectedPpn3}, got dpp=${row3?.dpp} ppn=${row3?.ppn}`); fail++; }

  // 4. PUT dpp without dppNilaiLain → adjustDPP (essential 2026 → ×11/12)
  // Note: handler reads fakturDate from body to decide the year; pass it explicitly
  // so the result is deterministic (it could otherwise use 'today').
  const r4 = await put({ id: fakturId, dpp: 2000000, fakturDate: '2026-03-15' });
  const j4 = await r4.json();
  const row4 = await readRow();
  const expectedDnl4 = Math.round(2000000 * (11 / 12)); // 1,833,333
  if (j4.success && Number(row4.dpp_nilai_lain) === expectedDnl4) {
    console.log(`✅ 4. dpp→${row4.dpp} + dpp_nilai_lain fallback=${row4.dpp_nilai_lain} (×11/12)`); pass++;
  } else { console.error(`✗ 4. expected dnl=${expectedDnl4}, got=${row4?.dpp_nilai_lain}`); fail++; }

  // 5. PUT dpp + explicit ppn → explicit wins
  const r5 = await put({ id: fakturId, dpp: 3000000, ppn: 999999 });
  const j5 = await r5.json();
  const row5 = await readRow();
  if (j5.success && Number(row5.ppn) === 999999) {
    console.log(`✅ 5. explicit ppn wins → ${row5.ppn}`); pass++;
  } else { console.error(`✗ 5. expected ppn=999999, got=${row5?.ppn}`); fail++; }

  // 6. PUT dpp + explicit dppNilaiLain → explicit wins
  const r6 = await put({ id: fakturId, dpp: 3000000, dppNilaiLain: 2500000 });
  const j6 = await r6.json();
  const row6 = await readRow();
  if (j6.success && Number(row6.dpp_nilai_lain) === 2500000) {
    console.log(`✅ 6. explicit dppNilaiLain wins → ${row6.dpp_nilai_lain}`); pass++;
  } else { console.error(`✗ 6. expected dnl=2500000, got=${row6?.dpp_nilai_lain}`); fail++; }

  // 7. PUT isLuxury=true + dpp → dpp_nilai_lain = dpp (luxury, no 11/12)
  const r7 = await put({ id: fakturId, dpp: 4000000, isLuxury: true, fakturDate: '2026-03-15' });
  const j7 = await r7.json();
  const row7 = await readRow();
  if (j7.success && Number(row7.dpp_nilai_lain) === 4000000 && row7.is_luxury === true) {
    console.log(`✅ 7. luxury → dpp_nilai_lain=${row7.dpp_nilai_lain} (no 11/12 adjust)`); pass++;
  } else { console.error(`✗ 7. expected dnl=4000000 luxury=true, got dnl=${row7?.dpp_nilai_lain} luxury=${row7?.is_luxury}`); fail++; }

  // 8. PUT without id → 400
  const r8 = await put({ dpp: 1 });
  if (r8.status === 400) { console.log(`✅ 8. missing id → 400`); pass++; }
  else { console.error(`✗ 8. expected 400 got ${r8.status}`); fail++; }

  // cleanup
  await sbAdmin.from('ppn_faktur_monthly').delete().eq('customer_id', cust.id).eq('tax_period', PERIOD);

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
