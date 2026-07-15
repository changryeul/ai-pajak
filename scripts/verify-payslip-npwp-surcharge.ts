/**
 * Offline regression for PPh 21 payslip computation (computePayslipTotals).
 * Guards the 2026-07-14 fix where the payslip route hardcoded has_npwp:true,
 * so the Pasal 21(5a) 20% no-NPWP surcharge never applied (no-NPWP employees
 * were undercharged 20%). Also guards ptkp coercion (invalid → TK0, never 0)
 * and slash normalization (K/3 → K3).
 *
 * No DB / network — pure function. Run:
 *   npx tsx scripts/verify-payslip-npwp-surcharge.ts
 */
import { computePayslipTotals } from '../src/app/api/tax/monthly-payslip/route';

let fail = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  if (cond) console.log(`  ✅ ${label}`);
  else { console.error(`  ✗ ${label} ${detail}`); fail++; }
};

console.log('🧪 PPh21 payslip NPWP surcharge + ptkp coercion\n');

const base = { base_salary: 15_000_000, period: '2026-03', ptkp_category: 'TK/0' as string };
const noNpwp = computePayslipTotals({ ...base, employee_npwp: null });
const withNpwp = computePayslipTotals({ ...base, employee_npwp: '09.254.294.3-407.000' });

// 1. no-NPWP employee gets the 20% surcharge (990,000 = 825,000 × 1.2)
ok(noNpwp.pph21_tax === Math.round(withNpwp.pph21_tax * 1.2),
  'no-NPWP = with-NPWP × 1.2 (Pasal 21(5a) 가산)',
  `no=${noNpwp.pph21_tax} with=${withNpwp.pph21_tax}`);

// 2. same TER rate for both (surcharge is on tax, not rate)
ok(noNpwp.ter_rate === withNpwp.ter_rate, 'TER rate identical (가산은 세액에만)');

// 3. invalid ptkp coerces to TK0, never silently 0
const bad = computePayslipTotals({ ...base, ptkp_category: 'GARBAGE', employee_npwp: 'x' });
ok(bad.pph21_tax > 0, '잘못된 PTKP → TK0 보정, 세금 0 아님', `got ${bad.pph21_tax}`);
ok(bad.pph21_tax === withNpwp.pph21_tax, '잘못된 PTKP 값이 TK0 와 동일 결과');

// 4. slash normalization still works (K/3 maps to category C)
const k3 = computePayslipTotals({ ...base, ptkp_category: 'K/3', employee_npwp: 'x' });
ok(k3.ter_rate > 0 && k3.ter_rate < withNpwp.ter_rate,
  'K/3 정규화 → 카테고리 C (TK0 보다 낮은 TER)', `k3=${k3.ter_rate} tk0=${withNpwp.ter_rate}`);

console.log(`\n— ${4 + 1 - fail}/${5} pass ${fail ? `(${fail} FAIL)` : ''} —`);
process.exit(fail === 0 ? 0 : 1);
