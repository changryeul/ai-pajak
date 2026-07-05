/**
 * Smoke test for the Consultant ERP P1 happy path.
 *
 * Walks one session through:
 *   1. CONSULTANT creates a session for company.test
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
 * AND a CONSULTANT must have an active customer_consultant assignment for
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
    console.error('   ✗ Cannot log in as CONSULTANT. Aborting.');
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

  // ── 6. Counterparty: search + create + match (P4) ──
  console.log('\n━━ 6. counterparty search + create + match ━━');
  const counterpartyName = `Smoke Test PT ${Date.now()}`;
  const counterpartyNpwp = String(Date.now()).slice(-15).padStart(15, '0');
  const cpCreate = await api('POST', '/api/consultant-erp/counterparty', consultantTok, {
    name: counterpartyName,
    npwp: counterpartyNpwp,
    country: 'ID',
    kbli: '62019',
    suggestedPph: 'PPh 23',
    suggestedRate: 0.02,
  });
  if (cpCreate.status !== 201) {
    console.error('   ✗ counterparty create failed', cpCreate.body);
    fail++;
  } else {
    console.log(`   ✅ counterparty created id=${cpCreate.body.data.id.slice(0, 8)}…`);
    pass++;
  }
  const counterpartyId = cpCreate.body.data?.id as string | undefined;

  const cpSearch = await api('GET', `/api/consultant-erp/counterparty?q=${encodeURIComponent(counterpartyName)}`, consultantTok);
  if (cpSearch.status !== 200 || !cpSearch.body.data?.rows?.length) {
    console.error('   ✗ counterparty search failed', cpSearch.body);
    fail++;
  } else {
    console.log(`   ✅ counterparty search returned ${cpSearch.body.data.rows.length} row(s)`);
    pass++;
  }

  const cpMatch = await api('POST', '/api/consultant-erp/counterparty/match', consultantTok, {
    npwp: counterpartyNpwp,
  });
  if (cpMatch.status !== 200 || !cpMatch.body.data?.matched) {
    console.error('   ✗ counterparty match failed', cpMatch.body);
    fail++;
  } else {
    console.log(`   ✅ counterparty match suggestedPph=${cpMatch.body.data.suggestedPph}`);
    pass++;
  }

  // ── 7. Legality vault list (P5) ──
  console.log('\n━━ 7. legality vault list ━━');
  const leg = await api('GET', '/api/consultant-erp/legality', consultantTok);
  if (leg.status !== 200 || !Array.isArray(leg.body.data?.customers)) {
    console.error('   ✗ legality list failed', leg.body);
    fail++;
  } else {
    console.log(`   ✅ legality customers=${leg.body.data.customers.length}, documents=${leg.body.data.documents.length}`);
    pass++;
  }

  // ── 8. Supervisor board (platform-wide view) ──
  console.log('\n━━ 8. supervisor board ━━');
  const supBoardAll = await api('GET', '/api/consultant-erp/sessions/board', supervisorTok);
  if (
    supBoardAll.status !== 200 ||
    supBoardAll.body.data?.mode !== 'SUPERVISOR' ||
    !Array.isArray(supBoardAll.body.data?.rows)
  ) {
    console.error('   ✗ supervisor board (ALL) failed', supBoardAll.body);
    fail++;
  } else {
    console.log(
      `   ✅ SUPERVISOR mode, ${supBoardAll.body.data.rows.length} rows, ` +
        `pendingApproval=${supBoardAll.body.data.stats.pendingApproval}, ` +
        `taxPartners=${supBoardAll.body.data.stats.totalTaxPartners}`,
    );
    pass++;
  }

  const supBoardPending = await api(
    'GET',
    '/api/consultant-erp/sessions/board?status=PENDING_APPROVAL',
    supervisorTok,
  );
  if (
    supBoardPending.status !== 200 ||
    supBoardPending.body.data?.mode !== 'SUPERVISOR'
  ) {
    console.error('   ✗ supervisor board (PENDING_APPROVAL filter) failed', supBoardPending.body);
    fail++;
  } else {
    const allPending = (supBoardPending.body.data.rows as Array<{ status: string }>).every(
      (r) => r.status === 'PENDING_APPROVAL',
    );
    if (!allPending) {
      console.error(
        '   ✗ supervisor board PENDING filter returned non-PENDING rows',
        supBoardPending.body.data.rows.map((r: { status: string }) => r.status),
      );
      fail++;
    } else {
      console.log(
        `   ✅ filter=PENDING_APPROVAL returned ${supBoardPending.body.data.rows.length} rows, all PENDING`,
      );
      pass++;
    }
  }

  // Consultant should still get CONSULTANT mode
  const consBoard = await api('GET', '/api/consultant-erp/sessions/board', consultantTok);
  if (consBoard.status !== 200 || consBoard.body.data?.mode !== 'CONSULTANT') {
    console.error('   ✗ consultant board mode mismatch', consBoard.body);
    fail++;
  } else {
    console.log(`   ✅ consultant gets CONSULTANT mode, ${consBoard.body.data.rows.length} rows`);
    pass++;
  }

  // ── 9. Supervisor can GET arbitrary session detail (work-page nav) ──
  console.log('\n━━ 9. supervisor GET session detail ━━');
  const supDetail = await api('GET', `/api/consultant-erp/sessions/${sessionId}`, supervisorTok);
  if (supDetail.status !== 200 || !supDetail.body.success) {
    console.error('   ✗ supervisor GET session failed', supDetail.status, supDetail.body);
    fail++;
  } else if (supDetail.body.data?.session?.id !== sessionId) {
    console.error('   ✗ wrong session in response', supDetail.body.data?.session?.id);
    fail++;
  } else {
    console.log(`   ✅ supervisor can fetch session ${sessionId.slice(0, 8)}… across tax_partners`);
    pass++;
  }

  // ── Cleanup: delete the test session + counterparty so re-runs do not collide ──
  console.log('\n🧹 cleanup');
  const c = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await c.from('consultant_session').delete().eq('id', sessionId);
  if (counterpartyId) await c.from('counterparty_master').delete().eq('id', counterpartyId);
  console.log('   ✓ deleted test session + counterparty');

  console.log(`\n${fail === 0 ? '✨' : '⚠️'} Done. ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
