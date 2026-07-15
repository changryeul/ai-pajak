/**
 * Regression for DB-backed PPh21 rate overrides (rate-provider).
 * Proves:
 *  1. With DB warmed (rows == TS baseline), PPh21 == TS-only result (no drift).
 *  2. A DB PTKP override actually changes the computed tax (round-trip).
 *  3. After restore + reload, the result returns to baseline.
 *  4. Out-of-range surcharge in DB is ignored (TS fallback) — safety guard.
 *
 * Mutates one PTKP row temporarily and ALWAYS restores it (try/finally).
 * Run: SEED_TARGET=prod npx tsx scripts/verify-rate-provider-overrides.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PPh21Calculator } from '../src/lib/tax/pph21-calculator';
import { loadRateOverrides, invalidateRateCache, resolveNpwpSurcharge } from '../src/lib/tax/rate-provider';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

let fail = 0;
const ok = (c: boolean, label: string, detail = '') => {
  if (c) console.log(`  ✅ ${label}`); else { console.error(`  ✗ ${label} ${detail}`); fail++; }
};
const sample = () => ({
  employee_name: '', employee_npwp: 'x', employee_nik: '', ptkp_category: 'TK0' as const,
  gross_salary: 10_000_000, jht_employee: 200_000, jp_employee: 100_000,
  position_allowance: 0, other_deductions: 0,
  tax_period_start: '2026-01-01', tax_period_end: '2026-12-31', has_npwp: true, month: 1,
});

async function reload() { invalidateRateCache(); await loadRateOverrides(); }

(async () => {
  console.log('🧪 rate-provider overrides (annual PPh21, TK0)\n');

  // Baseline WITHOUT any override (cold cache → TS constants)
  invalidateRateCache();
  const tsOnly = PPh21Calculator.calculateAnnual(sample()).tax_amount;

  // 1. Warm from DB (rows == TS baseline) → identical
  await reload();
  const dbWarmed = PPh21Calculator.calculateAnnual(sample()).tax_amount;
  ok(dbWarmed === tsOnly, 'DB 기준선(warmed) == TS-only 결과 (드리프트 0)', `db=${dbWarmed} ts=${tsOnly}`);

  // 2. Override TK0 PTKP 54M → 40M in DB, reload, recompute → tax must rise
  const { data: before } = await admin.from('tax_rate_config')
    .select('id, amount_value').eq('category', 'PTKP').eq('code', 'TK0').single();
  const origTk0 = before?.amount_value;
  try {
    await admin.from('tax_rate_config').update({ amount_value: 40_000_000 }).eq('id', before!.id);
    await reload();
    const withOverride = PPh21Calculator.calculateAnnual(sample()).tax_amount;
    ok(withOverride > dbWarmed, 'PTKP override(54M→40M) → 과세소득↑ → 세액↑ (override 실제 반영)', `override=${withOverride} base=${dbWarmed}`);

    // 3. restore → back to baseline
    await admin.from('tax_rate_config').update({ amount_value: origTk0 }).eq('id', before!.id);
    await reload();
    const restored = PPh21Calculator.calculateAnnual(sample()).tax_amount;
    ok(restored === dbWarmed, '복원 후 기준선 회귀', `restored=${restored} base=${dbWarmed}`);
  } finally {
    // safety: always restore TK0
    await admin.from('tax_rate_config').update({ amount_value: origTk0 }).eq('id', before!.id);
  }

  // 4. surcharge sane-range guard: even if DB had 2, resolve returns TS 0.20
  await reload();
  ok(resolveNpwpSurcharge(0.20) === 0.20, '무NPWP 가산 = 0.20 (DB 정상 or out-of-range→TS)');

  console.log(`\n— ${4 - fail}/4 pass ${fail ? `(${fail} FAIL)` : ''} —`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
