/**
 * 기존 PPh 21 급여명세 재계산 배치.
 *
 * PTKP 정규화/TER 카테고리 수정(2026-07-24) 이전에 저장된 payslip 은
 * 잘못된 세율(특히 슬래시 PTKP → 세율 0)로 남아 있을 수 있다. 이 배치는
 * 저장된 입력값(base_salary·수당·bpjs·ptkp_category·employee_npwp 등)을
 * 그대로 computePayslipTotals 에 다시 넣어 pph21_tax/ter_rate/total_gross/
 * taxable_income/net_salary 등을 재산출하고, 값이 달라진 행만 갱신한다.
 *
 * 안전장치:
 *   - 기본 DRY-RUN (변경 예정만 출력, DB 미변경). --apply 로 실제 갱신.
 *   - 기본은 status='DRAFT' 만 (신고 제출/처리 완료건은 건드리지 않음).
 *     --include-submitted 로 SUBMITTED/PROCESSED 도 포함.
 *   - 필터: --customer=<uuid> --period=<YYYY-MM> (미지정 시 전체).
 *   - rate override(loadRateOverrides) warm 후 계산 → DB 세율 반영.
 *
 * 실행:
 *   SEED_TARGET=prod npx tsx scripts/recompute-payslips.ts                       # dry-run 전체 DRAFT
 *   SEED_TARGET=prod npx tsx scripts/recompute-payslips.ts --period=2026-06      # 특정 기간
 *   SEED_TARGET=prod npx tsx scripts/recompute-payslips.ts --apply               # 실제 갱신
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { computePayslipTotals } from '../src/app/api/tax/monthly-payslip/route';
import { loadRateOverrides } from '../src/lib/tax/rate-provider';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const INCLUDE_SUBMITTED = args.includes('--include-submitted');
const customerId = args.find((a) => a.startsWith('--customer='))?.split('=')[1] ?? null;
const period = args.find((a) => a.startsWith('--period='))?.split('=')[1] ?? null;

const fmt = (n: number) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`;

// computePayslipTotals 입력 형태로 payslip row 를 매핑.
function toInput(r: Record<string, unknown>) {
  const num = (k: string) => Number(r[k] ?? 0);
  return {
    base_salary: num('base_salary'),
    overtime_pay: num('overtime_pay'),
    meal_allowance: num('meal_allowance'),
    transport_allowance: num('transport_allowance'),
    position_allowance: num('position_allowance'),
    other_allowances: num('other_allowances'),
    laptop_allowance: num('laptop_allowance'),
    medical_allowance: num('medical_allowance'),
    tax_allowance: num('tax_allowance'),
    annual_leave_pay: num('annual_leave_pay'),
    bonus: num('bonus'),
    thr: num('thr'),
    commission: num('commission'),
    severance_allowance: num('severance_allowance'),
    pkwt_compensation: num('pkwt_compensation'),
    bpjs_kesehatan: num('bpjs_kesehatan'),
    bpjs_ketenagakerjaan: num('bpjs_ketenagakerjaan'),
    jht_employee: num('jht_employee'),
    jp_employee: num('jp_employee'),
    loan_deduction: num('loan_deduction'),
    other_deductions: num('other_deductions'),
    period: String(r.period ?? ''),
    ptkp_category: (r.ptkp_category as string) ?? null,
    employee_npwp: (r.employee_npwp as string) ?? null,
  };
}

// 재계산 결과 중 저장 대상. 금액 필드는 Rp 정수 반올림 비교/저장,
// ter_rate 는 0~1 소수라 반올림 금지(0.08 → round 하면 0 이 되는 버그).
const MONEY_FIELDS = [
  'total_gross', 'total_deduction', 'taxable_income', 'personal_expense',
  'pph21_tax', 'net_salary',
] as const;
const RECALC_FIELDS = [...MONEY_FIELDS, 'ter_rate'] as const;

/** 필드별 정규화: 금액은 반올림, rate 는 소수 6자리 유지. */
function normField(field: string, v: number): number {
  return field === 'ter_rate' ? Math.round(Number(v || 0) * 1e6) / 1e6 : Math.round(Number(v || 0));
}

async function main() {
  console.log(`🧮 payslip recompute — mode=${APPLY ? 'APPLY' : 'DRY-RUN'} · status=${INCLUDE_SUBMITTED ? 'ALL' : 'DRAFT'}` +
    `${customerId ? ` · customer=${customerId.slice(0, 8)}…` : ''}${period ? ` · period=${period}` : ''}\n`);

  await loadRateOverrides(); // DB 세율 override warm

  let query = admin.from('monthly_payslip').select('*').order('period', { ascending: true });
  if (customerId) query = query.eq('customer_id', customerId);
  if (period) query = query.eq('period', period);
  if (!INCLUDE_SUBMITTED) query = query.eq('status', 'DRAFT');

  const { data: rows, error } = await query;
  if (error) { console.error('load failed:', error.message); process.exit(1); }
  if (!rows || rows.length === 0) { console.log('대상 payslip 없음.'); return; }

  let changed = 0;
  let unchanged = 0;
  let failed = 0;
  const changes: Array<{ id: string; name: string; period: string; ptkp: string; oldTax: number; newTax: number }> = [];

  for (const r of rows) {
    let result: ReturnType<typeof computePayslipTotals>;
    try {
      result = computePayslipTotals(toInput(r));
    } catch (e) {
      failed++;
      console.error(`  ✗ ${r.employee_name ?? r.id} (${r.period}): compute failed — ${(e as Error).message}`);
      continue;
    }

    // 변경 여부 — 필드별 정규화 후 비교 (금액 정수 / rate 소수).
    const diffs: string[] = [];
    for (const f of RECALC_FIELDS) {
      const oldV = normField(f, Number(r[f] ?? 0));
      const newV = normField(f, Number((result as Record<string, number>)[f] ?? 0));
      if (oldV !== newV) diffs.push(f);
    }

    if (diffs.length === 0) { unchanged++; continue; }
    changed++;
    changes.push({
      id: r.id, name: r.employee_name ?? '(unknown)', period: r.period,
      ptkp: r.ptkp_category ?? '—',
      oldTax: Math.round(Number(r.pph21_tax ?? 0)),
      newTax: Math.round(Number(result.pph21_tax ?? 0)),
    });

    if (APPLY) {
      const patch: Record<string, number> = {};
      for (const f of RECALC_FIELDS) patch[f] = normField(f, Number((result as Record<string, number>)[f] ?? 0));
      const { error: upErr } = await admin
        .from('monthly_payslip')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (upErr) { failed++; console.error(`  ✗ update ${r.id}: ${upErr.message}`); }
    }
  }

  // 변경 요약 (PPh21 세액 변화 중심).
  console.log('변경 대상:');
  for (const c of changes.slice(0, 100)) {
    const delta = c.newTax - c.oldTax;
    const sign = delta > 0 ? '+' : '';
    console.log(`  • ${c.name} | ${c.period} | ${c.ptkp} | PPh21 ${fmt(c.oldTax)} → ${fmt(c.newTax)} (${sign}${fmt(delta).replace('Rp ', '')})`);
  }
  if (changes.length > 100) console.log(`  … +${changes.length - 100} more`);

  console.log(`\n📊 ${changed} changed · ${unchanged} unchanged · ${failed} failed / ${rows.length} total`);
  console.log(APPLY ? '✅ APPLIED — DB 갱신 완료.' : '🔎 DRY-RUN — 변경 없음. 적용하려면 --apply 를 붙이세요.');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
