/**
 * ID Billing 발행 보드 end-to-end smoke (v19 §4/§5 — 트랙 2).
 *
 * 검증 계약:
 *   1. RBAC — customer 403, consultant 200 (board GET)
 *   2. 승인완료 ERP 세션(sentinel) 생성 → 발행대상에 등장 + canIssue=false
 *   3. 작성본 없이 issue → 400 (workbookRequired 게이트)
 *   4. workbook POST → xlsx binary (4시트) + 생성 이력
 *   5. issue → 201 발행 rows (BIL- 일련번호) + 발행대상에서 제거
 *   6. 중복 issue → 404 (이미 발행)
 *   7. 운영팀 큐 APPROVED row → operator 스코프 발행대상 등장 →
 *      workbook + issue → 큐 상태 EBILLING_GENERATED 전이
 *   8. tenant 분리 — external consultant 는 JTC 세션을 못 봄
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/test-id-billing-flow.ts
 * sentinel prefix: [IDBILL-E2E] — 종료 시 전부 삭제.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as XLSX from 'xlsx';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const PASSWORD = 'TestPassword123!';
const SENTINEL = '[IDBILL-E2E]';

let pass = 0;
function ok(msg: string) { pass++; console.log(`  ✓ ${msg}`); }
function fail(msg: string): never { console.error(`  ✗ ${msg}`); process.exit(1); }

async function login(email: string): Promise<string> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) fail(`login failed: ${email} — ${error?.message}`);
  return data.session.access_token;
}

async function api(token: string, method: string, pathName: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> | null; raw: Response }> {
  const res = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json: Record<string, unknown> | null = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) json = await res.json().catch(() => null);
  return { status: res.status, json, raw: res };
}

interface BoardTarget { sourceKind: string; sourceId: string; canIssue: boolean; customer: { name: string } }
function boardTargets(json: Record<string, unknown> | null): BoardTarget[] {
  return ((json?.data as Record<string, unknown> | undefined)?.targets ?? []) as BoardTarget[];
}

async function main() {
  console.log(`🧪 ID Billing issuance flow smoke on ${baseUrl}\n`);
  const cleanup: { sessionId?: string; calcId?: string; queueId?: string; customerId?: string } = {};

  try {
    // ── 0. 준비: EXTERNAL 파트너 / 컨설턴트 / sentinel customer + APPROVED 세션 ──
    // (결정 ①) JTC 소속 consultant 폐지. ID Billing 발행 보드는 공용 컴포넌트로
    // EXTERNAL consultant(Eddy @ PT Mitra Pajak Sentosa)도 사용 → EXTERNAL 테넌트로 검증.
    const EXTERNAL_PARTNER_ID = '00000000-0000-0000-0000-000000000040';
    const { data: consultantUser } = await admin.from('consultant')
      .select('id, user_id, tax_partner_id').eq('tax_partner_id', EXTERNAL_PARTNER_ID).eq('is_active', true).limit(1).single();
    if (!consultantUser) fail('active EXTERNAL consultant not found');
    const jtc = { id: EXTERNAL_PARTNER_ID };

    const { data: customer, error: custErr } = await admin.from('customer').insert({
      customer_type: 'COMPANY',
      full_name: `${SENTINEL} PT Billing Test`,
      company_name: `${SENTINEL} PT Billing Test`,
      npwp: `88${Date.now().toString().slice(-13)}`.slice(0, 15),
      email: `idbill-e2e-${Date.now()}@example.com`,
      is_pkp: false,
    }).select('id').single();
    if (custErr || !customer) fail(`customer insert: ${custErr?.message}`);
    cleanup.customerId = customer.id;

    const { data: session, error: sesErr } = await admin.from('consultant_session').insert({
      customer_id: customer.id,
      tax_partner_id: jtc.id,
      consultant_id: consultantUser.id,
      filing_kind: 'MONTHLY',
      tax_period: '2026-06-01',
      current_step: 5,
      status: 'APPROVED',
      total_estimated_tax: 5_500_000,
    }).select('id').single();
    if (sesErr || !session) fail(`session insert: ${sesErr?.message}`);
    cleanup.sessionId = session.id;

    const { data: calc, error: calcErr } = await admin.from('consultant_session_calc').insert({
      session_id: session.id,
      kind: 'PPH21_TER',
      amount: 5_500_000,
      basis: { grossMonthlyPayroll: 220_000_000, terRate: 0.025 },
      source_summary: `${SENTINEL} synthetic`,
      rationale_summary: 'TER 2.5%',
      confidence: 90,
      is_saved: true,
    }).select('id').single();
    if (calcErr || !calc) fail(`calc insert: ${calcErr?.message}`);
    cleanup.calcId = calc.id;
    ok(`sentinel APPROVED session ready (${session.id.slice(0, 8)}…)`);

    // ── 1. RBAC ──
    const customerToken = await login('customer.test@example.com');
    const r1 = await api(customerToken, 'GET', '/api/id-billing/board');
    if (r1.status !== 403) fail(`customer board expected 403, got ${r1.status}`);
    ok('RBAC: customer → 403');

    const consultantToken = await login('external.consultant@mitrapajak.com');
    const r2 = await api(consultantToken, 'GET', '/api/id-billing/board');
    if (r2.status !== 200) fail(`consultant board expected 200, got ${r2.status}: ${JSON.stringify(r2.json).slice(0, 200)}`);
    ok('RBAC: JTC consultant → 200');

    // ── 2. 발행대상 등장 + canIssue=false ──
    const target = boardTargets(r2.json).find(t => t.sourceId === session.id);
    if (!target) fail('sentinel session not in board targets');
    if (target.canIssue) fail('canIssue must be false before workbook generation');
    ok('APPROVED session appears as target, canIssue=false (게이트 대기)');

    // ── 3. 작성본 없이 발행 → 400 ──
    const r3 = await api(consultantToken, 'POST', '/api/id-billing/issue', { sourceKind: 'ERP_SESSION', sourceId: session.id });
    if (r3.status !== 400) fail(`issue without workbook expected 400, got ${r3.status}`);
    ok('issue without workbook → 400 (백엔드 게이트)');

    // ── 4. 작성본 생성 → xlsx 4시트 ──
    const r4 = await api(consultantToken, 'POST', '/api/id-billing/workbook', {
      targets: [{ sourceKind: 'ERP_SESSION', sourceId: session.id }],
    });
    if (r4.status !== 200) fail(`workbook expected 200, got ${r4.status}: ${JSON.stringify(r4.json).slice(0, 200)}`);
    const buf = Buffer.from(await r4.raw.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const expectSheets = ['README', 'Coretax_Ready', 'Company_Summary', 'Tax_Code_Reference'];
    for (const s of expectSheets) if (!wb.SheetNames.includes(s)) fail(`workbook missing sheet ${s}`);
    const ready = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Coretax_Ready']);
    if (ready.length < 1) fail('Coretax_Ready has no data rows');
    const row = ready[0];
    if (row['Tax Type'] !== 'PPh21' || row['KAP'] !== '411121') fail(`Coretax_Ready row mismatch: ${JSON.stringify(row)}`);
    if (Number(row['Tax Amount']) !== 5_500_000) fail(`Tax Amount mismatch: ${row['Tax Amount']}`);
    ok(`workbook xlsx OK — 4 sheets, PPh21/411121/Rp5.500.000 채워짐 (${buf.length}B)`);

    // ── 5. 발행 → 일련번호 + 발행대상 제거 ──
    const r5 = await api(consultantToken, 'POST', '/api/id-billing/issue', { sourceKind: 'ERP_SESSION', sourceId: session.id });
    if (r5.status !== 200) fail(`issue expected 200, got ${r5.status}: ${JSON.stringify(r5.json).slice(0, 200)}`);
    const issuedRows = ((r5.json?.data as Record<string, unknown>)?.issued ?? []) as Array<{ serial_no: string }>;
    if (issuedRows.length !== 1 || !/^BIL-\d{6}-\d{3}$/.test(issuedRows[0].serial_no)) {
      fail(`unexpected issued rows: ${JSON.stringify(issuedRows)}`);
    }
    ok(`issued with serial ${issuedRows[0].serial_no}`);

    const r6 = await api(consultantToken, 'GET', '/api/id-billing/board');
    if (boardTargets(r6.json).some(t => t.sourceId === session.id)) fail('issued session still in targets');
    ok('issued session removed from targets');

    // ── 6. 중복 발행 → 404 ──
    const r7 = await api(consultantToken, 'POST', '/api/id-billing/issue', { sourceKind: 'ERP_SESSION', sourceId: session.id });
    if (r7.status !== 404) fail(`duplicate issue expected 404, got ${r7.status}`);
    ok('duplicate issue → 404');

    // ── 7. 운영팀 큐 소스 — operator 스코프 + 큐 전이 ──
    const { data: queueRow, error: qErr } = await admin.from('djp_submission_queue').insert({
      customer_id: customer.id,
      tax_type: 'PPh23',
      tax_period_month: 6,
      tax_period_year: 2026,
      amount: 1_250_000,
      status: 'APPROVED',
      notes: `${SENTINEL} synthetic queue row`,
    }).select('id').single();
    if (qErr || !queueRow) fail(`queue insert: ${qErr?.message}`);
    cleanup.queueId = queueRow.id;

    const operatorToken = await login('operator.test@aipajak.com');
    const r8 = await api(operatorToken, 'GET', '/api/id-billing/board');
    if (r8.status !== 200) fail(`operator board expected 200, got ${r8.status}`);
    const qTarget = boardTargets(r8.json).find(t => t.sourceId === queueRow.id);
    if (!qTarget) fail('queue row not in operator board targets');
    ok('operator scope: APPROVED queue row appears as target');

    const r9 = await api(operatorToken, 'POST', '/api/id-billing/workbook', {
      targets: [{ sourceKind: 'OPERATOR_QUEUE', sourceId: queueRow.id }],
    });
    if (r9.status !== 200) fail(`operator workbook expected 200, got ${r9.status}`);
    const r10 = await api(operatorToken, 'POST', '/api/id-billing/issue', {
      sourceKind: 'OPERATOR_QUEUE', sourceId: queueRow.id, billingCode: '820IDBILLE2E01',
    });
    if (r10.status !== 200) fail(`operator issue expected 200, got ${r10.status}: ${JSON.stringify(r10.json).slice(0, 200)}`);
    const { data: qAfter } = await admin.from('djp_submission_queue').select('status, ebilling_code').eq('id', queueRow.id).single();
    if (qAfter?.status !== 'EBILLING_GENERATED') fail(`queue expected EBILLING_GENERATED, got ${qAfter?.status}`);
    if (qAfter?.ebilling_code !== '820IDBILLE2E01') fail(`ebilling_code mismatch: ${qAfter?.ebilling_code}`);
    ok('operator issue → queue APPROVED → EBILLING_GENERATED + billing code 기록');

    // ── 7.5 납부확인 (Coretax API 보류 — NTPN 수동 입력, 2026-08-04) ──────
    const { data: issRow } = await admin.from('id_billing_issuance')
      .select('id').eq('queue_item_id', queueRow.id).single();
    if (!issRow) fail('issuance row for queue sentinel not found');
    const rBad = await api(operatorToken, 'POST', '/api/id-billing/paid', {
      issuanceId: issRow.id, ntpn: 'x',
    });
    if (rBad.status !== 400) fail(`paid with short NTPN expected 400, got ${rBad.status}`);
    ok('paid: short NTPN rejected with 400');

    const rPaid = await api(operatorToken, 'POST', '/api/id-billing/paid', {
      issuanceId: issRow.id, ntpn: 'E2E1234567890123',
    });
    if (rPaid.status !== 200) fail(`paid expected 200, got ${rPaid.status}: ${JSON.stringify(rPaid.json).slice(0, 200)}`);
    const { data: issPaid } = await admin.from('id_billing_issuance')
      .select('status, ntpn, paid_at').eq('id', issRow.id).single();
    if (issPaid?.status !== 'PAID' || issPaid?.ntpn !== 'E2E1234567890123' || !issPaid?.paid_at) {
      fail(`issuance not PAID/ntpn: ${JSON.stringify(issPaid)}`);
    }
    const { data: qPaid } = await admin.from('djp_submission_queue')
      .select('status, ntpn, completed_at').eq('id', queueRow.id).single();
    if (qPaid?.status !== 'COMPLETED' || qPaid?.ntpn !== 'E2E1234567890123') {
      fail(`queue not synced to COMPLETED+ntpn: ${JSON.stringify(qPaid)}`);
    }
    ok('paid: issuance PAID + queue COMPLETED + NTPN 기록');

    const rDup = await api(operatorToken, 'POST', '/api/id-billing/paid', {
      issuanceId: issRow.id, ntpn: 'E2E1234567890123',
    });
    if (rDup.status !== 400) fail(`double paid expected 400, got ${rDup.status}`);
    ok('paid: already-paid rejected with 400');

    // ── 8. scope 분리 — 운영팀(OPERATOR_QUEUE) sentinel 이 EXTERNAL 보드에 안 샘 ──
    // (결정 ①) ERP 세션 sentinel 은 external.consultant(Eddy) 자신의 EXTERNAL 테넌트
    // 데이터라 보이는 게 정상이다. 검증 대상은 "운영팀 스코프(OPERATOR_QUEUE)가
    // EXTERNAL consultant 보드로 새지 않는가" — JTC 운영팀 발행 아이템은 operator 전용.
    const externalToken = await login('external.consultant@mitrapajak.com');
    const r11 = await api(externalToken, 'GET', '/api/id-billing/board');
    if (r11.status !== 200) fail(`external board expected 200, got ${r11.status}`);
    const queueLeak = boardTargets(r11.json).some(t => t.sourceId === queueRow.id);
    const issuedQueueLeak = (((r11.json?.data as Record<string, unknown>)?.issued ?? []) as Array<{ ebilling_code?: string }>)
      .some(x => x.ebilling_code === '820IDBILLE2E01');
    if (queueLeak || issuedQueueLeak) fail('scope isolation broken — operator-queue sentinel visible to EXTERNAL consultant');
    ok('scope isolation: EXTERNAL consultant sees no operator-queue (JTC) sentinel');

    console.log(`\n✅ ${pass} assertions passed`);
  } finally {
    console.log('\n🧹 cleanup');
    if (cleanup.sessionId) {
      await admin.from('id_billing_issuance').delete().eq('session_id', cleanup.sessionId);
      await admin.from('id_billing_workbook_log').delete().eq('session_id', cleanup.sessionId);
    }
    if (cleanup.queueId) {
      await admin.from('id_billing_issuance').delete().eq('queue_item_id', cleanup.queueId);
      await admin.from('id_billing_workbook_log').delete().eq('queue_item_id', cleanup.queueId);
      await admin.from('djp_submission_queue').delete().eq('id', cleanup.queueId);
    }
    if (cleanup.calcId) await admin.from('consultant_session_calc').delete().eq('id', cleanup.calcId);
    if (cleanup.sessionId) await admin.from('consultant_session').delete().eq('id', cleanup.sessionId);
    if (cleanup.customerId) await admin.from('customer').delete().eq('id', cleanup.customerId);
    console.log('   sentinel rows removed');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
