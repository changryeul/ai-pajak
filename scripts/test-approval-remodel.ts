/**
 * 승인대기 리모델 smoke (v13 §4 — 트랙 3).
 *
 * 검증 계약:
 *   1. calc POST → ai_amount 분리 저장 (amount = ai_amount)
 *   2. calc PATCH (consultantAmount) → consultant_amount + amount 갱신,
 *      approved_amount 초기화
 *   3. 검토요청 POST (consultant) → OPEN
 *   4. SUBMIT 후 supervisor APPROVE → 400 (OPEN 검토요청 게이트)
 *   5. supervisor 검토요청 PATCH (의견) → ANSWERED / consultant 는 403
 *   6. APPROVE → 200, calc.approved_amount = 상담원 처리값 스탬프
 *   7. supervisor approval detail 에 reviewRequests + 4-값 포함
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/test-approval-remodel.ts
 * sentinel prefix: [APPRV-E2E] — 종료 시 전부 삭제.
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
const SENTINEL = '[APPRV-E2E]';

let pass = 0;
function ok(msg: string) { pass++; console.log(`  ✓ ${msg}`); }
function fail(msg: string): never { console.error(`  ✗ ${msg}`); process.exit(1); }

async function login(email: string): Promise<string> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) fail(`login failed: ${email} — ${error?.message}`);
  return data.session.access_token;
}

async function api(token: string, method: string, p: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

async function main() {
  console.log(`🧪 approval remodel smoke on ${baseUrl}\n`);
  const cleanup: { sessionId?: string; customerId?: string } = {};

  try {
    // (결정 ①) JTC consultant 폐지 → ERP 승인 흐름은 EXTERNAL(Eddy @ PT Mitra Pajak Sentosa) 테넌트로 검증.
    const EXTERNAL_PARTNER_ID = '00000000-0000-0000-0000-000000000040';
    const jtc = { id: EXTERNAL_PARTNER_ID };
    const { data: consultantRow } = await admin.from('consultant')
      .select('id, user_id').eq('tax_partner_id', EXTERNAL_PARTNER_ID).eq('is_active', true).limit(1).single();
    if (!consultantRow) fail('active EXTERNAL consultant not found');

    const { data: customer } = await admin.from('customer').insert({
      customer_type: 'COMPANY',
      full_name: `${SENTINEL} PT Approval Test`,
      company_name: `${SENTINEL} PT Approval Test`,
      npwp: `77${Date.now().toString().slice(-13)}`.slice(0, 15),
      email: `apprv-e2e-${Date.now()}@example.com`,
      is_pkp: false,
    }).select('id').single();
    if (!customer) fail('customer insert failed');
    cleanup.customerId = customer.id;

    const { data: session } = await admin.from('consultant_session').insert({
      customer_id: customer.id,
      tax_partner_id: jtc!.id,
      consultant_id: consultantRow.id,
      filing_kind: 'MONTHLY',
      tax_period: '2026-06-01',
      current_step: 3,
      status: 'REVIEWING',
    }).select('id').single();
    if (!session) fail('session insert failed');
    cleanup.sessionId = session.id;
    ok(`sentinel session ready (${session.id.slice(0, 8)}…)`);

    const consultantToken = await login('external.consultant@mitrapajak.com');
    const supervisorToken = await login('supervisor.test@aipajak.com');

    // ── 1. calc POST → ai_amount 분리 ──
    const r1 = await api(consultantToken, 'POST', `/api/consultant-erp/sessions/${session.id}/calc`, {
      kind: 'PPH21_TER',
      input: { grossMonthlyPayroll: 100_000_000 },
      save: true,
    });
    if (r1.status !== 200) fail(`calc POST expected 200, got ${r1.status}: ${JSON.stringify(r1.json).slice(0, 200)}`);
    const row1 = (r1.json?.data as Record<string, unknown>)?.row as Record<string, unknown>;
    if (Number(row1.ai_amount) !== Number(row1.amount)) fail(`ai_amount(${row1.ai_amount}) !== amount(${row1.amount})`);
    if (row1.consultant_amount !== null) fail('consultant_amount should start null');
    const aiAmount = Number(row1.ai_amount);
    ok(`calc saved — ai_amount=${aiAmount} (= amount), consultant_amount=null`);

    // ── 2. calc PATCH — 상담원 처리값 ──
    const overridden = aiAmount + 250_000;
    const r2 = await api(consultantToken, 'PATCH', `/api/consultant-erp/sessions/${session.id}/calc`, {
      kind: 'PPH21_TER',
      consultantAmount: overridden,
    });
    if (r2.status !== 200) fail(`calc PATCH expected 200, got ${r2.status}: ${JSON.stringify(r2.json).slice(0, 200)}`);
    const row2 = r2.json?.data as Record<string, unknown>;
    if (Number(row2.consultant_amount) !== overridden || Number(row2.amount) !== overridden) {
      fail(`override mismatch: consultant=${row2.consultant_amount}, amount=${row2.amount}`);
    }
    if (row2.approved_amount !== null) fail('approved_amount must reset on adjust');
    ok(`consultant override — amount=${overridden}, approved_amount reset`);

    // ── 3. 검토요청 생성 ──
    const r3 = await api(consultantToken, 'POST', `/api/consultant-erp/sessions/${session.id}/review-requests`, {
      calcKind: 'PPH21_TER',
      itemLabel: `${SENTINEL} NPWP/NIK 처리 기준 확인`,
      reason: 'NIK 만 있는 직원 2명의 TER 카테고리 적용이 맞는지 확신이 없습니다.',
    });
    if (r3.status !== 201) fail(`review-request POST expected 201, got ${r3.status}`);
    const rrId = (r3.json?.data as Record<string, unknown>)?.id as string;
    ok(`review request created (OPEN, ${rrId.slice(0, 8)}…)`);

    // ── 4. SUBMIT → APPROVE 는 OPEN 게이트로 400 ──
    const rSubmit = await api(consultantToken, 'POST', `/api/consultant-erp/sessions/${session.id}/approval`, { action: 'SUBMIT' });
    if (rSubmit.status !== 200) fail(`SUBMIT expected 200, got ${rSubmit.status}`);
    const r4 = await api(supervisorToken, 'POST', `/api/consultant-erp/sessions/${session.id}/approval`, { action: 'APPROVE' });
    if (r4.status !== 400 || (r4.json as Record<string, unknown>)?.errorKey !== 'openReviewRequests') {
      fail(`APPROVE with OPEN request expected 400/openReviewRequests, got ${r4.status}: ${JSON.stringify(r4.json).slice(0, 150)}`);
    }
    ok('APPROVE blocked (400 openReviewRequests) while request is OPEN');

    // ── 5. 의견 작성 — consultant 403, supervisor 200 ──
    const r5a = await api(consultantToken, 'PATCH', `/api/operator/supervisor/review-requests/${rrId}`, {
      supervisorComment: 'should fail',
    });
    if (r5a.status !== 403) fail(`consultant PATCH expected 403, got ${r5a.status}`);
    const r5b = await api(supervisorToken, 'PATCH', `/api/operator/supervisor/review-requests/${rrId}`, {
      supervisorComment: 'NIK-only 직원은 TER A 카테고리로 처리하는 것이 맞습니다. 승인 진행합니다.',
    });
    if (r5b.status !== 200) fail(`supervisor PATCH expected 200, got ${r5b.status}: ${JSON.stringify(r5b.json).slice(0, 150)}`);
    ok('review request answered — consultant 403 / supervisor 200 → ANSWERED');

    // ── 6. APPROVE → approved_amount 스탬프 ──
    const r6 = await api(supervisorToken, 'POST', `/api/consultant-erp/sessions/${session.id}/approval`, { action: 'APPROVE' });
    if (r6.status !== 200) fail(`APPROVE expected 200, got ${r6.status}: ${JSON.stringify(r6.json).slice(0, 150)}`);
    const { data: calcAfter } = await admin
      .from('consultant_session_calc')
      .select('approved_amount, approved_at, amount')
      .eq('session_id', session.id)
      .eq('kind', 'PPH21_TER')
      .single();
    if (Number(calcAfter?.approved_amount) !== overridden || !calcAfter?.approved_at) {
      fail(`approved_amount stamp mismatch: ${calcAfter?.approved_amount}`);
    }
    ok(`APPROVED — approved_amount=${overridden} 스탬프 (상담원 처리값 채택)`);

    // ── 7. supervisor detail 에 reviewRequests + 4-값 ──
    const r7 = await api(supervisorToken, 'GET', `/api/operator/supervisor/approval/${session.id}`);
    if (r7.status !== 200) fail(`detail expected 200, got ${r7.status}`);
    const detail = r7.json?.data as Record<string, unknown>;
    const rrList = (detail.reviewRequests ?? []) as Array<Record<string, unknown>>;
    if (!rrList.some(x => x.id === rrId && x.status === 'ANSWERED')) fail('detail missing ANSWERED review request');
    const calcs = (detail.calcs ?? []) as Array<Record<string, unknown>>;
    const c = calcs.find(x => x.kind === 'PPH21_TER');
    if (!c || c.ai_amount == null || c.consultant_amount == null || c.approved_amount == null) {
      fail(`detail calc missing 4-value columns: ${JSON.stringify(c).slice(0, 200)}`);
    }
    ok('supervisor detail — reviewRequests + 4-값(ai/consultant/approved) 포함');

    console.log(`\n✅ ${pass} assertions passed`);
  } finally {
    console.log('\n🧹 cleanup');
    if (cleanup.sessionId) {
      await admin.from('consultant_review_request').delete().eq('session_id', cleanup.sessionId);
      await admin.from('consultant_session_calc').delete().eq('session_id', cleanup.sessionId);
      await admin.from('consultant_session_approval').delete().eq('session_id', cleanup.sessionId);
      await admin.from('id_billing_issuance').delete().eq('session_id', cleanup.sessionId);
      await admin.from('id_billing_workbook_log').delete().eq('session_id', cleanup.sessionId);
      await admin.from('consultant_session').delete().eq('id', cleanup.sessionId);
    }
    if (cleanup.customerId) await admin.from('customer').delete().eq('id', cleanup.customerId);
    console.log('   sentinel rows removed');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
