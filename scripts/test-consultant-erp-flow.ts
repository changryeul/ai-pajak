/**
 * Smoke test for the Consultant ERP P1 happy path.
 *
 * Walks one session through:
 *   1. CONSULTANT_JTC creates a session for company.test
 *   2. Uploads 5 document metadata rows (all 5 required slots)
 *   3. SUBMIT  → status PENDING_APPROVAL
 *   4. SUPERVISOR approves → status APPROVED
 *   5. CONSULTANT records Coretax result → status COMPLETED
 *
 * Run:
 *   npx tsx scripts/test-consultant-erp-flow.ts
 *   SEED_TARGET=prod npx tsx scripts/test-consultant-erp-flow.ts
 *
 * Requirements: the 20260516000001_consultant_erp.sql migration must be applied
 * AND a CONSULTANT_JTC must have an active customer_consultant assignment for
 * company.test@example.com.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const baseUrl =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
console.log(`🌐 ${baseUrl}\n`);

const PASSWORD = 'TestPassword123!';

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session?.access_token) {
    console.error(`   ✗ login failed for ${email}: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

function jsonHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function api(method: string, p: string, token: string, body?: unknown) {
  const r = await fetch(`${baseUrl}${p}`, {
    method,
    headers: jsonHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

async function run() {
  console.log('🧾 Consultant ERP P1 happy-path smoke test\n');
  let pass = 0;
  let fail = 0;

  // ── Step 0: collect tokens + customerId ──
  const consultantTok = await login('consultant.test@jakartatax.co.id');
  if (!consultantTok) {
    console.error('   ✗ Cannot log in as CONSULTANT_JTC. Aborting.');
    process.exit(1);
  }
  console.log('✅ consultant logged in');

  const supervisorTok = await login('supervisor.test@aipajak.com');
  if (!supervisorTok) {
    console.error('   ✗ Cannot log in as supervisor. Aborting.');
    process.exit(1);
  }
  console.log('✅ supervisor logged in');

  // The board lists my assigned customers — pick the first COMPANY one.
  const board = await api('GET', '/api/consultant-erp/sessions/board', consultantTok);
  if (board.status !== 200) {
    console.error(`   ✗ board fetch failed (${board.status})`, board.body);
    process.exit(1);
  }
  const companyRow = (board.body.data?.rows ?? []).find(
    (r: { customerType: string; customerId: string }) => r.customerType === 'COMPANY',
  );
  if (!companyRow) {
    console.error('   ✗ No COMPANY customer assigned to this consultant. Seed first.');
    process.exit(1);
  }
  const customerId = companyRow.customerId;
  console.log(`✅ target customerId: ${customerId.slice(0, 8)}…`);

  // ── 1. Create session (use a future tax_period to avoid collisions) ──
  const now = new Date();
  const futureYear = now.getFullYear() + 1;
  const taxPeriod = `${futureYear}-12`;
  console.log(`\n━━ 1. POST /sessions { ${taxPeriod} } ━━`);
  const created = await api('POST', '/api/consultant-erp/sessions', consultantTok, {
    customerId,
    filingKind: 'MONTHLY',
    taxPeriod,
  });
  if (created.status !== 201 && created.status !== 200) {
    console.error(`   ✗ create failed (${created.status})`, created.body);
    fail++;
    process.exit(fail === 0 ? 0 : 1);
  }
  const sessionId = created.body.data.id;
  console.log(`   ✅ session ${sessionId.slice(0, 8)}… created, status=${created.body.data.status}`);
  pass++;

  // ── 2. Upload 5 required slot metadata ──
  console.log('\n━━ 2. POST /sessions/:id/documents × 5 ━━');
  for (const slot of ['PAYROLL', 'WITHHOLDING_INVOICE', 'CORP_TAX_INPUT', 'VAT_IN_OUT', 'BANK_STATEMENT']) {
    const up = await api('POST', `/api/consultant-erp/sessions/${sessionId}/documents`, consultantTok, {
      slot,
      storagePath: `consultant-erp/${sessionId}/${slot}/test.xlsx`,
      originalFilename: `${slot.toLowerCase()}.xlsx`,
    });
    if (up.status !== 201) {
      console.error(`   ✗ ${slot} upload failed (${up.status})`, up.body);
      fail++;
    } else {
      console.log(`   ✅ ${slot} v${up.body.data.version}`);
    }
  }
  pass++;

  // ── 3. SUBMIT → PENDING_APPROVAL ──
  console.log('\n━━ 3. POST /approval SUBMIT ━━');
  const submit = await api('POST', `/api/consultant-erp/sessions/${sessionId}/approval`, consultantTok, {
    action: 'SUBMIT',
    comment: 'Initial submission',
  });
  if (submit.status !== 200 || submit.body.data.newStatus !== 'PENDING_APPROVAL') {
    console.error(`   ✗ SUBMIT failed (${submit.status})`, submit.body);
    fail++;
  } else {
    console.log(`   ✅ status=${submit.body.data.newStatus}`);
    pass++;
  }

  // ── 4. SUPERVISOR APPROVE ──
  console.log('\n━━ 4. POST /approval APPROVE (supervisor) ━━');
  const approve = await api(
    'POST',
    `/api/consultant-erp/sessions/${sessionId}/approval`,
    supervisorTok,
    { action: 'APPROVE', comment: 'OK' },
  );
  if (approve.status !== 200 || approve.body.data.newStatus !== 'APPROVED') {
    console.error(`   ✗ APPROVE failed (${approve.status})`, approve.body);
    fail++;
  } else {
    console.log(`   ✅ status=${approve.body.data.newStatus}`);
    pass++;
  }

  // ── 5. Coretax record → COMPLETED ──
  console.log('\n━━ 5. POST /coretax-record ━━');
  const cr = await api(
    'POST',
    `/api/consultant-erp/sessions/${sessionId}/coretax-record`,
    consultantTok,
    {
      idBilling: `BIL-${Date.now()}`,
      ntpn: `820BR${Date.now()}`,
      bpeFilePath: `bpe/${sessionId}.pdf`,
    },
  );
  if (cr.status !== 200) {
    console.error(`   ✗ Coretax record failed (${cr.status})`, cr.body);
    fail++;
  } else {
    console.log(`   ✅ Coretax recorded, session COMPLETED`);
    pass++;
  }

  // ── Cleanup: delete the test session so re-runs do not collide ──
  console.log('\n🧹 cleanup');
  const c = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await c.from('consultant_session').delete().eq('id', sessionId);
  console.log('   ✓ deleted test session');

  console.log(`\n${fail === 0 ? '✨' : '⚠️'} Done. ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
