/**
 * /api/tax/monthly-payments `record-monthly-tax` contract (수정요청 25번 회귀).
 *
 * /tax/umkm 마법사의 제출 버튼이 alert 스텁이라 고객 입력(월 매출/세액)이
 * 서버에 전혀 저장되지 않던 결함(2026-08-05)의 회귀 그물:
 *   1. CUSTOMER 가 UMKM(PPh_FINAL) 월 세액 제출 → tax_monthly_payment 생성
 *   2. 같은 기간 재제출 → 기존 행 갱신 (중복 생성 없음, 납부필드 보존)
 *   3. 자료 write → 선납법인세 큐(PPh_FINAL) 자동 생성
 *   4. 검증 실패 계약: 잘못된 taxType/taxPeriod → 400
 *   5. cleanup (sentinel: period 2099-12)
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-umkm-record-contract.ts
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

const PERIOD = '2099-12';
let pass = 0, fail = 0;
function check(name: string, ok: boolean, extra = '') {
  if (ok) { console.log(`✅ ${name} ${extra}`); pass++; }
  else { console.error(`✗ ${name} ${extra}`); fail++; }
}

async function main() {
  const { data: auth, error } = await anon.auth.signInWithPassword({
    email: 'company.test@example.com', password: 'TestPassword123!',
  });
  if (error || !auth.session) { console.error('login failed', error?.message); process.exit(1); }
  const token = auth.session.access_token;
  const { data: cust } = await admin.from('customer').select('id')
    .eq('email', 'company.test@example.com').maybeSingle();
  if (!cust) { console.error('company.test customer missing'); process.exit(1); }
  const cid = cust.id;

  const cleanup = async () => {
    await admin.from('djp_submission_queue').delete()
      .eq('customer_id', cid).eq('tax_type', 'PPh_FINAL')
      .eq('tax_period_month', 12).eq('tax_period_year', 2099);
    await admin.from('tax_monthly_payment').delete()
      .eq('customer_id', cid).eq('tax_period', PERIOD);
  };
  await cleanup();

  const post = (body: object) => fetch(`${BASE}/api/tax/monthly-payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  // 1. 최초 제출 → 행 생성
  const r1 = await post({ action: 'record-monthly-tax', taxType: 'PPh_FINAL', taxPeriod: PERIOD, amountDue: 500000, revenue: 100000000 });
  const j1 = await r1.json();
  check('1. record-monthly-tax 200', r1.status === 200 && j1.success, `status=${r1.status}`);
  const { data: row1 } = await admin.from('tax_monthly_payment').select('id, amount_due, status, notes')
    .eq('customer_id', cid).eq('tax_period', PERIOD).eq('tax_type', 'PPh_FINAL').maybeSingle();
  check('2. tax_monthly_payment 생성', !!row1 && Number(row1.amount_due) === 500000 && row1.status === 'UNPAID');
  check('3. notes 에 고객입력 표기', !!row1?.notes?.includes('[고객입력]'));

  // 2. 재제출 → 갱신 (중복 없음)
  const r2 = await post({ action: 'record-monthly-tax', taxType: 'PPh_FINAL', taxPeriod: PERIOD, amountDue: 750000, revenue: 150000000 });
  check('4. 재제출 200', r2.status === 200);
  const { data: rows } = await admin.from('tax_monthly_payment').select('id, amount_due')
    .eq('customer_id', cid).eq('tax_period', PERIOD).eq('tax_type', 'PPh_FINAL');
  check('5. 중복 생성 없음 + 금액 갱신', rows?.length === 1 && Number(rows[0].amount_due) === 750000, `rows=${rows?.length}`);

  // 3. 큐 자동 생성
  const { data: q } = await admin.from('djp_submission_queue').select('id, status')
    .eq('customer_id', cid).eq('tax_type', 'PPh_FINAL')
    .eq('tax_period_month', 12).eq('tax_period_year', 2099).maybeSingle();
  check('6. 선납법인세 큐 자동 생성', !!q, q ? `status=${q.status}` : 'missing');

  // 4. 검증 계약
  const r3 = await post({ action: 'record-monthly-tax', taxType: 'PPN', taxPeriod: PERIOD, amountDue: 1 });
  check('7. 잘못된 taxType → 400', r3.status === 400, `status=${r3.status}`);
  const r4 = await post({ action: 'record-monthly-tax', taxType: 'PPh_FINAL', taxPeriod: '2099-13', amountDue: 1 });
  check('8. 잘못된 taxPeriod → 400', r4.status === 400, `status=${r4.status}`);

  await cleanup();
  console.log(`\n${fail === 0 ? '✅' : '✗'} ${pass} passed / ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('!!', e); process.exit(1); });
