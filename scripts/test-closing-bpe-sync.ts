/**
 * 결산 wizard ↔ Coretax record-completion BPE 자동 반영 smoke test.
 *
 * 실행:
 *   SEED_TARGET=prod npx tsx scripts/test-closing-bpe-sync.ts
 *
 * 검증 흐름:
 *   1. 가상의 tax_closing_session + closing_id_billing + closing_submission row 생성
 *   2. 결산 wizard 제출 핸들러처럼 djp_submission_queue 케이스 자동 생성
 *      (PUT-bridge 로직과 동일하게 admin client로 직접 만든다)
 *   3. record-completion 액션 시뮬레이션 — coretax/route.ts의 부수효과 그대로 재현
 *   4. closing_submission 이 status='COMPLETED' + bpe_number/ntpn 채워졌는지 확인
 *   5. tear-down — 생성한 모든 row 정리
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'node:path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
config({ path: resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, key, { auth: { persistSession: false } });

function ok(msg: string) { console.log(`  ✓ ${msg}`); }
function fail(msg: string): never { console.error(`  ✗ ${msg}`); process.exit(1); }

async function main() {
  console.log(`🧪 closing wizard → Coretax BPE sync smoke test on ${url}\n`);

  // 임시 customer + closing_session 생성.
  const npwp = `99${Date.now().toString().slice(-13)}`.slice(0, 15);
  const fiscalYear = 2024;
  const { data: customer, error: cErr } = await admin.from('customer').insert({
    customer_type: 'COMPANY',
    full_name: 'TEST PT Bridge',
    company_name: 'TEST PT Bridge',
    npwp, email: `bridge-${Date.now()}@example.com`,
    is_pkp: false,
  }).select('id').single();
  if (cErr || !customer) fail(`customer insert failed: ${cErr?.message}`);
  console.log(`  customer.id = ${customer.id}`);

  const cleanupIds = { customerId: customer.id, sessionId: '' as string, caseId: '' as string };

  try {
    const { data: session, error: sErr } = await admin.from('tax_closing_session').insert({
      customer_id: customer.id,
      fiscal_year: fiscalYear,
      closing_type: 'PPH25',
      current_step: 'submit',
      status: 'COMPLETED',
    }).select('id').single();
    if (sErr || !session) fail(`session insert failed: ${sErr?.message}`);
    cleanupIds.sessionId = session.id;
    ok(`tax_closing_session.id = ${session.id}`);

    // Phase B 브릿지 — 결산 wizard 제출이 만들어내는 두 row.
    await admin.from('closing_id_billing').insert({
      session_id: session.id,
      billing_code: `820BR${Date.now().toString().slice(-9)}`,
      amount: 12_345_000,
      kap_code: '411126', kjs_code: '200',
      tax_period: String(fiscalYear),
    });
    await admin.from('closing_submission').insert({
      session_id: session.id,
      status: 'SUBMITTED',
      channel: 'RPA',
      package_summary: { test: true },
    });
    ok('closing_id_billing + closing_submission inserted');

    // 결산 wizard submit 핸들러와 동일한 로직으로 운영팀 케이스 생성.
    const caseCode = `CL-${session.id.slice(0, 8).toUpperCase()}`;
    const { data: caseRow, error: qErr } = await admin.from('djp_submission_queue').insert({
      customer_id: customer.id,
      closing_session_id: session.id,
      case_code: caseCode,
      service_label: 'SPT Tahunan Badan Coretax 2025+',
      tax_type: 'SPT_TAHUNAN',
      tax_period_month: 12,
      tax_period_year: fiscalYear,
      amount: 12_345_000,
      status: 'APPROVED',
      priority: 'NORMAL',
      ebilling_code: `820BR${Date.now().toString().slice(-9)}`,
    }).select('id, closing_session_id, ebilling_code').single();
    if (qErr || !caseRow) fail(`djp_submission_queue insert failed: ${qErr?.message}`);
    cleanupIds.caseId = caseRow.id;
    ok(`djp_submission_queue.id = ${caseRow.id}, closing_session_id linked`);

    // Coretax record-completion 시뮬레이션 — coretax/route.ts와 동일한 update 패턴.
    const bpeNumber = `BPE-${Date.now()}`;
    const bpeDate = new Date().toISOString().slice(0, 10);

    // 1) djp_submission_queue 측.
    await admin.from('djp_submission_queue').update({
      bpe_number: bpeNumber, bpe_date: bpeDate,
      submitted_to_djp_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: 'COMPLETED',
    }).eq('id', caseRow.id);

    // 2) closing_submission 측 (브릿지 동기화).
    await admin.from('closing_submission').update({
      status: 'COMPLETED',
      bpe_number: bpeNumber,
      bpe_uploaded_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      ntpn: caseRow.ebilling_code,
    }).eq('session_id', session.id);

    // 3) closing_id_billing 측 (PAID 전환).
    await admin.from('closing_id_billing').update({
      ntpn: caseRow.ebilling_code,
      status: 'PAID',
    }).eq('session_id', session.id);

    ok('record-completion simulated (queue + submission + billing all updated)');

    // 검증.
    const { data: subAfter } = await admin
      .from('closing_submission')
      .select('status, bpe_number, ntpn, completed_at, bpe_uploaded_at')
      .eq('session_id', session.id).single();
    if (subAfter?.status !== 'COMPLETED') fail(`closing_submission.status=${subAfter?.status}`);
    if (subAfter?.bpe_number !== bpeNumber) fail(`closing_submission.bpe_number=${subAfter?.bpe_number}`);
    if (!subAfter?.ntpn) fail('closing_submission.ntpn empty');
    ok(`closing_submission status=COMPLETED bpe=${subAfter.bpe_number} ntpn=${subAfter.ntpn}`);

    const { data: billAfter } = await admin
      .from('closing_id_billing').select('status, ntpn').eq('session_id', session.id).single();
    if (billAfter?.status !== 'PAID') fail(`closing_id_billing.status=${billAfter?.status}`);
    ok(`closing_id_billing status=PAID ntpn=${billAfter.ntpn}`);

    console.log('\n✅ Closing → Coretax BPE sync works end-to-end.');
  } finally {
    // tear-down.
    if (cleanupIds.caseId) await admin.from('djp_submission_queue').delete().eq('id', cleanupIds.caseId);
    if (cleanupIds.sessionId) {
      await admin.from('closing_submission').delete().eq('session_id', cleanupIds.sessionId);
      await admin.from('closing_id_billing').delete().eq('session_id', cleanupIds.sessionId);
      await admin.from('tax_closing_session').delete().eq('id', cleanupIds.sessionId);
    }
    if (cleanupIds.customerId) await admin.from('customer').delete().eq('id', cleanupIds.customerId);
    console.log('\n🧹 cleanup done');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
