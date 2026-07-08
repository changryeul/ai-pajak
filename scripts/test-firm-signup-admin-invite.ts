/**
 * Golden-path smoke: 세무법인 셀프 가입 → FIRM_ADMIN 전용 계정 부트스트랩.
 *
 *   1. POST /api/auth/signup (TAX_PARTNER + adminEmail)
 *      → 200 + adminInviteSent=true
 *   2. staff_invitation row: role=FIRM_ADMIN + tax_partner_id 세팅 확인
 *   3. POST /api/auth/accept-invitation (token) → 계정 생성
 *   4. 관리자 로그인 → GET /api/firm-admin/staff 200
 *      + 자기 법인 직원 (대표 + 관리자) 만 노출
 *
 * Sentinel: PT Smoke Signup Firm / firm-signup-smoke-*@example.com
 * Pre-cleanup + post-cleanup (auth user 2 + consultant 2 + partner 1 +
 * invitation) — 재실행 안전.
 *
 * Run: SEED_TARGET=prod npx tsx scripts/test-firm-signup-admin-invite.ts
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

const FIRM_NAME = 'PT Smoke Signup Firm';
const REP_EMAIL = 'firm-signup-smoke-rep@example.com';
const ADMIN_EMAIL = 'firm-signup-smoke-admin@example.com';
const PASSWORD = 'TestPassword123!';

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

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

async function findUserIdBySignIn(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user?.id) return null;
  return data.user.id;
}

async function cleanup() {
  await admin.from('staff_invitation').delete().in('email', [REP_EMAIL, ADMIN_EMAIL]);
  await admin.from('consultant').delete().in('email', [REP_EMAIL, ADMIN_EMAIL]);
  for (const email of [REP_EMAIL, ADMIN_EMAIL]) {
    const uid = await findUserIdBySignIn(email);
    if (uid) {
      await admin.from('user_roles').delete().eq('user_id', uid);
      await admin.auth.admin.deleteUser(uid).catch(() => {});
    }
  }
  await admin.from('tax_partner').delete().eq('name', FIRM_NAME);
}

async function run() {
  console.log('🧪 Firm signup → FIRM_ADMIN bootstrap smoke\n');
  await cleanup(); // pre-cleanup (재실행 안전)

  // ── 1. signup with adminEmail ──
  const signup = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: REP_EMAIL,
      password: PASSWORD,
      fullName: 'Smoke Rep',
      phone: '+62811111111',
      accountType: 'TAX_PARTNER',
      firmName: FIRM_NAME,
      adminEmail: ADMIN_EMAIL,
    }),
  });
  const signupJson = await signup.json().catch(() => ({}));
  check(signup.status === 200 && signupJson.success === true, '1. signup 200', signupJson);
  check(signupJson.data?.adminInviteSent === true, '1b. adminInviteSent=true', signupJson.data);

  // ── 2. invitation row shape ──
  const { data: inv } = await admin
    .from('staff_invitation')
    .select('id, role, tax_partner_id, token, inviter_role')
    .eq('email', ADMIN_EMAIL)
    .is('accepted_at', null)
    .is('cancelled_at', null)
    .maybeSingle();
  check(
    Boolean(inv && inv.role === 'FIRM_ADMIN' && inv.tax_partner_id && inv.inviter_role === 'TAX_ADVISOR'),
    '2. invitation row (FIRM_ADMIN + tax_partner_id + inviter TAX_ADVISOR)',
    inv,
  );
  if (!inv?.token) {
    console.error('   토큰 없음 — 중단');
    await cleanup();
    process.exit(1);
  }

  // ── 3. accept invitation ──
  const accept = await fetch(`${baseUrl}/api/auth/accept-invitation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: inv.token, password: PASSWORD, fullName: 'Smoke Admin' }),
  });
  const acceptJson = await accept.json().catch(() => ({}));
  check(accept.status === 200 && acceptJson.success === true, '3. accept-invitation 200', acceptJson);

  // ── 4. admin login → firm-admin/staff 200, 자기 법인만 ──
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: session, error: loginErr } = await c.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: PASSWORD,
  });
  check(Boolean(session?.session?.access_token), '4. 관리자 로그인', loginErr?.message);

  if (session?.session?.access_token) {
    const r = await fetch(`${baseUrl}/api/firm-admin/staff`, {
      headers: { Authorization: `Bearer ${session.session.access_token}` },
    });
    const j = await r.json().catch(() => ({}));
    const emails: string[] = (j.data?.staff ?? []).map((s: { email: string }) => s.email);
    check(r.status === 200 && j.success === true, '4b. GET firm-admin/staff 200', j);
    check(
      emails.includes(REP_EMAIL) &&
        emails.includes(ADMIN_EMAIL) &&
        emails.every((e) => e.endsWith('@example.com')),
      '4c. 자기 법인 직원만 (대표 + 관리자)',
      emails,
    );
  } else {
    fail += 2;
  }

  await cleanup();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`PASS ${pass} / FAIL ${fail}`);
  if (fail > 0) process.exit(1);
  console.log('✨ firm signup → FIRM_ADMIN bootstrap PASS');
}

run().catch(async (e) => {
  console.error('❌ Fatal:', e);
  await cleanup().catch(() => {});
  process.exit(1);
});
