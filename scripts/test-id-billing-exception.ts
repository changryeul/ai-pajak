/**
 * ID Billing 예외 발행 (수정요청 #26) 계약 smoke.
 *
 * 검증 계약:
 *   1. RBAC — customer 는 issue 엔드포인트 403 (requireBillingIssuer)
 *   2. 사유 없이 exception issue → 400 (exceptionReasonRequired)
 *   3. exception issue (사유 포함) → 201 + is_exception=true + issue_reason 각인
 *      + 소스 큐 상태 EBILLING_GENERATED 전이 (승인 없이, DATA_REVIEW 에서)
 *   4. 중복 exception issue → 404 (이미 발행)
 *   5. exception=true 인데 사유<5자 → 400 (zod min)
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/test-id-billing-exception.ts
 * sentinel prefix: [IDBILL-EXC-E2E] — 종료 시 전부 삭제.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const PASSWORD = 'TestPassword123!';
const SENTINEL = '[IDBILL-EXC-E2E]';

let pass = 0;
function ok(msg: string) { pass++; console.log(`  ✓ ${msg}`); }
function fail(msg: string): never { console.error(`  ✗ ${msg}`); process.exit(1); }

async function login(email: string): Promise<string> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) fail(`login failed: ${email} — ${error?.message}`);
  return data.session.access_token;
}

async function api(token: string, method: string, pathName: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json: Record<string, unknown> | null = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  console.log(`🧪 ID Billing exception issuance smoke on ${baseUrl}\n`);
  const cleanup: { customerId?: string; queueId?: string } = {};

  try {
    const operatorToken = await login('operator.test@aipajak.com');
    const customerToken = await login('customer.test@example.com');

    // ── 준비: sentinel customer + DATA_REVIEW 큐 (승인 전) ──
    const { data: customer, error: custErr } = await admin.from('customer').insert({
      customer_type: 'COMPANY',
      full_name: `${SENTINEL} PT Exception Test`,
      company_name: `${SENTINEL} PT Exception Test`,
      email: 'idbill-exc-e2e@example.com',
      npwp: '0987654321',
    }).select('id').single();
    if (custErr || !customer) fail(`customer insert failed: ${custErr?.message}`);
    cleanup.customerId = customer.id;
    ok('sentinel customer created');

    const { data: queue, error: qErr } = await admin.from('djp_submission_queue').insert({
      customer_id: customer.id,
      tax_type: 'PPh23',
      tax_period_month: 11,
      tax_period_year: 2099,
      amount: 3_000_000,
      status: 'DATA_REVIEW', // 승인 전
    }).select('id').single();
    if (qErr || !queue) fail(`queue insert failed: ${qErr?.message}`);
    cleanup.queueId = queue.id;
    ok('pre-approval queue (DATA_REVIEW) created');

    // 1. RBAC — customer 403
    const r1 = await api(customerToken, 'POST', '/api/id-billing/issue', {
      sourceKind: 'OPERATOR_QUEUE', sourceId: queue.id, exception: true, exceptionReason: 'rbac test reason',
    });
    if (r1.status !== 403) fail(`customer should get 403, got ${r1.status}`);
    ok('customer → 403 (requireBillingIssuer)');

    // 2. 사유 없이 → 400
    const r2 = await api(operatorToken, 'POST', '/api/id-billing/issue', {
      sourceKind: 'OPERATOR_QUEUE', sourceId: queue.id, exception: true,
    });
    if (r2.status !== 400) fail(`missing reason should 400, got ${r2.status} ${JSON.stringify(r2.json)}`);
    ok('no reason → 400');

    // 3. 사유 < 5자 → 400 (zod min)
    const r3 = await api(operatorToken, 'POST', '/api/id-billing/issue', {
      sourceKind: 'OPERATOR_QUEUE', sourceId: queue.id, exception: true, exceptionReason: 'no',
    });
    if (r3.status !== 400) fail(`short reason should 400, got ${r3.status}`);
    ok('reason <5 chars → 400');

    // 4. 정상 예외 발행 → 201/200
    const reason = 'Customer deadline; supervisor away — issue now, report after.';
    const r4 = await api(operatorToken, 'POST', '/api/id-billing/issue', {
      sourceKind: 'OPERATOR_QUEUE', sourceId: queue.id, exception: true, exceptionReason: reason,
    });
    if (r4.status !== 200 && r4.status !== 201) fail(`exception issue failed: ${r4.status} ${JSON.stringify(r4.json)}`);
    ok(`exception issue → ${r4.status}`);

    // is_exception + issue_reason 각인 확인
    const { data: issued } = await admin.from('id_billing_issuance')
      .select('id, is_exception, issue_reason').eq('queue_item_id', queue.id);
    if (!issued || issued.length === 0) fail('no issuance row created');
    if (!issued.every(r => r.is_exception === true)) fail('is_exception not set true');
    if (!issued.every(r => (r.issue_reason ?? '') === reason)) fail('issue_reason not stamped');
    ok(`is_exception=true + issue_reason stamped (${issued.length} row)`);

    // 큐 EBILLING_GENERATED 전이 확인
    const { data: qAfter } = await admin.from('djp_submission_queue').select('status').eq('id', queue.id).single();
    if (qAfter?.status !== 'EBILLING_GENERATED') fail(`queue should be EBILLING_GENERATED, got ${qAfter?.status}`);
    ok('queue → EBILLING_GENERATED (승인 없이 전이)');

    // 5. 중복 → 404
    const r5 = await api(operatorToken, 'POST', '/api/id-billing/issue', {
      sourceKind: 'OPERATOR_QUEUE', sourceId: queue.id, exception: true, exceptionReason: reason,
    });
    if (r5.status !== 404) fail(`duplicate should 404, got ${r5.status}`);
    ok('duplicate exception issue → 404');

    console.log(`\n✅ ${pass} assertions passed`);
  } finally {
    // cleanup
    if (cleanup.customerId) {
      await admin.from('id_billing_issuance').delete().eq('customer_id', cleanup.customerId);
    }
    if (cleanup.queueId) await admin.from('djp_submission_queue').delete().eq('id', cleanup.queueId);
    if (cleanup.customerId) await admin.from('customer').delete().eq('id', cleanup.customerId);
    console.log('🧹 cleanup done');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
