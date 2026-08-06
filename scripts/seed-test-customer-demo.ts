/**
 * Fill the two test customer accounts with realistic demo data so the test
 * login shows non-empty pages (for screenshots, demos, manual QA).
 *
 * - company.test@example.com  (COMPANY)    — 직원 3 + PPh23 5 + PPh4(2) 2 + PPN 4 + SPT Masa 상태 2 + chat 1
 * - customer.test@example.com (INDIVIDUAL) — billing 1건 (PENDING_PAYMENT)
 *
 * Usage:
 *   SEED_TARGET=prod npx tsx scripts/seed-test-customer-demo.ts           # seed (cleanup → fresh)
 *   SEED_TARGET=prod npx tsx scripts/seed-test-customer-demo.ts --cleanup # cleanup only
 *
 * Idempotent: cleanup-first 패턴이라 여러 번 돌려도 중복 안 됨.
 * 2026-06-20 작업 직후의 빈 상태에서 데모용 데이터를 한 번에 채울 때 사용.
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`✗ ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const COMPANY_ID = '00000000-0000-4000-8000-000000000011';
const INDIVIDUAL_ID = '880308b0-a346-442a-9ee4-ec347034a6b2';
const PERIOD = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
const CLEANUP_ONLY = process.argv.includes('--cleanup');

const SEP = '─'.repeat(60);

async function cleanup() {
  console.log(`▶ cleanup — 두 테스트 customer 의 누적 데이터 제거`);
  const ids = [COMPANY_ID, INDIVIDUAL_ID];
  const { data: threads } = await admin.from('customer_ai_thread').select('id').in('customer_id', ids);
  const threadIds = (threads ?? []).map((t: { id: string }) => t.id);
  if (threadIds.length) {
    await admin.from('customer_ai_message').delete().in('thread_id', threadIds);
    await admin.from('customer_ai_draft').delete().in('thread_id', threadIds);
  }
  await admin.from('monthly_payslip').delete().in('customer_id', ids);
  await admin.from('djp_submission_queue').delete().in('customer_id', ids);
  await admin.from('spt_masa_submission_request').delete().in('customer_id', ids);
  await admin.from('pph23_transaction').delete().in('customer_id', ids);
  await admin.from('pph26_transaction').delete().in('customer_id', ids);
  await admin.from('ppn_faktur_monthly').delete().in('customer_id', ids);
  await admin.from('tax_calculation').delete().in('customer_id', ids);
  await admin.from('employee_payroll').delete().in('customer_id', ids);
  await admin.from('tax_counterparty').delete().in('customer_id', ids);
  await admin.from('document').delete().in('customer_id', ids);
  await admin.from('tax_filing').delete().in('customer_id', ids);
  await admin.from('customer_ai_thread').delete().in('customer_id', ids);
  await admin.from('customer_subscription').delete().in('customer_id', ids);
  await admin.from('billing_transaction').delete().in('customer_id', ids);
  await admin.from('company_shareholder').delete().in('customer_id', ids);
  console.log(`  ✅ done`);
}

async function getActiveConsultantId(): Promise<string> {
  const { data } = await admin.from('consultant').select('id').eq('is_active', true).limit(1).maybeSingle();
  const id = (data as { id: string } | null)?.id;
  if (!id) throw new Error('no active consultant available');
  return id;
}

async function getCustomerUserId(customerId: string): Promise<string | null> {
  const { data } = await admin.from('customer').select('user_id').eq('id', customerId).maybeSingle();
  return (data as { user_id: string | null } | null)?.user_id ?? null;
}

async function seedCompany() {
  console.log(`${SEP}\n▶ company.test (COMPANY) — period ${PERIOD}\n${SEP}`);

  // 1. 직원 3명
  const employees = [
    { customer_id: COMPANY_ID, employee_name: 'Andi Wijaya',  employee_npwp: '01.234.567.8-001.000', employee_nik: '3201111111110001', ptkp_category: 'K2',  gross_salary: 15_000_000, position_allowance: 2_500_000, jht_employee: 300_000, jp_employee: 150_000, worker_type: 'REGULAR', is_active: true, position: 'Senior Engineer', department: 'IT' },
    { customer_id: COMPANY_ID, employee_name: 'Sari Lestari', employee_npwp: null,                    employee_nik: '3202222222220002', ptkp_category: 'TK0', gross_salary:  8_000_000, position_allowance:   500_000, jht_employee: 160_000, jp_employee:  80_000, worker_type: 'REGULAR', is_active: true, position: 'Analyst',         department: 'HR' },
    { customer_id: COMPANY_ID, employee_name: 'Budi Hartono', employee_npwp: '02.345.678.9-002.000', employee_nik: '3203333333330003', ptkp_category: 'K1',  gross_salary: 25_000_000, position_allowance: 4_000_000, jht_employee: 500_000, jp_employee: 250_000, worker_type: 'REGULAR', is_active: true, position: 'Director',        department: 'Operations' },
  ];
  const { data: emps, error: empErr } = await admin.from('employee_payroll').insert(employees).select('id, employee_name');
  if (empErr) { console.log(`  ✗ employees: ${empErr.message}`); return; }
  console.log(`  ✅ employee_payroll: ${emps?.length ?? 0}`);

  // 2. PPh23 거래 5건
  const pph23Rows = [
    { customer_id: COMPANY_ID, tax_period: PERIOD, transaction_date: `${PERIOD}-05`, description: 'Jasa konsultasi hukum',     service_type: 'JASA_KONSULTAN', income_type: 'JASA_LAINNYA', tax_regime: 'PPH23', gross_amount: 10_000_000, tax_rate: 0.02, tax_amount: 200_000,   counterparty_name: 'PT Konsultan Hukum Jaya',  counterparty_npwp: '03.456.789.0-001.000', invoice_number: 'KHJ/2026/06/001' },
    { customer_id: COMPANY_ID, tax_period: PERIOD, transaction_date: `${PERIOD}-08`, description: 'Sewa alat berat ekskavator', service_type: 'SEWA',           income_type: 'SEWA',         tax_regime: 'PPH23', gross_amount: 50_000_000, tax_rate: 0.02, tax_amount: 1_000_000, counterparty_name: 'CV Sewa Alat Berat',       counterparty_npwp: '04.567.890.1-002.000', invoice_number: 'SAB/2026/06/045' },
    { customer_id: COMPANY_ID, tax_period: PERIOD, transaction_date: `${PERIOD}-12`, description: 'Jasa pengiriman dokumen',   service_type: 'JASA_LAINNYA',    income_type: 'JASA_LAINNYA', tax_regime: 'PPH23', gross_amount:  3_500_000, tax_rate: 0.02, tax_amount:    70_000, counterparty_name: 'PT Pertama Logistic',      counterparty_npwp: '05.678.901.2-003.000', invoice_number: 'PL/2026/06/077' },
    { customer_id: COMPANY_ID, tax_period: PERIOD, transaction_date: `${PERIOD}-18`, description: 'Jasa cleaning service',      service_type: 'JASA_LAINNYA',    income_type: 'JASA_LAINNYA', tax_regime: 'PPH23', gross_amount:  2_000_000, tax_rate: 0.02, tax_amount:    40_000, counterparty_name: 'CV Bersih Sentosa',        counterparty_npwp: '06.789.012.3-004.000', invoice_number: 'BS/2026/06/120' },
    { customer_id: COMPANY_ID, tax_period: PERIOD, transaction_date: `${PERIOD}-22`, description: 'Catering rapat bulanan',      service_type: 'JASA_LAINNYA',    income_type: 'JASA_LAINNYA', tax_regime: 'PPH23', gross_amount:  5_000_000, tax_rate: 0.02, tax_amount:   100_000, counterparty_name: 'CV Catering Sehat',        counterparty_npwp: '07.890.123.4-005.000', invoice_number: 'CCS/2026/06/200' },
  ];
  const { error: p23Err } = await admin.from('pph23_transaction').insert(pph23Rows);
  if (p23Err) console.log(`  ✗ pph23: ${p23Err.message}`); else console.log(`  ✅ pph23_transaction (PPh23): ${pph23Rows.length}`);

  // 3. PPh4(2) 임대 2건
  const pph42Rows = [
    { customer_id: COMPANY_ID, tax_period: PERIOD, transaction_date: `${PERIOD}-01`, description: '[PPh4(2)] Sewa kantor Juni 2026',             service_type: 'SEWA', income_type: 'SEWA', tax_regime: 'PPH4_2', rental_asset_type: 'BUILDING_LAND', gross_amount: 30_000_000, tax_rate: 0.10, tax_amount: 3_000_000, counterparty_name: 'PT Gedung Office Park', counterparty_npwp: '08.901.234.5-006.000', invoice_number: 'GOP/2026/Q2/012' },
    { customer_id: COMPANY_ID, tax_period: PERIOD, transaction_date: `${PERIOD}-10`, description: '[PPh4(2)] Sewa gudang penyimpanan Juni 2026',  service_type: 'SEWA', income_type: 'SEWA', tax_regime: 'PPH4_2', rental_asset_type: 'BUILDING_LAND', gross_amount: 15_000_000, tax_rate: 0.10, tax_amount: 1_500_000, counterparty_name: 'PT Logistik Warehouse',  counterparty_npwp: '09.012.345.6-007.000', invoice_number: 'LW/2026/06/032' },
  ];
  const { error: p42Err } = await admin.from('pph23_transaction').insert(pph42Rows);
  if (p42Err) console.log(`  ✗ pph42: ${p42Err.message}`); else console.log(`  ✅ pph23_transaction (PPh4(2)): ${pph42Rows.length}`);

  // 4. PPN faktur (1 KELUARAN + 3 MASUKAN). 컬럼: 스키마에 description 없음.
  const ppnRows = [
    { customer_id: COMPANY_ID, tax_period: PERIOD, faktur_type: 'KELUARAN', faktur_date: `${PERIOD}-15`, faktur_number: '040.000-26.00000001', counterparty_name: 'PT Pelanggan Satu', counterparty_npwp: '11.111.111.1-001.000', dpp: 25_000_000, ppn: 3_000_000 },
    { customer_id: COMPANY_ID, tax_period: PERIOD, faktur_type: 'MASUKAN',  faktur_date: `${PERIOD}-03`, faktur_number: '010.000-26.00000011', counterparty_name: 'PT Vendor Satu',    counterparty_npwp: '12.222.222.2-001.000', dpp:  5_000_000, ppn:   600_000 },
    { customer_id: COMPANY_ID, tax_period: PERIOD, faktur_type: 'MASUKAN',  faktur_date: `${PERIOD}-09`, faktur_number: '010.000-26.00000012', counterparty_name: 'CV Vendor Dua',     counterparty_npwp: '13.333.333.3-002.000', dpp: 12_000_000, ppn: 1_440_000 },
    { customer_id: COMPANY_ID, tax_period: PERIOD, faktur_type: 'MASUKAN',  faktur_date: `${PERIOD}-21`, faktur_number: '010.000-26.00000013', counterparty_name: 'PT Vendor Tiga',    counterparty_npwp: '14.444.444.4-003.000', dpp:  6_500_000, ppn:   780_000 },
  ];
  const { error: ppnErr } = await admin.from('ppn_faktur_monthly').insert(ppnRows);
  if (ppnErr) console.log(`  ✗ ppn: ${ppnErr.message}`); else console.log(`  ✅ ppn_faktur_monthly: ${ppnRows.length}`);

  // 5. customer_ai chat thread + 메시지 + spt_masa_submission_request 2 종 (PENDING + PROCESSED)
  const userId = await getCustomerUserId(COMPANY_ID);
  const { data: thread, error: threadErr } = await admin.from('customer_ai_thread').insert({
    customer_id: COMPANY_ID,
    customer_user_id: userId,
    context_kind: 'PPH23',
    context_period: PERIOD,
    status: 'AWAITING_OPERATOR',
    operator_unread_count: 1,
    last_customer_message_at: new Date().toISOString(),
  }).select('id').single();
  if (threadErr) { console.log(`  ✗ thread: ${threadErr.message}`); return; }
  console.log(`  ✅ customer_ai_thread: 1 (${thread!.id.slice(0, 8)})`);

  const totalGross = pph23Rows.reduce((s, r) => s + r.gross_amount, 0);
  const totalTax = pph23Rows.reduce((s, r) => s + r.tax_amount, 0);
  await admin.from('customer_ai_message').insert({
    thread_id: thread!.id,
    sender_role: 'customer',
    content: [
      `📨 SPT Masa PPh 23 제출 요청 — ${PERIOD}`,
      `• 거래 ${pph23Rows.length} 건`,
      `• 총 DPP: Rp ${totalGross.toLocaleString('id-ID')}`,
      `• 총 PPh: Rp ${totalTax.toLocaleString('id-ID')}`,
      `→ 검토 후 SPT Masa 생성 부탁드립니다.`,
    ].join('\n'),
  });
  console.log(`  ✅ customer_ai_message: 1 (customer → operator)`);

  // PPh23 PENDING (검토 대기 25분 전)
  await admin.from('spt_masa_submission_request').insert({
    customer_id: COMPANY_ID, tax_type: 'PPh23', tax_period: PERIOD, status: 'PENDING',
    thread_id: thread!.id,
    requested_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  });
  console.log(`  ✅ spt_masa_submission_request: 1 PENDING (PPh23)`);

  // PPh4(2) PROCESSED (filing 있음, 30분 전 처리)
  const consultantId = await getActiveConsultantId();
  const { data: filing } = await admin.from('tax_filing').insert({
    customer_id: COMPANY_ID,
    consultant_id: consultantId,
    tax_type: 'PPh42',
    tax_period: PERIOD,
    status: 'DRAFT',
    tax_data: {
      spt_masa_result: {
        tax_type: 'PPh4_2',
        period: PERIOD,
        total_gross_income: 45_000_000,
        total_tax_withheld: 4_500_000,
        total_net_payable: 4_500_000,
        item_count: 2,
        submission_deadline: `${PERIOD.slice(0, 4)}-${String(Number(PERIOD.slice(5)) + 1).padStart(2, '0')}-20`,
      },
    },
  }).select('id').single();
  if (filing) {
    await admin.from('spt_masa_submission_request').insert({
      customer_id: COMPANY_ID, tax_type: 'PPh42', tax_period: PERIOD, status: 'PROCESSED',
      thread_id: thread!.id,
      requested_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      processed_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      filing_id: filing.id,
    });
    console.log(`  ✅ tax_filing (PPh42) + spt_masa_submission_request: 1 PROCESSED`);
  }
}

async function seedIndividual() {
  console.log(`${SEP}\n▶ customer.test (INDIVIDUAL) — period ${PERIOD}\n${SEP}`);
  // 필요한 FK: jtc tax_partner + platform_owner
  const { data: jtc } = await admin.from('tax_partner').select('id').eq('partner_type', 'JTC').eq('is_default_filing_partner', true).limit(1).maybeSingle();
  const { data: platform } = await admin.from('platform_owner').select('id').limit(1).maybeSingle();
  if (!jtc?.id || !platform?.id) {
    console.log(`  ✗ billing skipped — jtc or platform_owner missing`);
    return;
  }
  const amountBase = 200_000;
  const amountTax = 22_000;
  const amountTotal = amountBase + amountTax;
  const { error } = await admin.from('billing_transaction').insert({
    idempotency_key: `DEMO-IND-${INDIVIDUAL_ID}-${PERIOD}-${Date.now()}`,
    customer_id: INDIVIDUAL_ID,
    tax_partner_id: jtc.id,
    platform_owner_id: platform.id,
    transaction_type: 'TAX_SERVICE',
    service_type: 'TAX_FILING',
    description: `1770SS filing service (demo, ${PERIOD})`,
    amount_base: amountBase,
    amount_tax: amountTax,
    amount_total: amountTotal,
    platform_fee: 0,
    tax_service_fee: amountTotal,
    currency: 'IDR',
    invoice_number: `INV-IND-${PERIOD}-DEMO`,
    payment_status: 'PENDING',
    billing_period: PERIOD.slice(0, 4),
    metadata: { source: 'seed-demo' },
  });
  if (error) console.log(`  ✗ billing: ${error.message}`); else console.log(`  ✅ billing_transaction: 1 PENDING`);
}

async function main() {
  console.log(`SEED_TARGET=${process.env.SEED_TARGET ?? 'local'}  period=${PERIOD}  mode=${CLEANUP_ONLY ? 'CLEANUP_ONLY' : 'SEED'}`);
  await cleanup();
  if (CLEANUP_ONLY) {
    console.log('\n— cleanup-only mode, done —');
    return;
  }
  await seedCompany();
  await seedIndividual();
  console.log(`\n${SEP}\n✅ 데모 데이터 채우기 완료`);
  console.log(`  · company.test → /tax/pph23, /tax/pph42, /tax/ppn, /tax/pph21, chat`);
  console.log(`  · customer.test → /tax/billing`);
  console.log(`  · operator inbox → '검토 대기 1건' 패널 + thread 1개`);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
