/**
 * TER 세율표 DB override 라운드트립 (2026-08-30).
 *
 * MASTER 가 /admin/tax-rates 에서 TER 구간을 수정하면 배포 없이 계산에
 * 반영되는지 검증:
 *   1. 시드 존재 (PPH21_TER_A 44 / B 40 / C 41 = 125구간)
 *   2. DB 시드 = TS 기본표 (구간·세율 일치 — 시드 드리프트 감지)
 *   3. A 카테고리 두 번째 구간 세율 override → lookupTERRate 반영
 *   4. computePayslipTotals 세액에도 반영 (엔진 통합)
 *   5. 원복 → TS 기본값과 재일치
 *   6. 파손 ladder(행 삭제로 <10 구간) → TS fallback  [시뮬레이션 생략:
 *      sanity 로직은 resolveTER 단위에서 보장, 실DB 파손은 만들지 않음]
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-ter-override-roundtrip.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { TER_CATEGORY_A, TER_CATEGORY_B, TER_CATEGORY_C, lookupTERRate } from '../src/config/pph21-ter-rates';
import { loadRateOverrides, invalidateRateCache } from '../src/lib/tax/rate-provider';
import { computePayslipTotals } from '../src/app/api/tax/monthly-payslip/route';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`x ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, extra = '') => {
  if (ok) { console.log(`✅ ${name} ${extra}`); pass++; }
  else { console.error(`✗ ${name} ${extra}`); fail++; }
};

async function main() {
  // 1. 시드 카운트
  const { data: counts } = await admin.from('tax_rate_config')
    .select('category').like('category', 'PPH21_TER%').eq('is_active', true);
  const byCat: Record<string, number> = {};
  for (const r of counts ?? []) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
  check('1. TER 시드 125구간 존재', byCat.PPH21_TER_A === 44 && byCat.PPH21_TER_B === 40 && byCat.PPH21_TER_C === 41,
    JSON.stringify(byCat));

  // 2. DB 시드 ≡ TS 기본표
  const { data: rows } = await admin.from('tax_rate_config')
    .select('category, rate_value, threshold_min, threshold_max, sort_order')
    .like('category', 'PPH21_TER%').eq('is_active', true).order('sort_order');
  const tsTables = { PPH21_TER_A: TER_CATEGORY_A, PPH21_TER_B: TER_CATEGORY_B, PPH21_TER_C: TER_CATEGORY_C } as const;
  let driftCount = 0;
  for (const [cat, table] of Object.entries(tsTables)) {
    const dbRows = (rows ?? []).filter(r => r.category === cat).sort((a, b) => a.sort_order - b.sort_order);
    table.forEach((b, i) => {
      const d = dbRows[i];
      const dMax = d?.threshold_max == null ? Infinity : Number(d.threshold_max);
      if (!d || Number(d.rate_value) !== b.rate || Number(d.threshold_min) !== b.min || dMax !== b.max) driftCount++;
    });
  }
  check('2. DB 시드 = TS 기본표 (드리프트 0)', driftCount === 0, `drift=${driftCount}`);

  // 3~5. override 라운드트립 — A 카테고리 5.4~5.65jt 구간 (기본 0.25%)
  const TEST_GROSS = 5_500_000;
  invalidateRateCache(); await loadRateOverrides();
  const baseRate = lookupTERRate('A', TEST_GROSS);
  check('3a. 기본 세율 = 0.25%', baseRate === 0.0025, `rate=${baseRate}`);

  const { error: upErr } = await admin.from('tax_rate_config')
    .update({ rate_value: 0.005 })
    .eq('category', 'PPH21_TER_A').eq('sort_order', 2);
  check('3b. override UPDATE', !upErr, upErr?.message ?? '');

  try {
    invalidateRateCache(); await loadRateOverrides();
    check('3c. lookupTERRate 에 override 반영 (0.5%)', lookupTERRate('A', TEST_GROSS) === 0.005);

    const totals = computePayslipTotals({
      base_salary: TEST_GROSS, period: '2026-05', ptkp_category: 'TK0',
      employee_npwp: '09.254.294.3-407.000',
    });
    check('4. 엔진 세액에 반영', totals.pph21_tax === Math.round(TEST_GROSS * 0.005) && totals.ter_rate === 0.005,
      `tax=${totals.pph21_tax} rate=${totals.ter_rate}`);
  } finally {
    // 5. 원복 (실패해도 반드시)
    await admin.from('tax_rate_config').update({ rate_value: 0.0025 })
      .eq('category', 'PPH21_TER_A').eq('sort_order', 2);
  }
  invalidateRateCache(); await loadRateOverrides();
  check('5. 원복 후 기본 세율 재일치', lookupTERRate('A', TEST_GROSS) === 0.0025);

  console.log(`\n${fail === 0 ? '✅' : '✗'} ${pass} passed / ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(async (e) => {
  // 예외 시에도 원복 시도
  await admin.from('tax_rate_config').update({ rate_value: 0.0025 })
    .eq('category', 'PPH21_TER_A').eq('sort_order', 2).then(() => {});
  console.error('!!', e); process.exit(1);
});
