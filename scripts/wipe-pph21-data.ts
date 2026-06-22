/**
 * Wipe ALL tax data (2026-06-22 확장) — prod 테스트 reset.
 *
 * 삭제 범위:
 * - PPh21: monthly_payslip + employee_payroll
 * - PPh23: pph23_transaction
 * - PPh26: pph26_transaction
 * - PPN:   ppn_faktur_monthly
 * - tax_filing: monthly types 전체 (PPh21/PPh23/PPh_FINAL/PPN — PPh42 는 enum 추가됨)
 * - spt_masa_submission_request 전체 (모든 type)
 * - customer.employee_synced_through_period = NULL
 *
 * Run: SEED_TARGET=prod npx tsx scripts/wipe-pph21-data.ts
 *
 * Idempotent: 행이 없으면 0건 보고하고 끝.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  let total = 0;

  // 1) monthly_payslip — 먼저 삭제 (employee_payroll FK cascade 라서 자식부터)
  const { count: payslipBefore } = await admin
    .from('monthly_payslip')
    .select('*', { count: 'exact', head: true });
  console.log(`monthly_payslip rows: ${payslipBefore ?? 0}`);
  if (payslipBefore && payslipBefore > 0) {
    const { error } = await admin
      .from('monthly_payslip')
      .delete()
      .gte('created_at', '1900-01-01'); // safety: 전체 행 매칭
    if (error) throw error;
    console.log(`  ✅ deleted ${payslipBefore}`);
    total += payslipBefore;
  }

  // 2) employee_payroll — 직원 마스터 전체 삭제
  const { count: empBefore } = await admin
    .from('employee_payroll')
    .select('*', { count: 'exact', head: true });
  console.log(`employee_payroll rows: ${empBefore ?? 0}`);
  if (empBefore && empBefore > 0) {
    const { error } = await admin
      .from('employee_payroll')
      .delete()
      .gte('created_at', '1900-01-01');
    if (error) throw error;
    console.log(`  ✅ deleted ${empBefore}`);
    total += empBefore;
  }

  // 3) tax_filing where tax_type = 'PPh21' — PPh21 월 신고서 행 삭제
  const { count: filingBefore } = await admin
    .from('tax_filing')
    .select('*', { count: 'exact', head: true })
    .eq('tax_type', 'PPh21');
  console.log(`tax_filing (PPh21) rows: ${filingBefore ?? 0}`);
  if (filingBefore && filingBefore > 0) {
    const { error } = await admin
      .from('tax_filing')
      .delete()
      .eq('tax_type', 'PPh21');
    if (error) throw error;
    console.log(`  ✅ deleted ${filingBefore}`);
    total += filingBefore;
  }

  // 3b) spt_masa_submission_request 전체 — 2026-06-22 확장
  const { count: reqBefore } = await admin
    .from('spt_masa_submission_request')
    .select('*', { count: 'exact', head: true });
  console.log(`spt_masa_submission_request rows: ${reqBefore ?? 0}`);
  if (reqBefore && reqBefore > 0) {
    const { error } = await admin
      .from('spt_masa_submission_request')
      .delete()
      .gte('requested_at', '1900-01-01');
    if (error) throw error;
    console.log(`  ✅ deleted ${reqBefore}`);
    total += reqBefore;
  }

  // 3c) pph23_transaction 전체
  const { count: p23Before } = await admin
    .from('pph23_transaction')
    .select('*', { count: 'exact', head: true });
  console.log(`pph23_transaction rows: ${p23Before ?? 0}`);
  if (p23Before && p23Before > 0) {
    const { error } = await admin
      .from('pph23_transaction')
      .delete()
      .gte('created_at', '1900-01-01');
    if (error) throw error;
    console.log(`  ✅ deleted ${p23Before}`);
    total += p23Before;
  }

  // 3d) pph26_transaction 전체
  const { count: p26Before } = await admin
    .from('pph26_transaction')
    .select('*', { count: 'exact', head: true });
  console.log(`pph26_transaction rows: ${p26Before ?? 0}`);
  if (p26Before && p26Before > 0) {
    const { error } = await admin
      .from('pph26_transaction')
      .delete()
      .gte('created_at', '1900-01-01');
    if (error) throw error;
    console.log(`  ✅ deleted ${p26Before}`);
    total += p26Before;
  }

  // 3e) ppn_faktur_monthly 전체
  const { count: ppnBefore } = await admin
    .from('ppn_faktur_monthly')
    .select('*', { count: 'exact', head: true });
  console.log(`ppn_faktur_monthly rows: ${ppnBefore ?? 0}`);
  if (ppnBefore && ppnBefore > 0) {
    const { error } = await admin
      .from('ppn_faktur_monthly')
      .delete()
      .gte('created_at', '1900-01-01');
    if (error) throw error;
    console.log(`  ✅ deleted ${ppnBefore}`);
    total += ppnBefore;
  }

  // 3f) tax_filing — monthly types 전체 (annual SPT_TAHUNAN 은 보존)
  const monthlyTaxTypes = ['PPh21', 'PPh23', 'PPh_FINAL', 'PPN'];
  for (const tt of monthlyTaxTypes) {
    const { count } = await admin
      .from('tax_filing')
      .select('*', { count: 'exact', head: true })
      .eq('tax_type', tt);
    if (count && count > 0) {
      const { error } = await admin.from('tax_filing').delete().eq('tax_type', tt);
      if (error) throw error;
      console.log(`  ✅ tax_filing(${tt}) deleted ${count}`);
      total += count;
    }
  }

  // 4) customer.employee_synced_through_period — 모두 NULL 로 (sync 상태 reset)
  const { error: resetErr } = await admin
    .from('customer')
    .update({ employee_synced_through_period: null })
    .not('id', 'is', null);
  if (resetErr && !/column .* does not exist/i.test(resetErr.message)) {
    throw resetErr;
  }
  if (!resetErr) {
    console.log(`  ✅ customer.employee_synced_through_period = NULL (전 행)`);
  } else {
    console.log(`  ⚠️ employee_synced_through_period 컬럼이 아직 없음 — 마이그레이션 후 다시 실행`);
  }

  console.log(`\n총 ${total} 행 삭제 완료.`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
