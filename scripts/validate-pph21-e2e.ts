/**
 * End-to-end PPh21 employee import validation:
 *   xlsx → parseTabularFile + findBestHeaderRow + auto-map → CSV → multipart
 *   POST /api/tax/employees/import → DB verify → cleanup.
 *
 * Mirrors the page.tsx UI flow with the SMOKE_PREFIX sentinel injected onto
 * every employee_name so cleanup is exact (no collision with seed employees
 * already attached to the test customer).
 *
 * Usage:
 *   SEED_TARGET=prod npx tsx scripts/validate-pph21-e2e.ts
 */

import { readFileSync, existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  parseTabularFile,
  findBestHeaderRow,
  rowsToCsv,
} from '../src/lib/tax/bulk-import/client-file-parser';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) {
  console.error(`✗ ${envFile} not found`);
  process.exit(1);
}
loadEnv({ path: envFile });

const BASE_URL =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PPH21_FILE = '/Users/winwaysystems/Downloads/BINTANG JAYA SOLUTIONS - PPh 21 CALCULATION 2026.xlsx';
const TEST_EMAIL = 'company.test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const SMOKE_PREFIX = '[SMOKE-PPH21-E2E] ';
const LIMIT = 5; // keep DB write small

if (!existsSync(PPH21_FILE)) {
  console.log(`⏭  SKIPPED — fixture not present (${PPH21_FILE})`);
  console.log(`   (this validator needs the real BINTANG JAYA xlsx — only runs locally)`);
  process.exit(0);
}

console.log(`\n📄 file: ${PPH21_FILE}`);
console.log(`🌐 base: ${BASE_URL}\n`);

const PPH21_HINTS = [
  /^(name|nama|이름|emp\s*id|employee)/i,
  /^npwp$/i,
  /^nik$/i,
  /^(gaji|salary|gross|기본급)/i,
  /^(tunjangan|allowance|수당)/i,
  /^(tax\s*status|ptkp|status)$/i,
  /^(status\s*pegawai|worker|jenis)/i,
  /^(honorarium|honor|bonus|thr)/i,
  /^(jht|jp|bpjs|kesehatan|pensiun)/i,
];

const KEYWORD_MAP: Record<string, string[]> = {
  employee_name: ['nama', 'name', 'karyawan', 'pegawai', '이름', 'employee', 'emp_name'],
  employee_npwp: ['npwp', 'tax_id', 'tax id'],
  employee_nik: ['nik', 'ktp', 'no ktp', 'identitas'],
  ptkp_category: ['ptkp', 'tax status', 'status pajak', 'kategori ptkp'],
  gross_salary: ['gaji', 'salary', 'basic', 'pokok', 'base', '기본급', 'gross', 'gapok', 'gaji pokok', 'pendapatan', 'monthly salary'],
  position_allowance: ['jabatan', 'position', '직책', 'tunjangan jabatan'],
  overtime_pay: ['lembur', 'overtime', '초과', 'uang lembur'],
  meal_allowance: ['makan', 'meal', '식대', 'tunjangan makan', 'uang makan'],
  transport_allowance: ['transport', '교통', 'tunjangan transport', 'transportasi'],
  other_allowances: ['tunjangan lain', 'tunjangan lainnya', 'allowance', '수당', 'honorarium', 'imbalan', 'tunjangan'],
  bonus: ['bonus', '보너스', 'tantiem', 'gratifikasi'],
  thr: ['thr', 'hari raya', 'tunjangan hari raya'],
  jht_employee: ['jht', 'hari tua', 'jaminan hari tua', 'iuran jht'],
  jp_employee: ['jp', 'pensiun', 'jaminan pensiun', 'iuran pensiun'],
  bpjs_kesehatan: ['bpjs', 'kesehatan', 'bpjs kesehatan', 'asuransi kesehatan'],
  other_deductions: ['potongan', 'deduction', '공제', 'pemotongan', 'iuran lain'],
  worker_type: ['type', 'tipe', 'jenis', '유형', 'status pegawai', 'worker type', 'pegawai tetap'],
};

