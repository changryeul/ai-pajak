/**
 * Smoke test for OCR → 1721 A1 prefill (PR3.OCR-EBUPOT).
 *
 *   1. log in as the COMPANY test customer
 *   2. open the most recent tax_closing_session for the customer (or create one)
 *   3. seed a closing_document row with ocr_status=COMPLETED + payrollRows
 *      directly via service-role (bypasses Anthropic for determinism)
 *   4. GET /api/tax/annual-closing/{id}/ebupot-prefill
 *   5. assert: source=payrollRows, employees.length matches the seed
 *   6. assert lineItems fallback works on a separate doc
 *   7. cleanup the seeded docs
 *
 * Run:
 *   SEED_TARGET=prod npx tsx scripts/test-ebupot-prefill-flow.ts
 *   npx tsx scripts/test-ebupot-prefill-flow.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
console.log(`🌐 ${baseUrl}\n`);

const COMPANY_EMAIL = 'company.test@example.com';
const PASSWORD = 'TestPassword123!';

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session?.access_token) {
    console.error(`   ✗ login ${email}: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

async function api(method: string, p: string, token: string, body?: unknown) {
  const r = await fetch(`${baseUrl}${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

async function run() {
  console.log('🧪 OCR → 1721 A1 prefill smoke test\n');
  let pass = 0;
  let fail = 0;

  const tok = await login(COMPANY_EMAIL);
  if (!tok) {
    console.error('Cannot log in as COMPANY customer.');
    process.exit(1);
  }
  console.log('✅ company customer logged in');

  const admin = createClient(url, serviceKey);

  // Resolve customer + session
  const { data: customer } = await admin
    .from('customer')
    .select('id, customer_type')
    .eq('email', COMPANY_EMAIL)
    .single();
  if (!customer) {
    console.error('COMPANY customer not found in DB.');
    process.exit(1);
  }
  const customerId = customer.id;

  let { data: existing } = await admin
    .from('tax_closing_session')
    .select('id')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    const now = new Date();
    const newSession = await admin
      .from('tax_closing_session')
      .insert({
        customer_id: customerId,
        fiscal_year: now.getFullYear() - 1,
        closing_type: 'PPH25',
        current_step: 'basic',
        status: 'IN_PROGRESS',
      })
      .select('id')
      .single();
    existing = newSession.data;
    if (!existing) {
      console.error('cannot create closing session', newSession.error);
      process.exit(1);
    }
    console.log(`✅ created closing session ${existing.id.slice(0, 8)}…`);
  } else {
    console.log(`✅ using existing closing session ${existing.id.slice(0, 8)}…`);
  }
  const sessionId = existing.id;

  // ── 1. Seed a PAYROLL closing_document w/ payrollRows ──
  console.log('\n━━ 1. seed PAYROLL OCR doc (payrollRows) ━━');
  const testDocType = `payroll-smoke-${Date.now()}`;
  // closing_document has UNIQUE (session_id, doc_type) — clear any prior smoke runs.
  await admin
    .from('closing_document')
    .delete()
    .eq('session_id', sessionId)
    .like('doc_type', 'payroll-smoke-%');
  const docPayroll = await admin
    .from('closing_document')
    .insert({
      session_id: sessionId,
      doc_type: testDocType,
      file_name: 'smoke-payroll.xlsx',
      storage_path: `dummy/${sessionId}-payroll.xlsx`,
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size_bytes: 1024,
      ocr_status: 'COMPLETED',
      ocr_confidence: 0.92,
      ocr_completed_at: new Date().toISOString(),
      ocr_extracted: {
        category: 'PAYROLL',
        totalAmount: 0,
        rowCount: 3,
        lineItems: [],
        payrollRows: [
          { employeeName: 'Andi Saputra', npwp: '001111111111111', nik: '3201010101010001', ptkpCode: 'K1', grossSalary: 156_000_000, jht: 3_120_000, jp: 1_560_000 },
          { employeeName: 'Budi Setiawan', npwp: '002222222222222', nik: '3201010101010002', ptkpCode: 'TK0', grossSalary: 96_000_000, jht: 1_920_000, jp: 960_000 },
          { employeeName: 'Citra Putri', npwp: null, nik: null, ptkpCode: null, grossSalary: 60_000_000, jht: null, jp: null },
        ],
        summary: 'PAYROLL test 3명',
        rawText: 'mock',
        model: 'smoke-mock',
      },
    })
    .select('id')
    .single();
  if (docPayroll.error || !docPayroll.data) {
    console.error('   ✗ seed PAYROLL doc failed', docPayroll.error);
    process.exit(1);
  }
  const docPayrollId = docPayroll.data.id;
  console.log(`   ✅ seeded doc ${docPayrollId.slice(0, 8)}…`);

  // ── 2. Call prefill endpoint ──
  console.log('\n━━ 2. GET /api/tax/annual-closing/:id/ebupot-prefill ━━');
  const r1 = await api('GET', `/api/tax/annual-closing/${sessionId}/ebupot-prefill`, tok);
  if (r1.status !== 200 || !r1.body.success) {
    console.error(`   ✗ prefill (payrollRows) failed (${r1.status})`, r1.body);
    fail++;
  } else if (r1.body.data.source !== 'payrollRows') {
    console.error('   ✗ expected source=payrollRows', r1.body.data);
    fail++;
  } else if (r1.body.data.employees.length !== 3) {
    console.error('   ✗ expected 3 employees, got', r1.body.data.employees.length, r1.body.data);
    fail++;
  } else if (r1.body.data.employees[0].name !== 'Andi Saputra' || r1.body.data.employees[0].ptkp !== 'K1') {
    console.error('   ✗ first employee field mismatch', r1.body.data.employees[0]);
    fail++;
  } else {
    console.log(
      `   ✅ source=payrollRows, employees=3, confidence=${r1.body.data.ocrConfidence}, lowConfidence=${r1.body.data.lowConfidence}`,
    );
    pass++;
  }

  // ── 3. Switch the seed to lineItems-only fallback ──
  console.log('\n━━ 3. swap to lineItems fallback ━━');
  await admin
    .from('closing_document')
    .update({
      ocr_completed_at: new Date().toISOString(),
      ocr_extracted: {
        category: 'PAYROLL',
        totalAmount: 0,
        rowCount: 2,
        lineItems: [
          { description: 'Dewi Kartika', amount: 120_000_000, date: null },
          { description: 'Eka Pratama', amount: 80_000_000, date: null },
        ],
        // No payrollRows — endpoint should fall back.
        summary: 'old-style PAYROLL OCR',
        rawText: 'mock',
        model: 'smoke-mock',
      },
    })
    .eq('id', docPayrollId);

  const r2 = await api('GET', `/api/tax/annual-closing/${sessionId}/ebupot-prefill`, tok);
  if (r2.status !== 200 || r2.body.data?.source !== 'lineItems') {
    console.error('   ✗ expected source=lineItems fallback', r2.body);
    fail++;
  } else if (r2.body.data.employees.length !== 2) {
    console.error('   ✗ expected 2 employees from lineItems', r2.body.data.employees);
    fail++;
  } else {
    console.log(`   ✅ source=lineItems fallback works, employees=${r2.body.data.employees.length}`);
    pass++;
  }

  // ── 4. Customer scope check: another customer's session must 404 ──
  console.log('\n━━ 4. cross-customer 404 ━━');
  const { data: otherSession } = await admin
    .from('tax_closing_session')
    .select('id')
    .neq('customer_id', customerId)
    .limit(1)
    .maybeSingle();
  if (otherSession) {
    const r3 = await api('GET', `/api/tax/annual-closing/${otherSession.id}/ebupot-prefill`, tok);
    if (r3.status !== 404) {
      console.error('   ✗ expected 404 on other customer session, got', r3.status, r3.body);
      fail++;
    } else {
      console.log('   ✅ cross-customer access correctly rejected (404)');
      pass++;
    }
  } else {
    console.log('   ⏭️  no other customer session in DB, skipping isolation check');
  }

  // ── cleanup ──
  console.log('\n🧹 cleanup');
  await admin.from('closing_document').delete().eq('id', docPayrollId);
  console.log('   ✓ deleted seeded doc');

  console.log(`\n${fail === 0 ? '✨' : '⚠️'} Done. ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
