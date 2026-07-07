/**
 * Smoke test for FIRM_ADMIN endpoints (P6 follow-up):
 *   - GET/POST/PATCH/DELETE /api/firm-admin/staff
 *   - GET/POST /api/firm-admin/clients
 *   - GET /api/firm-admin/billing
 *
 * Asserts (14):
 *   1.  firmadmin.test 로그인
 *   2.  GET staff → 200 + 자기 법인 직원만 (Eddy + Fira)
 *   3.  GET clients → 200 + clients/workload shape
 *   4.  GET billing → 200 + availableTiers 3 + managedClientCount number
 *   5.  RBAC: CONSULTANT (external.consultant) → staff 403
 *   6.  RBAC: CUSTOMER → staff 403
 *   7.  PATCH self deactivate → 400
 *   8.  PATCH nonexistent consultant → 404
 *   9.  POST invite (sentinel email) → 201
 *   10. GET staff → invitation 목록에 sentinel 노출
 *   11. DELETE invitation → 200 + GET 에서 사라짐
 *   12. POST clients reassign → 200 (Eddy → Fira)
 *   13. reassign 복원 (Fira → Eddy) → 200
 *   14. POST invite 중복 consultant email → 409
 *
 * Pre-cleanup: sentinel 초대 row 를 service role 로 삭제 (재실행 안전).
 *
 * Run: SEED_TARGET=prod npx tsx scripts/test-firm-admin-flow.ts
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

const SENTINEL_EMAIL = 'firm-admin-smoke-invite@example.com';
const PASSWORD = 'TestPassword123!';

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function login(email: string) {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session?.access_token) {
    console.error(`✗ login ${email}: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

async function api(
  p: string,
  token: string,
  init?: { method?: string; body?: unknown },
) {
  const r = await fetch(`${baseUrl}${p}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

let pass = 0;
let fail = 0;
function check(ok: boolean, label: string, detail?: unknown) {
  if (ok) {
    console.log(`   ✅ ${label}`);
    pass++;
  } else {
    console.error(`   ✗ ${label}`, detail ?? '');
    fail++;
  }
}

async function run() {
  console.log('🧪 FIRM_ADMIN endpoints smoke test\n');

  // Pre-cleanup (재실행 안전)
  await admin.from('staff_invitation').delete().eq('email', SENTINEL_EMAIL);

  // ── 1. logins ──
  const faTok = await login('firmadmin.test@mitrapajak.com');
  check(Boolean(faTok), '1. firmadmin.test login');
  if (!faTok) process.exit(1);
  const consTok = await login('external.consultant@mitrapajak.com');
  const custTok = await login('customer.test@example.com');

  // ── 2. GET staff ──
  console.log('\n━━ GET /api/firm-admin/staff ━━');
  const staff = await api('/api/firm-admin/staff', faTok);
  const staffRows: { consultantId: string; email: string; isSelf: boolean; isActive: boolean }[] =
    staff.body?.data?.staff ?? [];
  check(
    staff.status === 200 && Array.isArray(staffRows) && Array.isArray(staff.body?.data?.invitations),
    '2. staff 200 + shape',
    staff,
  );
  const emails = staffRows.map((s) => s.email);
  check(
    emails.includes('external.consultant@mitrapajak.com') &&
      emails.includes('firmadmin.test@mitrapajak.com') &&
      emails.every((e) => !e.endsWith('@jakartatax.co.id')),
    '2b. 자기 법인 직원만 (JTC 미노출)',
    emails,
  );

  // ── 3. GET clients ──
  console.log('\n━━ GET /api/firm-admin/clients ━━');
  const clients = await api('/api/firm-admin/clients', faTok);
  const clientRows: { customerId: string; consultantId: string | null; name: string }[] =
    clients.body?.data?.clients ?? [];
  check(
    clients.status === 200 &&
      Array.isArray(clientRows) &&
      Array.isArray(clients.body?.data?.workload),
    '3. clients 200 + shape',
    clients,
  );

  // ── 4. GET billing ──
  console.log('\n━━ GET /api/firm-admin/billing ━━');
  const billing = await api('/api/firm-admin/billing', faTok);
  check(
    billing.status === 200 &&
      Array.isArray(billing.body?.data?.availableTiers) &&
      billing.body.data.availableTiers.length === 3 &&
      typeof billing.body.data.managedClientCount === 'number',
    '4. billing 200 + tiers 3',
    billing,
  );

  // ── 5-6. RBAC ──
  console.log('\n━━ RBAC ━━');
  if (consTok) {
    const r = await api('/api/firm-admin/staff', consTok);
    check(r.status === 403, '5. CONSULTANT → 403', r.status);
  } else {
    check(false, '5. consultant login failed');
  }
  if (custTok) {
    const r = await api('/api/firm-admin/staff', custTok);
    check(r.status === 403, '6. CUSTOMER → 403', r.status);
  } else {
    check(false, '6. customer login failed');
  }

  // ── 7-8. PATCH contracts ──
  console.log('\n━━ PATCH /api/firm-admin/staff ━━');
  const self = staffRows.find((s) => s.isSelf);
  if (self) {
    const r = await api('/api/firm-admin/staff', faTok, {
      method: 'PATCH',
      body: { consultantId: self.consultantId, isActive: false },
    });
    check(r.status === 400, '7. self deactivate → 400', r.status);
  } else {
    check(false, '7. self row not found', staffRows);
  }
  const r404 = await api('/api/firm-admin/staff', faTok, {
    method: 'PATCH',
    body: { consultantId: '00000000-0000-0000-0000-00000000dead', isActive: false },
  });
  check(r404.status === 404, '8. unknown consultant → 404', r404.status);

  // ── 9-11. invite lifecycle ──
  console.log('\n━━ POST/DELETE invite ━━');
  const inv = await api('/api/firm-admin/staff', faTok, {
    method: 'POST',
    body: { email: SENTINEL_EMAIL, fullName: 'Smoke Invitee', role: 'CONSULTANT' },
  });
  check(inv.status === 201 && inv.body?.data?.invitationId, '9. invite → 201', inv);
  const invitationId: string | undefined = inv.body?.data?.invitationId;

  const staff2 = await api('/api/firm-admin/staff', faTok);
  const listed = (staff2.body?.data?.invitations ?? []).some(
    (i: { email: string }) => i.email === SENTINEL_EMAIL,
  );
  check(listed, '10. invitation listed');

  if (invitationId) {
    const del = await api(`/api/firm-admin/staff?invitationId=${invitationId}`, faTok, {
      method: 'DELETE',
    });
    const staff3 = await api('/api/firm-admin/staff', faTok);
    const gone = !(staff3.body?.data?.invitations ?? []).some(
      (i: { email: string }) => i.email === SENTINEL_EMAIL,
    );
    check(del.status === 200 && gone, '11. cancel → 200 + delisted', del);
  } else {
    check(false, '11. no invitationId to cancel');
  }

  // ── 12-13. reassign round-trip ──
  console.log('\n━━ POST /api/firm-admin/clients (reassign) ━━');
  const firstClient = clientRows[0];
  const other = staffRows.find(
    (s) => s.isActive && firstClient && s.consultantId !== firstClient.consultantId,
  );
  if (firstClient?.consultantId && other) {
    const go = await api('/api/firm-admin/clients', faTok, {
      method: 'POST',
      body: { customerId: firstClient.customerId, consultantId: other.consultantId },
    });
    check(go.status === 200, `12. reassign → ${other.email}`, go);
    const back = await api('/api/firm-admin/clients', faTok, {
      method: 'POST',
      body: { customerId: firstClient.customerId, consultantId: firstClient.consultantId },
    });
    check(back.status === 200, '13. reassign 복원', back);
  } else {
    console.log('   ⏭️  reassign skip (client 또는 대체 직원 없음)');
    check(true, '12. reassign skipped');
    check(true, '13. reassign skipped');
  }

  // ── 14. duplicate consultant email ──
  const dup = await api('/api/firm-admin/staff', faTok, {
    method: 'POST',
    body: { email: 'external.consultant@mitrapajak.com', role: 'CONSULTANT' },
  });
  check(dup.status === 409, '14. duplicate consultant email → 409', dup.status);

  // Cleanup
  await admin.from('staff_invitation').delete().eq('email', SENTINEL_EMAIL);

  console.log(`\n${'='.repeat(40)}`);
  console.log(`PASS ${pass} / FAIL ${fail}`);
  if (fail > 0) process.exit(1);
  console.log('✨ firm-admin flow smoke PASS');
}

run().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