async function main() {
  // ── Step 1: parseTabularFile ──────────────────────────────────────────
  const buf = readFileSync(PPH21_FILE);
  const file = new File([buf], 'PPh21-2026.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseTabularFile(file);
  console.log(`✅ Step 1: parseTabularFile — ${parsed.headers.length} headers, ${parsed.dataRows.length} data rows`);

  // ── Step 2: header detection + auto-mapping ───────────────────────────
  const allRows = [parsed.headers, ...parsed.dataRows];
  const headerIdx = findBestHeaderRow(allRows, PPH21_HINTS);
  const header = allRows[headerIdx];
  const dataRowsAfterHeader = allRows.slice(headerIdx + 1).filter((r) => r.some((c) => c !== ''));

  const usedTargets = new Set<string>();
  const mappings = header.map((h) => {
    const lower = h.toLowerCase();
    for (const [field, keywords] of Object.entries(KEYWORD_MAP)) {
      if (usedTargets.has(field)) continue;
      if (keywords.some((kw) => lower.includes(kw) || kw.includes(lower))) {
        usedTargets.add(field);
        return { sourceColumn: h, targetField: field };
      }
    }
    return { sourceColumn: h, targetField: '' };
  });

  const matched = mappings.filter((m) => m.targetField).length;
  const hasName = mappings.some((m) => m.targetField === 'employee_name');
  const hasSalary = mappings.some((m) => m.targetField === 'gross_salary');
  console.log(
    `✅ Step 2: header row ${headerIdx}, auto-map ${matched}/${header.length}, ` +
    `required: name=${hasName} salary=${hasSalary}`,
  );
  if (!hasName || !hasSalary) {
    console.error('✗ required fields missing — UI would block');
    process.exit(1);
  }

  // ── Step 3: build CSV (limit + sentinel-prefix names) ─────────────────
  const nameColIdx = mappings.findIndex((m) => m.targetField === 'employee_name');
  const limited = dataRowsAfterHeader.slice(0, LIMIT).map((row) => {
    const out = [...row];
    const original = String(out[nameColIdx] ?? '').trim();
    if (original) out[nameColIdx] = `${SMOKE_PREFIX}${original}`;
    return out;
  });
  const mappedHeaders = mappings.map((m) => m.targetField || 'SKIP');
  const csv = rowsToCsv(mappedHeaders, limited);
  const csvLines = csv.split('\n').filter(Boolean);
  console.log(`✅ Step 3: built CSV — ${csvLines.length - 1} data rows (limit=${LIMIT}), sentinel="${SMOKE_PREFIX.trim()}"`);

  // ── Step 4: login + customer ──────────────────────────────────────────
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (authErr || !auth.session) {
    console.error('✗ Step 4 login:', authErr?.message);
    process.exit(1);
  }
  const token = auth.session.access_token;
  const { data: customer } = await sbAdmin
    .from('customer')
    .select('id')
    .eq('user_id', auth.user!.id)
    .maybeSingle();
  if (!customer) {
    console.error(`✗ Step 4: no customer row`);
    process.exit(1);
  }
  const customerId = customer.id;
  console.log(`✅ Step 4: logged in as ${TEST_EMAIL}, customer_id=${customerId}`);

  // ── Step 5: pre-cleanup any sentinel-prefixed rows ────────────────────
  const { count: preCount } = await sbAdmin
    .from('employee_payroll')
    .delete({ count: 'exact' })
    .eq('customer_id', customerId)
    .like('employee_name', `${SMOKE_PREFIX}%`);
  console.log(`✅ Step 5: pre-cleanup deleted ${preCount ?? 0} sentinel rows`);

  // ── Step 6: multipart POST /api/tax/employees/import ──────────────────
  const formData = new FormData();
  const csvBlob = new Blob([csv], { type: 'text/csv' });
  formData.append('file', csvBlob, 'pph21-smoke.csv');
  formData.append('customerId', customerId);
  // intentionally NO taxPeriod — keeps monthly_payslip untouched

  const importRes = await fetch(`${BASE_URL}/api/tax/employees/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const importBody = await importRes.json().catch(() => ({}));
  if (importRes.status !== 200 || !importBody.success) {
    console.error(`✗ Step 6 import failed: status=${importRes.status} body=${JSON.stringify(importBody).slice(0, 400)}`);
    // cleanup any partial inserts so we don't leave junk
    await sbAdmin.from('employee_payroll').delete().eq('customer_id', customerId).like('employee_name', `${SMOKE_PREFIX}%`);
    process.exit(1);
  }
  const imported = importBody.data?.imported ?? 0;
  const skipped = importBody.data?.skipped ?? 0;
  console.log(`✅ Step 6: POST → 200 — imported=${imported}, skipped=${skipped}`);

  // ── Step 7: DB read-back ──────────────────────────────────────────────
  const { data: rows, count } = await sbAdmin
    .from('employee_payroll')
    .select('id, employee_name, gross_salary, ptkp_category, worker_type', { count: 'exact' })
    .eq('customer_id', customerId)
    .like('employee_name', `${SMOKE_PREFIX}%`)
    .order('employee_name');
  console.log(`✅ Step 7: DB has ${count ?? 0} sentinel rows`);
  rows?.slice(0, 3).forEach((r) => {
    console.log(`   • ${r.employee_name} | ${r.ptkp_category} | gross=${r.gross_salary}`);
  });

  // ── Step 8: cleanup ───────────────────────────────────────────────────
  const { count: cleaned } = await sbAdmin
    .from('employee_payroll')
    .delete({ count: 'exact' })
    .eq('customer_id', customerId)
    .like('employee_name', `${SMOKE_PREFIX}%`);
  console.log(`✅ Step 8: cleanup deleted ${cleaned ?? 0} rows`);

  // ── Verdict ───────────────────────────────────────────────────────────
  if (imported > 0 && (count ?? 0) === imported) {
    console.log(`\n🎉 PASS — parsed ${csvLines.length - 1} CSV rows → imported ${imported} → DB ${count} → cleaned ${cleaned}`);
  } else {
    console.log(`\n✗ MISMATCH — csv=${csvLines.length - 1}, imported=${imported}, db=${count}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('💥', e instanceof Error ? e.stack : e);
  process.exit(1);
});
