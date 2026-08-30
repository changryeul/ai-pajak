/**
 * PPh21 급여명세 전수 재계산 감사 (2026-08-30).
 *
 * DB 의 모든 monthly_payslip 행을 저장 당시와 동일한 엔진
 * (computePayslipTotals — TER/PTKP 정규화/무-NPWP 가산/rate-provider
 * override 포함)으로 재계산해 저장값과 대조한다. "가끔 데이터가 틀린다"
 * 유형(과거 버그 시점에 저장된 행, 우회 쓰기, 규칙 변경 소급 미적용)을
 * 전부 표면화하는 회귀 그물.
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-payslip-recalc-audit.ts          # 보고만
 *   SEED_TARGET=prod npx tsx scripts/verify-payslip-recalc-audit.ts --fix    # 엔진값으로 수정
 *
 * 비교 항목: pph21_tax / ter_rate / total_gross / total_deduction /
 * taxable_income / net_salary (금액 ±1 IDR 반올림 허용).
 * SUBMITTED/FILED 행은 신고 이후라 --fix 에서도 건드리지 않고 보고만 한다.
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { computePayslipTotals } from '../src/app/api/tax/monthly-payslip/route';
import { loadRateOverrides } from '../src/lib/tax/rate-provider';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`x ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const FIX = process.argv.includes('--fix');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const MONEY_FIELDS = ['pph21_tax', 'total_gross', 'total_deduction', 'taxable_income', 'net_salary'] as const;
const LOCKED_STATUSES = new Set(['SUBMITTED', 'FILED']);

function near(a: number, b: number, tol = 1): boolean { return Math.abs(a - b) <= tol; }

async function main() {
  // 엔진 파리티: 쓰기 경로(PUT/import)와 동일하게 DB rate override warm
  await loadRateOverrides();

  const { data: rows, error } = await admin
    .from('monthly_payslip')
    .select('*, employee:employee_id(ptkp_category, employee_npwp)')
    .order('created_at', { ascending: true });
  if (error || !rows) { console.error('load failed:', error?.message); process.exit(1); }

  let checked = 0, mismatched = 0, fixed = 0, lockedMismatch = 0;
  const causes: Record<string, number> = {};

  for (const r of rows) {
    checked++;
    const ptkp = r.ptkp_category || r.employee?.ptkp_category || 'TK0';
    const expected = computePayslipTotals({
      ...r,
      period: r.period,
      ptkp_category: ptkp,
      employee_npwp: r.employee_npwp ?? r.employee?.employee_npwp ?? null,
    });

    const diffs: string[] = [];
    for (const f of MONEY_FIELDS) {
      if (!near(Number(r[f] ?? 0), expected[f])) diffs.push(`${f}: ${r[f]} → ${expected[f]}`);
    }
    if (Math.abs(Number(r.ter_rate ?? 0) - expected.ter_rate) > 0.0001) {
      diffs.push(`ter_rate: ${r.ter_rate} → ${expected.ter_rate}`);
    }
    if (diffs.length === 0) continue;

    mismatched++;
    const locked = LOCKED_STATUSES.has(r.status);
    if (locked) lockedMismatch++;
    const causeKey = diffs.map(d => d.split(':')[0]).sort().join('+');
    causes[causeKey] = (causes[causeKey] ?? 0) + 1;
    console.log(`${locked ? '🔒' : '✗'} ${r.period} ${r.employee_name ?? r.id.slice(0, 8)} [${r.status}] ptkp=${ptkp} npwp=${r.employee_npwp ? 'Y' : 'N'}`);
    for (const d of diffs) console.log(`     ${d}`);

    if (FIX && !locked) {
      const { error: upErr } = await admin.from('monthly_payslip').update({
        total_gross: expected.total_gross,
        total_deduction: expected.total_deduction,
        taxable_income: expected.taxable_income,
        pph21_tax: expected.pph21_tax,
        ter_rate: expected.ter_rate,
        net_salary: expected.net_salary,
        base_salary_bpjs_kes: expected.base_salary_bpjs_kes,
        base_salary_bpjs_tk: expected.base_salary_bpjs_tk,
        bpjs_kes_company: expected.bpjs_kes_company,
        jkk_company: expected.jkk_company,
        jkm_company: expected.jkm_company,
        jht_company: expected.jht_company,
        jp_company: expected.jp_company,
        personal_expense: expected.personal_expense,
      }).eq('id', r.id);
      if (upErr) console.error(`     fix FAILED: ${upErr.message}`);
      else { fixed++; console.log('     → fixed ✓'); }
    }
  }

  console.log(`\n📊 ${checked} payslips audited · mismatched ${mismatched} (locked ${lockedMismatch})${FIX ? ` · fixed ${fixed}` : ''}`);
  if (mismatched > 0) console.log('   causes:', JSON.stringify(causes));

  // 보고 모드: 잠긴(신고 완료) 행 불일치는 정보로만 — 소급 수정은 세무 판단 필요.
  const blocking = mismatched - lockedMismatch - (FIX ? fixed : 0);
  if (blocking > 0 && !FIX) {
    console.error(`\n✗ FAIL — ${blocking} editable payslips drifted from the engine. Run with --fix or investigate.`);
    process.exit(1);
  }
  console.log('\n✅ PASS — all editable payslips match the calculation engine.');
  process.exit(0);
}

main().catch((e) => { console.error('!!', e); process.exit(1); });
