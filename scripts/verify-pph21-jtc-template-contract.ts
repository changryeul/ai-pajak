/**
 * Verify /api/tax/pph21-bulk JTC 24-column contract:
 *
 *   1. Auth (CUSTOMER INDIVIDUAL test user)
 *   2. JTC shape POST (status=1, GAJI+TUNJANGAN+NATURA+PENGURANG.JHT/JP) → 200,
 *      deduction_breakdown returned
 *   3. employee_contributions = sum of PENGURANG fields × 12 (annual)
 *   4. biaya_jabatan = min(5% × bruto, 6_000_000)
 *   5. Status 2 → simple calc + warning flag in response
 *   6. PTKP 'TK/0' and 'TK0' both accepted (backward compat)
 *   7. Legacy shape (gross_salary only, no JTC fields) still 200 (backward compat)
 *
 * No DB writes (endpoint is stateless). No cleanup needed.
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-pph21-jtc-template-contract.ts
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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
const TEST_EMAIL = 'customer.test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

interface BulkResult {
  employee_name: string;
  ptkp_category: string;
  employment_status?: number;
  calculation: {
    gross_income: number;
    total_deductions: number;
    net_income: number;
    tax_amount: number;
    deduction_breakdown?: {
      position_allowance: number;
      employee_contributions: number;
      other_deductions: number;
    };
  };
  deduction_breakdown?: {
    position_allowance: number;
    employee_contributions: number;
    other_deductions: number;
  };
  monthly_tax: number;
  warning?: string;
  error?: string;
}

async function postBulk(token: string, employees: unknown[]) {
  const res = await fetch(`${BASE_URL}/api/tax/pph21-bulk`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ employees, period: 'annual' }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);

  let pass = 0;
  let fail = 0;

  // 1. Auth
  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (authErr || !auth.session) {
    console.error('✗ login:', authErr?.message);
    process.exit(1);
  }
  const token = auth.session.access_token;
  console.log(`✅ 1. login`);
  pass++;

  // 2. JTC shape — single Tetap employee with full breakdown
  // gaji=10M, tunjangan=1.5M, natura=500k, pengurang.bpjs_kesehatan=100k,
  // pengurang.jht=200k, pengurang.jp=100k, pengurang.jkp=0
  const jtcEmp = {
    employee_name: 'JTC Test Tetap',
    employee_npwp: '01.234.567.8-901.000',
    employment_status: 1,
    ptkp_category: 'TK/0',
    gaji: 10_000_000,
    tunjangan: 1_500_000,
    bonus_thr: 0,
    natura: 500_000,
    pengurang: {
      bpjs_kesehatan: 100_000,
      jht: 200_000,
      jp: 100_000,
      jkp: 0,
    },
  };
  const r2 = await postBulk(token, [jtcEmp]);
  if (r2.status !== 200 || !r2.json?.success) {
    console.error(`✗ 2. JTC POST status=${r2.status} body=${JSON.stringify(r2.json).slice(0, 300)}`);
    fail++;
    process.exit(1);
  }
  const tetap: BulkResult = r2.json.data.results[0];
  const dd = tetap.deduction_breakdown ?? tetap.calculation.deduction_breakdown;
  if (!dd) {
    console.error(`✗ 2. deduction_breakdown missing on JTC response`);
    fail++;
  } else {
    console.log(
      `✅ 2. JTC POST 200 — bruto=Rp${tetap.calculation.gross_income.toLocaleString('id-ID')}, ` +
      `tax=Rp${tetap.calculation.tax_amount.toLocaleString('id-ID')}, ` +
      `position_allowance=${dd.position_allowance.toLocaleString('id-ID')}, ` +
      `employee_contributions=${dd.employee_contributions.toLocaleString('id-ID')}`,
    );
    pass++;
  }

  // 3. employee_contributions = (100k + 200k + 100k + 0) × 12 = 4,800,000
  const expectedContrib = (100_000 + 200_000 + 100_000 + 0) * 12;
  if (!dd) {
    fail++;
  } else if (dd.employee_contributions !== expectedContrib) {
    console.error(
      `✗ 3. employee_contributions mismatch — got ${dd.employee_contributions}, expected ${expectedContrib}`,
    );
    fail++;
  } else {
    console.log(`✅ 3. employee_contributions = Rp${expectedContrib.toLocaleString('id-ID')} (PENGURANG × 12)`);
    pass++;
  }

  // 4. biaya_jabatan = min(5% × bruto, 6M)
  // bruto = (10M + 1.5M + 500k) × 12 = 144M; 5% = 7.2M → capped at 6M
  if (!dd) {
    fail++;
  } else if (dd.position_allowance !== 6_000_000) {
    console.error(`✗ 4. biaya_jabatan should cap at 6M — got ${dd.position_allowance}`);
    fail++;
  } else {
    console.log(`✅ 4. biaya_jabatan capped at Rp6,000,000 (5% of 144M = 7.2M → cap)`);
    pass++;
  }

  // 5. Status 2 → simple + warning
  const tidak = {
    employee_name: 'JTC Test Tidak Tetap',
    employment_status: 2,
    ptkp_category: 'TK/0',
    gaji: 3_000_000,
  };
  const r5 = await postBulk(token, [tidak]);
  if (r5.status !== 200) {
    console.error(`✗ 5. Status 2 POST status=${r5.status}`);
    fail++;
  } else {
    const row: BulkResult = r5.json.data.results[0];
    if (!row.warning || row.calculation.tax_amount < 0) {
      console.error(`✗ 5. Status 2 missing warning or invalid calc — warning=${row.warning}`);
      fail++;
    } else {
      console.log(`✅ 5. Status 2 → simple calc + warning: "${row.warning.slice(0, 60)}…"`);
      pass++;
    }
  }

  // 6. PTKP 'TK/0' and 'TK0' both accepted
  const r6 = await postBulk(token, [
    { employee_name: 'slash', employment_status: 1, ptkp_category: 'TK/0', gaji: 5_000_000 },
    { employee_name: 'noslash', employment_status: 1, ptkp_category: 'TK0', gaji: 5_000_000 },
  ]);
  if (r6.status !== 200) {
    console.error(`✗ 6. PTKP backward-compat POST status=${r6.status}`);
    fail++;
  } else {
    const a = r6.json.data.results[0].calculation.gross_income;
    const b = r6.json.data.results[1].calculation.gross_income;
    if (a !== b || a !== 60_000_000) {
      console.error(`✗ 6. slash vs no-slash mismatch — a=${a} b=${b} expected 60M`);
      fail++;
    } else {
      console.log(`✅ 6. PTKP 'TK/0' and 'TK0' both accepted (gross_income = Rp60M)`);
      pass++;
    }
  }

  // 7. Legacy shape (gross_salary only) backward compat
  const r7 = await postBulk(token, [
    {
      employee_name: 'Legacy',
      employee_npwp: '01.234.567.8-901.000',
      ptkp_category: 'TK0',
      gross_salary: 8_000_000,
      jht_employee: 160_000,
      jp_employee: 80_000,
    },
  ]);
  if (r7.status !== 200) {
    console.error(`✗ 7. Legacy POST status=${r7.status} body=${JSON.stringify(r7.json).slice(0, 200)}`);
    fail++;
  } else {
    const row: BulkResult = r7.json.data.results[0];
    if (row.error || row.calculation.gross_income !== 96_000_000) {
      console.error(`✗ 7. Legacy calc wrong — gross=${row.calculation.gross_income} err=${row.error}`);
      fail++;
    } else {
      console.log(`✅ 7. Legacy shape (gross_salary=8M) still 200 — bruto=Rp${row.calculation.gross_income.toLocaleString('id-ID')}`);
      pass++;
    }
  }

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
