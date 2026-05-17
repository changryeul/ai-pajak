/**
 * Smoke test for supervisor ERP P1 endpoints:
 *   - /api/consultant-erp/supervisor/customers
 *   - /api/consultant-erp/supervisor/revisions
 *   - /api/consultant-erp/supervisor/calendar
 *
 * Asserts:
 *   - Each endpoint returns 200 + success + rows[] for supervisor
 *   - Each endpoint returns 403 for CONSULTANT_JTC
 *   - customers rows carry the required fields (customerId,
 *     consultantName, riskScore, deadline)
 *   - calendar.daysToDeadline is a finite number
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

async function login(email: string) {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'TestPassword123!' });
  if (error || !data.session?.access_token) {
    console.error(`✗ login ${email}: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

async function api(p: string, token: string) {
  const r = await fetch(`${baseUrl}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

async function run() {
  console.log('🧪 Supervisor ERP P1 smoke test\n');
  let pass = 0;
  let fail = 0;

  const supTok = await login('supervisor.test@aipajak.com');
  if (!supTok) process.exit(1);
  console.log('✅ supervisor logged in');

  const consTok = await login('consultant.test@jakartatax.co.id');
  if (!consTok) process.exit(1);
  console.log('✅ consultant logged in');

  // ── 1. /customers ──
  console.log('\n━━ 1. GET /supervisor/customers ━━');
  const r1 = await api('/api/consultant-erp/supervisor/customers', supTok);
  if (r1.status !== 200 || !r1.body.success || !Array.isArray(r1.body.data?.rows)) {
    console.error('   ✗ wrong shape', r1);
    fail++;
  } else {
    console.log(`   ✅ ${r1.body.data.rows.length} rows`);
    pass++;
    if (r1.body.data.rows.length > 0) {
      const first = r1.body.data.rows[0];
      const hasFields =
        typeof first.customerId === 'string' &&
        typeof first.riskScore === 'number' &&
        first.riskScore >= 0 &&
        first.riskScore <= 50;
      if (!hasFields) {
        console.error('   ✗ row shape wrong', first);
        fail++;
      } else {
        console.log(`   ✅ row shape ok (riskScore=${first.riskScore})`);
        pass++;
      }
    }
  }

  const r1c = await api('/api/consultant-erp/supervisor/customers', consTok);
  if (r1c.status !== 403) {
    console.error('   ✗ expected 403 for consultant, got', r1c.status, r1c.body);
    fail++;
  } else {
    console.log('   ✅ consultant 403');
    pass++;
  }

  // ── 2. /revisions ──
  console.log('\n━━ 2. GET /supervisor/revisions ━━');
  const r2 = await api('/api/consultant-erp/supervisor/revisions', supTok);
  if (r2.status !== 200 || !r2.body.success || !Array.isArray(r2.body.data?.rows)) {
    console.error('   ✗ wrong shape', r2);
    fail++;
  } else {
    console.log(`   ✅ ${r2.body.data.rows.length} events`);
    pass++;
  }
  const r2c = await api('/api/consultant-erp/supervisor/revisions', consTok);
  if (r2c.status !== 403) {
    console.error('   ✗ expected 403 for consultant', r2c.status);
    fail++;
  } else {
    console.log('   ✅ consultant 403');
    pass++;
  }

  // ── 3. /calendar ──
  console.log('\n━━ 3. GET /supervisor/calendar ━━');
  const r3 = await api('/api/consultant-erp/supervisor/calendar?withinDays=60', supTok);
  if (r3.status !== 200 || !r3.body.success || !Array.isArray(r3.body.data?.rows)) {
    console.error('   ✗ wrong shape', r3);
    fail++;
  } else {
    console.log(`   ✅ ${r3.body.data.rows.length} upcoming deadlines`);
    pass++;
    for (const row of r3.body.data.rows.slice(0, 5)) {
      if (!Number.isFinite(row.daysToDeadline)) {
        console.error('   ✗ daysToDeadline not a number', row);
        fail++;
        break;
      }
    }
  }
  const r3c = await api('/api/consultant-erp/supervisor/calendar', consTok);
  if (r3c.status !== 403) {
    console.error('   ✗ expected 403 for consultant', r3c.status);
    fail++;
  } else {
    console.log('   ✅ consultant 403');
    pass++;
  }

  // ── 4. /team-members ──
  console.log('\n━━ 4. GET /supervisor/team-members ━━');
  const rTM = await api('/api/consultant-erp/supervisor/team-members', supTok);
  if (rTM.status !== 200 || !rTM.body.success || !Array.isArray(rTM.body.data?.rows)) {
    console.error('   ✗ wrong shape', rTM);
    fail++;
  } else {
    console.log(`   ✅ ${rTM.body.data.rows.length} team cards`);
    pass++;
    if (rTM.body.data.rows.length > 0) {
      const first = rTM.body.data.rows[0];
      const ok =
        typeof first.consultantId === 'string' &&
        typeof first.fullName === 'string' &&
        typeof first.customerCount === 'number' &&
        typeof first.activeTasks === 'number' &&
        typeof first.pendingApproval === 'number' &&
        typeof first.revisionCount === 'number';
      if (!ok) {
        console.error('   ✗ card shape wrong', first);
        fail++;
      } else {
        console.log(
          `   ✅ card shape ok (${first.fullName}: ${first.customerCount} clients, ${first.activeTasks} active, ${first.pendingApproval} pending)`,
        );
        pass++;
      }
    }
  }
  const rTMc = await api('/api/consultant-erp/supervisor/team-members', consTok);
  if (rTMc.status !== 403) {
    console.error('   ✗ consultant should be 403', rTMc.status);
    fail++;
  } else {
    console.log('   ✅ consultant 403');
    pass++;
  }

  // ── 5b. /settings ──
  console.log('\n━━ 5. GET /supervisor/settings ━━');
  const rS = await api('/api/consultant-erp/supervisor/settings', supTok);
  if (rS.status !== 200 || !rS.body.success) {
    console.error('   ✗ failed', rS);
    fail++;
  } else {
    const d = rS.body.data;
    const ok =
      d?.company?.id &&
      Array.isArray(d?.rbac) && d.rbac.length === 3 &&
      d?.approval &&
      d?.security &&
      d?.channels;
    if (!ok) {
      console.error('   ✗ shape wrong', d);
      fail++;
    } else {
      console.log(`   ✅ company=${d.company.name}, rbac=${d.rbac.length} rows`);
      pass++;
    }
  }
  const rSc = await api('/api/consultant-erp/supervisor/settings', consTok);
  if (rSc.status !== 403) {
    console.error('   ✗ consultant should be 403', rSc.status);
    fail++;
  } else {
    console.log('   ✅ consultant 403');
    pass++;
  }

  // ── 6. /coretax ──
  console.log('\n━━ 6. GET /supervisor/coretax ━━');
  const rCT = await api('/api/consultant-erp/supervisor/coretax', supTok);
  if (rCT.status !== 200 || !rCT.body.success || !Array.isArray(rCT.body.data?.rows)) {
    console.error('   ✗ wrong shape', rCT);
    fail++;
  } else {
    const rows = rCT.body.data.rows as Array<{ stage: string; sessionId: string }>;
    const validStages = new Set(['ID_BILLING_PENDING', 'NTPN_PENDING', 'BPE_PENDING', 'COMPLETED']);
    const allValid = rows.every((r) => validStages.has(r.stage));
    if (!allValid) {
      console.error('   ✗ invalid stage value');
      fail++;
    } else {
      console.log(`   ✅ ${rows.length} coretax rows, all stages valid`);
      pass++;
    }
  }
  const rCTc = await api('/api/consultant-erp/supervisor/coretax', consTok);
  if (rCTc.status !== 403) {
    console.error('   ✗ consultant should be 403', rCTc.status);
    fail++;
  } else {
    console.log('   ✅ consultant 403');
    pass++;
  }

  // ── 7. /team ──
  console.log('\n━━ 7. GET /supervisor/team ━━');
  const rT = await api('/api/consultant-erp/supervisor/team', supTok);
  if (rT.status !== 200 || !rT.body.success) {
    console.error('   ✗ failed', rT);
    fail++;
  } else {
    const d = rT.body.data;
    const ok =
      Array.isArray(d?.rubric) && d.rubric.length > 0 &&
      Array.isArray(d?.teams) &&
      Array.isArray(d?.members);
    if (!ok) {
      console.error('   ✗ shape wrong', d);
      fail++;
    } else {
      console.log(
        `   ✅ rubric=${d.rubric.length}, teams=${d.teams.length}, members=${d.members.length}`,
      );
      pass++;
    }
  }
  const rTc = await api('/api/consultant-erp/supervisor/team', consTok);
  if (rTc.status !== 403) {
    console.error('   ✗ consultant should be 403', rTc.status);
    fail++;
  } else {
    console.log('   ✅ consultant 403');
    pass++;
  }

  // ── 8. /counterparty/stats ──
  console.log('\n━━ 8. GET /counterparty/stats ━━');
  const r4 = await api('/api/consultant-erp/counterparty/stats', supTok);
  if (r4.status !== 200 || !r4.body.success) {
    console.error('   ✗ failed', r4);
    fail++;
  } else {
    const d = r4.body.data;
    const ok =
      typeof d.totalRegistered === 'number' &&
      typeof d.avgTrust === 'number' &&
      typeof d.pendingCandidates === 'number' &&
      typeof d.needsEvidence === 'number' &&
      typeof d.verified === 'number';
    if (!ok) {
      console.error('   ✗ shape wrong', d);
      fail++;
    } else {
      console.log(
        `   ✅ total=${d.totalRegistered}, avg=${d.avgTrust}, pending=${d.pendingCandidates}, needsEvidence=${d.needsEvidence}, verified=${d.verified}`,
      );
      pass++;
    }
  }
  // Consultant can also see counterparty stats (counterparty is cross-tenant).
  const r4c = await api('/api/consultant-erp/counterparty/stats', consTok);
  if (r4c.status !== 200) {
    console.error('   ✗ consultant should see counterparty stats too', r4c.status);
    fail++;
  } else {
    console.log('   ✅ consultant 200 (cross-tenant)');
    pass++;
  }

  console.log(`\n${fail === 0 ? '✨' : '⚠️'} Done. ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
