/**
 * 2026-06-24 backfill — 기존 monthly_payslip 행의 net_salary/pph21_tax/BPJS
 * company 등 파생값이 0 인 채로 남아있는 경우 재계산. import API 가 helper
 * 적용 전에 insert 된 행 대상.
 *
 * SUBMITTED 행은 건드리지 않음 (제출 후 변경 금지 정책).
 *
 * Run: SEED_TARGET=prod npx tsx scripts/backfill-payslip-totals.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { computePayslipTotals } from '../src/app/api/tax/monthly-payslip/route';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data: rows, error } = await admin
    .from('monthly_payslip')
    .select('*')
    .neq('status', 'SUBMITTED'); // SUBMITTED 행은 건드리지 않음
  if (error) throw error;
  console.log(`Found ${rows?.length ?? 0} non-SUBMITTED rows.`);

  let updated = 0;
  let skipped = 0;
  for (const r of rows ?? []) {
    const totals = computePayslipTotals({
      base_salary: Number(r.base_salary || 0),
      overtime_pay: Number(r.overtime_pay || 0),
      meal_allowance: Number(r.meal_allowance || 0),
      transport_allowance: Number(r.transport_allowance || 0),
      position_allowance: Number(r.position_allowance || 0),
      other_allowances: Number(r.other_allowances || 0),
      laptop_allowance: Number(r.laptop_allowance || 0),
      medical_allowance: Number(r.medical_allowance || 0),
      tax_allowance: Number(r.tax_allowance || 0),
      annual_leave_pay: Number(r.annual_leave_pay || 0),
      bonus: Number(r.bonus || 0),
      thr: Number(r.thr || 0),
      commission: Number(r.commission || 0),
      severance_allowance: Number(r.severance_allowance || 0),
      pkwt_compensation: Number(r.pkwt_compensation || 0),
      bpjs_kesehatan: Number(r.bpjs_kesehatan || 0),
      bpjs_ketenagakerjaan: Number(r.bpjs_ketenagakerjaan || 0),
      jht_employee: Number(r.jht_employee || 0),
      jp_employee: Number(r.jp_employee || 0),
      loan_deduction: Number(r.loan_deduction || 0),
      other_deductions: Number(r.other_deductions || 0),
      period: r.period,
      ptkp_category: r.ptkp_category,
    });
    // 이미 동일하면 skip (Farah 같이 이미 net 채워진 행)
    if (Number(r.net_salary || 0) === totals.net_salary && Number(r.pph21_tax || 0) === totals.pph21_tax) {
      skipped++;
      continue;
    }
    const { error: updErr } = await admin
      .from('monthly_payslip')
      .update(totals)
      .eq('id', r.id);
    if (updErr) {
      console.log(`  ❌ ${r.employee_name} — ${updErr.message}`);
    } else {
      console.log(`  ✅ ${r.period} ${(r.employee_name||'').slice(0, 25).padEnd(25)} net ${Number(r.net_salary||0).toLocaleString()} → ${totals.net_salary.toLocaleString()}`);
      updated++;
    }
  }
  console.log(`\nUpdated ${updated}, Skipped ${skipped}.`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
