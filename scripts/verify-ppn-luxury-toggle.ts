/**
 * PPN luxury 토글 시 ppn + dpp_nilai_lain 이 PMK 131/2024 에 맞게 재계산되는지.
 *
 *   essential (default): ppn = DPP × 11/12 × 12% = DPP × 11%
 *                        dpp_nilai_lain = DPP × 11/12
 *   luxury:               ppn = DPP × 12%
 *                        dpp_nilai_lain = DPP
 *
 * Trace:
 *   1. sentinel faktur row 1건 seed (essential 기본, DPP = 1,200,000)
 *   2. 검증: ppn = 132,000 (1.2M × 11%), dpp_nilai_lain = 1,100,000
 *   3. PUT { isLuxury: true } — dpp 동반 안 보냄
 *   4. 검증: ppn = 144,000 (1.2M × 12%), dpp_nilai_lain = 1,200,000, is_luxury=true
 *   5. PUT { isLuxury: false } 토글 복귀
 *   6. 검증: 다시 132,000 / 1,100,000 / false
 *   7. cleanup
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-ppn-luxury-toggle.ts
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`x ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const BASE_URL = process.env.E2E_BASE_URL || (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000011';
const SENTINEL_FAKTUR_PREFIX = '999.LUXSMOKE.';
const SENTINEL_PERIOD = '2099-11';

async function login(email: string, password: string): Promise<string> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`login failed: ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function main() {
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  let pass = 0, fail = 0;

  // Pre-cleanup sentinel rows.
  await sbAdmin.from('ppn_faktur_monthly').delete()
    .eq('customer_id', CUSTOMER_ID)
    .like('faktur_number', `${SENTINEL_FAKTUR_PREFIX}%`);

  // 1. Seed essential row (DPP = 1,200,000) via direct insert (skip API auth for seed).
  const fakturNumber = `${SENTINEL_FAKTUR_PREFIX}${Date.now().toString().slice(-6)}`;
  const dpp = 1_200_000;
  // essential 기본 expectations (PMK 131/2024, 2025+).
  const expectedEssentialPpn = Math.round(dpp * (11 / 12) * 0.12); // = 131,999 or 132,000
  const expectedEssentialDppNL = Math.round(dpp * (11 / 12));      // = 1,100,000
  const expectedLuxuryPpn = Math.round(dpp * 0.12);                // = 144,000
  const expectedLuxuryDppNL = dpp;                                  // = 1,200,000

  const { data: seeded, error: seedErr } = await sbAdmin.from('ppn_faktur_monthly').insert({
    customer_id: CUSTOMER_ID,
    tax_period: SENTINEL_PERIOD,
    faktur_type: 'MASUKAN',
    faktur_number: fakturNumber,
    faktur_date: `${SENTINEL_PERIOD}-15`,
    counterparty_name: 'Luxury Smoke Sentinel',
    counterparty_npwp: '99.999.999.9-999.999',
    dpp,
    dpp_nilai_lain: expectedEssentialDppNL,
    ppn: expectedEssentialPpn,
    is_luxury: false,
    status: 'APPROVED',
  }).select('id').single();
  if (seedErr || !seeded) {
    console.error('✗ 1. seed failed:', seedErr?.message);
    process.exit(1);
  }
  console.log(`✅ 1. seeded essential row (id=${seeded.id}, dpp=${dpp}, ppn=${expectedEssentialPpn})`);
  pass++;

  // Read-back baseline.
  const { data: base } = await sbAdmin.from('ppn_faktur_monthly').select('ppn, dpp_nilai_lain, is_luxury').eq('id', seeded.id).single();
  if (base?.ppn === expectedEssentialPpn && base?.dpp_nilai_lain === expectedEssentialDppNL && base?.is_luxury === false) {
    console.log(`✅ 2. baseline ok — ppn=${base.ppn}, dpp_nilai_lain=${base.dpp_nilai_lain}, is_luxury=false`);
    pass++;
  } else {
    console.error(`✗ 2. baseline mismatch:`, base);
    fail++;
  }

  // 3. PUT { isLuxury: true } — dpp 동반 안 보냄 (UI 가 토글만 보낼 때 reproduce).
  const consultantToken = await login('consultant.test@jakartatax.co.id', 'TestPassword123!');
  const putRes = await fetch(`${BASE_URL}/api/tax/ppn-faktur-monthly`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${consultantToken}` },
    body: JSON.stringify({ id: seeded.id, isLuxury: true }),
  });
  const putJson = await putRes.json().catch(() => ({}));
  if (putRes.status === 200 && putJson.success) {
    console.log('✅ 3. PUT { isLuxury: true } → 200');
    pass++;
  } else {
    console.error(`✗ 3. PUT failed status=${putRes.status} body=${JSON.stringify(putJson).slice(0, 200)}`);
    fail++;
  }

  // 4. Read-back after luxury toggle.
  const { data: after } = await sbAdmin.from('ppn_faktur_monthly').select('ppn, dpp_nilai_lain, is_luxury').eq('id', seeded.id).single();
  if (after?.ppn === expectedLuxuryPpn && after?.dpp_nilai_lain === expectedLuxuryDppNL && after?.is_luxury === true) {
    console.log(`✅ 4. luxury 토글 후 — ppn=${after.ppn} (11%→12%), dpp_nilai_lain=${after.dpp_nilai_lain}, is_luxury=true`);
    pass++;
  } else {
    console.error(`✗ 4. luxury toggle mismatch (expected ppn=${expectedLuxuryPpn} dpp_nilai_lain=${expectedLuxuryDppNL}):`, after);
    fail++;
  }

  // 5. Toggle back to essential.
  const putBackRes = await fetch(`${BASE_URL}/api/tax/ppn-faktur-monthly`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${consultantToken}` },
    body: JSON.stringify({ id: seeded.id, isLuxury: false }),
  });
  const putBackJson = await putBackRes.json().catch(() => ({}));
  if (putBackRes.status === 200 && putBackJson.success) {
    console.log('✅ 5. PUT { isLuxury: false } → 200');
    pass++;
  } else {
    console.error(`✗ 5. PUT-back failed status=${putBackRes.status} body=${JSON.stringify(putBackJson).slice(0, 200)}`);
    fail++;
  }

  const { data: back } = await sbAdmin.from('ppn_faktur_monthly').select('ppn, dpp_nilai_lain, is_luxury').eq('id', seeded.id).single();
  if (back?.ppn === expectedEssentialPpn && back?.dpp_nilai_lain === expectedEssentialDppNL && back?.is_luxury === false) {
    console.log(`✅ 6. essential 복귀 — ppn=${back.ppn}, dpp_nilai_lain=${back.dpp_nilai_lain}, is_luxury=false`);
    pass++;
  } else {
    console.error(`✗ 6. revert mismatch:`, back);
    fail++;
  }

  // 7. Cleanup.
  await sbAdmin.from('ppn_faktur_monthly').delete().eq('id', seeded.id);
  console.log('✅ 7. cleanup');
  pass++;

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
