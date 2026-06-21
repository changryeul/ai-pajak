/**
 * Wipe all PPh21 data — 2026-06-21 정책 변경에 따른 prod reset.
 *
 * 사용자 결정:
 * - 급여명세 (monthly_payslip) 전체 삭제 — 새 UI 로 다시 업로드.
 * - 직원 인사 기록 (employee_payroll) 전체 삭제 — sync 버튼으로만 마스터 갱신.
 * - PPh21 SPT Masa filing (tax_filing where tax_type = 'PPh21') 전체 삭제.
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
