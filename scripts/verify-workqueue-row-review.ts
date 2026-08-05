/**
 * 워크큐 행 팝업 '저장 및 확인' 계약 (수정요청 9·10·15·24 회귀).
 *
 *   1. sentinel payslip + PPh21 큐 생성 (period 2099-10)
 *   2. operator PATCH row-review confirm+edits → operator_reviewed_at/by 스탬프
 *      + operator_edits 누적 (role=COUNSELOR)
 *   3. supervisor 재편집 → edits 병합 + role=SUPERVISOR (색 구분 근거)
 *   4. pph21 detail 라우트가 reviewedAt + green 오버라이드('확인' label) 반환
 *   5. 다른 큐의 행 → 404 (임의 행 스탬프 차단)
 *   6. cleanup
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-workqueue-row-review.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`x ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const BASE = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PERIOD = '2099-10';
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, extra = '') => {
  if (ok) { console.log(`✅ ${name} ${extra}`); pass++; }
  else { console.error(`✗ ${name} ${extra}`); fail++; }
};

async function login(email: string) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password: 'TestPassword123!' });
  if (error || !data.session) throw new Error(`login failed: ${email} ${error?.message}`);
  return data.session.access_token;
}

async function main() {
  const { data: cust } = await admin.from('customer').select('id')
    .eq('email', 'company.test@example.com').maybeSingle();
  if (!cust) { console.error('company.test missing'); process.exit(1); }
  const cid = cust.id;

  const cleanup = async () => {
    await admin.from('monthly_payslip').delete().eq('customer_id', cid).eq('period', PERIOD);
    await admin.from('djp_submission_queue').delete().eq('customer_id', cid)
      .eq('tax_type', 'PPh21').eq('tax_period_month', 10).eq('tax_period_year', 2099);
  };
  await cleanup();

  // 1. sentinel payslip + 큐
  const { data: slip, error: slipErr } = await admin.from('monthly_payslip').insert({
    customer_id: cid, period: PERIOD, employee_name: '[ROWREV-E2E] Test Emp',
    ptkp_category: 'TK0', base_salary: 10_000_000, total_gross: 10_000_000, pph21_tax: 100_000,
    status: 'DRAFT',
  }).select('id').single();
  if (slipErr || !slip) { console.error('seed payslip failed', slipErr?.message); process.exit(1); }
  const { data: q, error: qErr } = await admin.from('djp_submission_queue').insert({
    customer_id: cid, tax_type: 'PPh21', tax_period_month: 10, tax_period_year: 2099, status: 'PENDING',
  }).select('id').single();
  if (qErr || !q) { console.error('seed queue failed', qErr?.message); process.exit(1); }

  const opTok = await login('operator.test@aipajak.com');
  const svTok = await login('supervisor.test@aipajak.com');
  const patch = (tok: string, queueId: string, body: object) =>
    fetch(`${BASE}/api/operator/workqueue/${queueId}/row-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify(body),
    });

  // 2. 상담원 confirm + edit
  const r1 = await patch(opTok, q.id, {
    rowId: slip.id, confirm: true,
    edits: [{ field: 'baseSalary', from: 10_000_000, to: 12_000_000 }],
  });
  check('1. counselor confirm 200', r1.status === 200, `status=${r1.status}`);
  const { data: row1 } = await admin.from('monthly_payslip')
    .select('operator_reviewed_at, operator_reviewed_by, operator_edits').eq('id', slip.id).single();
  check('2. reviewed_at/by 스탬프', !!row1?.operator_reviewed_at && !!row1?.operator_reviewed_by);
  const e1 = (row1?.operator_edits ?? {}) as Record<string, { role?: string }>;
  check('3. edits 누적 (COUNSELOR)', e1.baseSalary?.role === 'COUNSELOR', JSON.stringify(e1.baseSalary ?? null));

  // 3. 수퍼바이저 재편집 → 병합 + SUPERVISOR
  const r2 = await patch(svTok, q.id, {
    rowId: slip.id, edits: [{ field: 'thrOnly', from: 0, to: 1_000_000 }],
  });
  check('4. supervisor edits 200', r2.status === 200, `status=${r2.status}`);
  const { data: row2 } = await admin.from('monthly_payslip').select('operator_edits').eq('id', slip.id).single();
  const e2 = (row2?.operator_edits ?? {}) as Record<string, { role?: string }>;
  check('5. edits 병합 + SUPERVISOR', e2.baseSalary?.role === 'COUNSELOR' && e2.thrOnly?.role === 'SUPERVISOR');

  // 4. detail 라우트 green 오버라이드
  const rd = await fetch(`${BASE}/api/operator/workqueue/${q.id}/pph21`, {
    headers: { Authorization: `Bearer ${opTok}` },
  });
  const jd = await rd.json();
  const drow = jd?.data?.rows?.find((r: { payslipId: string }) => r.payslipId === slip.id);
  check('6. detail rows 에 reviewedAt', !!drow?.reviewedAt);
  check('7. 확인 후 green + 확인 label', drow?.flags?.level === 'green' && String(drow?.flags?.label ?? '').includes('확인'),
    `level=${drow?.flags?.level} label=${drow?.flags?.label}`);

  // 5. 다른 큐 소속 행 차단 — 존재하지 않는 행 id
  const r3 = await patch(opTok, q.id, { rowId: '00000000-0000-0000-0000-00000000dead', confirm: true });
  check('8. 소속 아닌 행 → 404', r3.status === 404, `status=${r3.status}`);

  await cleanup();
  console.log(`\n${fail === 0 ? '✅' : '✗'} ${pass} passed / ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('!!', e); process.exit(1); });
