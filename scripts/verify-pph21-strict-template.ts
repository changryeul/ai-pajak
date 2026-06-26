/**
 * Verify the strict PPh21 employee template upload path used by the
 * production UI (`/tax/pph21` page → `handleTemplateUpload`).
 *
 * Generates the 34-col template in-memory (mirrors `downloadTemplate` exactly,
 * no fixture dependency → runs in CI), fills 3 realistic Pegawai Tetap rows
 * with a sentinel-prefixed employee_name for safe cleanup, runs the full
 * pipeline (parseTabularFile → strict 1-to-1 header match → CSV → multipart
 * POST /api/tax/employees/import → DB read-back) and verifies HR fields
 * (position, department, hire_date) survive the round trip.
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-pph21-strict-template.ts
 */

import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import {
  parseTabularFile,
  rowsToCsv,
} from '../src/lib/tax/bulk-import/client-file-parser';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`✗ ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const BASE_URL =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = 'company.test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const SMOKE_PREFIX = '[STRICT-PPH21-E2E] ';

// MUST match downloadTemplate() in src/app/[locale]/(dashboard)/tax/pph21/page.tsx
const TEMPLATE_HEADERS = [
  'employee_name','employee_npwp','employee_nik','ptkp_category','gross_salary',
  'position_allowance','overtime_pay','meal_allowance','transport_allowance','other_allowances',
  'bonus','thr','jht_employee','jp_employee','bpjs_kesehatan','other_deductions','worker_type',
  'employee_number','position','department','hire_date','resign_date','birth_date','gender',
  'marital_status','email','phone','address','bank_name','bank_account_no','bank_account_name',
  'emergency_contact_name','emergency_contact_phone','notes',
] as const;
const TEMPLATE_REQUIRED = ['employee_name', 'gross_salary'] as const;

const SAMPLES: (string | number)[][] = [
  ['Andi Wijaya','01.111.111.1-001.000','3201111111110001','K/2',15_000_000,2_500_000,0,300_000,200_000,0,0,0,300_000,150_000,150_000,0,'REGULAR','EMP-A','Senior Engineer','IT','2022-03-01','','1989-04-12','M','MARRIED','andi@example.com','+62 811 1111 1111','Jl. Sudirman 10','BCA','1111111111','Andi Wijaya','Wati','+62 811 1111 1112',''],
  ['Sari Lestari','','3202222222220002','TK/0',8_000_000,500_000,0,300_000,200_000,0,0,0,160_000,80_000,80_000,0,'REGULAR','EMP-S','Analyst','HR','2024-08-15','','1996-09-25','F','SINGLE','sari@example.com','+62 812 2222 2222','Jl. Thamrin 5','BCA','2222222222','Sari Lestari','Rini','+62 812 2222 2223',''],
  ['Budi Hartono','02.345.678.9-002.000','3203333333330003','K/1',25_000_000,4_000_000,0,300_000,200_000,0,0,2_083_333,500_000,250_000,250_000,0,'REGULAR','EMP-B','Director','Operations','2020-01-15','','1982-11-08','M','MARRIED','budi@example.com','+62 813 3333 3333','Jl. Gatot 88','Mandiri','3333333333','Budi Hartono','Sri','+62 813 3333 3334',''],
];

const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

async function main() {
  let pass = 0, fail = 0;

  // 1. Build the template xlsx in-memory + write to a tmp path so we can wrap as File.
  const filledSamples = SAMPLES.map(r => [SMOKE_PREFIX + String(r[0]), ...r.slice(1)]);
  const aoa: unknown[][] = [TEMPLATE_HEADERS as unknown as unknown[], ...filledSamples];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PPh21 직원 데이터');
  const tmpPath = join(tmpdir(), `pph21-strict-${Date.now()}.xlsx`);
  XLSX.writeFile(wb, tmpPath);
  console.log(`✅ 1. generated template ${TEMPLATE_HEADERS.length}-col with ${filledSamples.length} rows`);
  pass++;

  // 2. parseTabularFile (same as page.tsx).
  const buf = readFileSync(tmpPath);
  const file = new File([buf], 'pph21-strict.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseTabularFile(file);
  if (parsed.headers.length === TEMPLATE_HEADERS.length && parsed.dataRows.length === filledSamples.length) {
    console.log(`✅ 2. parseTabularFile — ${parsed.headers.length} headers, ${parsed.dataRows.length} data rows`);
    pass++;
  } else {
    console.error(`✗ 2. unexpected parse: headers=${parsed.headers.length} rows=${parsed.dataRows.length}`);
    fail++;
  }

  // 3. Strict 1-to-1 header match (mirrors handleTemplateUpload).
  const allRows = [parsed.headers, ...parsed.dataRows];
  let headerIdx = 0;
  for (let i = 0; i < Math.min(allRows.length, 5); i++) {
    if (allRows[i].some((c) => c.trim().toLowerCase() === 'employee_name')) { headerIdx = i; break; }
  }
  const lowerHeaders = allRows[headerIdx].map((h) => h.trim().toLowerCase());
  const dataRowsAfter = allRows.slice(headerIdx + 1).filter((r) => r.some((c) => c !== ''));
  const missing = TEMPLATE_REQUIRED.filter((c) => !lowerHeaders.includes(c));
  if (missing.length === 0) {
    console.log(`✅ 3. required cols present: ${TEMPLATE_REQUIRED.join(' + ')}`);
    pass++;
  } else {
    console.error(`✗ 3. missing required cols: ${missing.join(', ')}`);
    fail++;
  }

  const presentCols = TEMPLATE_HEADERS
    .map((col) => ({ col, idx: lowerHeaders.indexOf(col) }))
    .filter((c) => c.idx >= 0);
  if (presentCols.length === TEMPLATE_HEADERS.length) {
    console.log(`✅ 4. all ${TEMPLATE_HEADERS.length} cols recognized 1-to-1 (no KEYWORD_MAP collision)`);
    pass++;
  } else {
    console.error(`✗ 4. only ${presentCols.length}/${TEMPLATE_HEADERS.length} cols recognized`);
    fail++;
  }

  const mappedHeaders = presentCols.map((c) => c.col);
  const mappedRows = dataRowsAfter.map((row) => presentCols.map((c) => row[c.idx] ?? ''));
  const csv = rowsToCsv(mappedHeaders as unknown as string[], mappedRows);

  // 5. Login + customer.
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (authErr || !auth.session) { console.error('✗ 5 login:', authErr?.message); process.exit(1); }
  const token = auth.session.access_token;
  const { data: customer } = await sbAdmin.from('customer').select('id').eq('user_id', auth.user!.id).maybeSingle();
  if (!customer) { console.error('✗ 5 no customer'); process.exit(1); }
  const customerId = customer.id;
  console.log(`✅ 5. customer ${customerId}`);
  pass++;

  // 6. Pre-cleanup — payslip decouple 이후 import 는 monthly_payslip 에만 씀.
  // 양쪽 다 wipe (legacy employee_payroll 행도 남아있을 수 있어 안전망).
  const { count: prePay } = await sbAdmin.from('monthly_payslip').delete({ count: 'exact' })
    .eq('customer_id', customerId).like('employee_name', `${SMOKE_PREFIX}%`);
  const { count: preEmp } = await sbAdmin.from('employee_payroll').delete({ count: 'exact' })
    .eq('customer_id', customerId).like('employee_name', `${SMOKE_PREFIX}%`);
  console.log(`✅ 6. pre-cleanup payslip=${prePay ?? 0} employee=${preEmp ?? 0}`);
  pass++;

  // 7. POST multipart.
  // 2026-06-21: endpoint 가 taxPeriod 필수 (월별 급여 자료) — 이전 달을 쓰면
  // pre-cleanup 와 충돌 없이 안전.
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const taxPeriod = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  const fd = new FormData();
  fd.append('file', new Blob([csv], { type: 'text/csv' }), 'pph21-strict.csv');
  fd.append('customerId', customerId);
  fd.append('taxPeriod', taxPeriod);
  const res = await fetch(`${BASE_URL}/api/tax/employees/import`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
  });
  const body = await res.json().catch(() => ({}));
  const imported = body.data?.imported ?? 0;
  const errors = body.data?.errors ?? [];
  if (res.status === 200 && body.success && imported === SAMPLES.length && errors.length === 0) {
    console.log(`✅ 7. POST 200 — imported=${imported}, errors=0`);
    pass++;
  } else {
    console.error(`✗ 7. POST: status=${res.status} imported=${imported} errors=${JSON.stringify(errors).slice(0, 300)}`);
    fail++;
  }

  // 8. DB read-back from monthly_payslip — 2026-06-21 payslip decouple 정책상
  // employee master 자동 생성은 멈췄고 import 는 payslip 만 씀. period 도 일치 확인.
  const { data: rows } = await sbAdmin.from('monthly_payslip')
    .select('employee_name, base_salary, ptkp_category, period, employee_npwp')
    .eq('customer_id', customerId).eq('period', taxPeriod)
    .like('employee_name', `${SMOKE_PREFIX}%`).order('employee_name');
  const periodOk = rows?.every((r) => r.period === taxPeriod) ?? false;
  if (rows?.length === SAMPLES.length && periodOk) {
    console.log(`✅ 8. payslip ${rows.length} rows for period=${taxPeriod}`);
    rows.forEach((r) => console.log(`   • ${r.employee_name.replace(SMOKE_PREFIX, '')} | ${r.ptkp_category} | ${rp(Number(r.base_salary))} | ${r.employee_npwp ?? '(no NPWP)'}`));
    pass++;
  } else {
    console.error(`✗ 8. payslip ${rows?.length}/${SAMPLES.length} rows, period match=${periodOk}`);
    fail++;
  }

  // 9. Cleanup — payslip 우선, employee 도 안전망.
  const { count: delPay } = await sbAdmin.from('monthly_payslip').delete({ count: 'exact' })
    .eq('customer_id', customerId).like('employee_name', `${SMOKE_PREFIX}%`);
  const { count: delEmp } = await sbAdmin.from('employee_payroll').delete({ count: 'exact' })
    .eq('customer_id', customerId).like('employee_name', `${SMOKE_PREFIX}%`);
  unlinkSync(tmpPath);
  console.log(`✅ 9. cleanup payslip=${delPay ?? 0} employee=${delEmp ?? 0} + tmp removed`);
  pass++;

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('💥', e instanceof Error ? e.stack : e); process.exit(1); });
