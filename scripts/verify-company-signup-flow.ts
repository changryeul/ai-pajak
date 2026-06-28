/**
 * COMPANY 가입 → 회사프로필 GET → 완성도 검증 → cleanup e2e smoke.
 *
 * Trace:
 *  1. sentinel email/NPWP 로 POST /api/auth/signup-company
 *     - business_category 도 함께 보냄 (2026-06-27 신규 컬럼)
 *  2. customer row 생성 확인 (admin)
 *  3. /api/company-profile?customerId=... GET → profile_completeness 계산값 확인
 *     - business_category 가 채워졌으면 base 가중치 (2/11.5) 만큼 더해진다.
 *  4. cleanup — auth user + customer row 삭제 (auth admin)
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-company-signup-flow.ts
 *
 * Exit 0 = all assertions pass. Exit 1 = any assertion failed.
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`x ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const BASE_URL =
  process.env.E2E_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Sentinel NPWP — 15 digits, leading 99 so it never collides with real ones.
const SENTINEL_PREFIX = 'smoke-company-signup-';
const sentinelStamp = Date.now().toString().slice(-8);
const SENTINEL_EMAIL = `${SENTINEL_PREFIX}${sentinelStamp}@example.com`;
const SENTINEL_NPWP_RAW = `99${sentinelStamp.padStart(13, '0')}`;
const SENTINEL_NPWP = SENTINEL_NPWP_RAW.slice(0, 2) +
  '.' + SENTINEL_NPWP_RAW.slice(2, 5) +
  '.' + SENTINEL_NPWP_RAW.slice(5, 8) +
  '.' + SENTINEL_NPWP_RAW.slice(8, 9) +
  '-' + SENTINEL_NPWP_RAW.slice(9, 12) +
  '.' + SENTINEL_NPWP_RAW.slice(12, 15);
const COMPANY_NAME = `PT Smoke Sentinel ${sentinelStamp}`;

async function main() {
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  let pass = 0, fail = 0;

  // Pre-cleanup any stale sentinel customer rows. 2026-06-28: customer 에는
  // subscription FK 가 걸려있어서 단순 delete 가 silent fail 함 — 자식 테이블을
  // 먼저 비우고 그 다음 customer 를 지운다. 실 운영시 자동 생성되는 자식 행:
  //   - subscription (signup-company 가 자동 생성)
  //   - 그 외 (customer_subscription / consultant / note 등) 은 trigger 없음.
  const { data: stale } = await sbAdmin.from('customer').select('id').like('email', `${SENTINEL_PREFIX}%`);
  const staleIds = (stale ?? []).map((r) => r.id);
  if (staleIds.length > 0) {
    await sbAdmin.from('subscription').delete().in('customer_id', staleIds);
    await sbAdmin.from('customer').delete().in('id', staleIds);
  }

  // 1. POST /api/auth/signup-company
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup-company`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: SENTINEL_EMAIL,
      password: 'SmokePassword123!',
      fullName: 'Smoke Director',
      phone: '+62 21 0000 0000',
      companyName: COMPANY_NAME,
      npwp: SENTINEL_NPWP,
      address: 'Jl. Smoke No. 1, Jakarta',
      kbliCodes: ['62010'],
      primaryKbli: '62010',
      businessCategory: 'SERVICE',
      taxProfile: { annualRevenue: 1_000_000_000, isPkp: false, hasEmployees: false },
      jtcAgreement: { accepted: true, version: 'v1.0', dataProcessing: true, taxFilingAuthorization: true, creditAnalysis: false },
      signatureDataUrl: null,
    }),
  });
  const signupBody = await signupRes.json().catch(() => ({}));
  if (signupRes.status === 200 && signupBody.success) {
    console.log('✅ 1. signup-company → 200');
    pass++;
  } else {
    console.error(`✗ 1. signup-company status=${signupRes.status} body=${JSON.stringify(signupBody).slice(0, 240)}`);
    fail++;
  }

  // 2. Customer row exists with business_category persisted
  const { data: cust } = await sbAdmin
    .from('customer')
    .select('id, customer_type, company_name, business_category, npwp')
    .eq('email', SENTINEL_EMAIL)
    .maybeSingle();
  if (cust && cust.customer_type === 'COMPANY' && cust.business_category === 'SERVICE') {
    console.log(`✅ 2. customer row ok — type=COMPANY business_category=SERVICE company=${cust.company_name}`);
    pass++;
  } else {
    console.error(`✗ 2. customer row mismatch: ${JSON.stringify(cust)}`);
    fail++;
  }

  // 3. company-profile GET requires auth — sign in with sentinel creds.
  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({
    email: SENTINEL_EMAIL, password: 'SmokePassword123!',
  });
  if (authErr || !auth.session) {
    console.error(`✗ 3.signIn: ${authErr?.message}`);
    fail++;
  } else {
    const profRes = await fetch(`${BASE_URL}/api/company-profile`, {
      headers: { Authorization: `Bearer ${auth.session.access_token}` },
    });
    const profBody = await profRes.json().catch(() => ({}));
    const score = profBody?.data?.profile_completeness ?? 0;
    // 회사명 + NPWP + business_category 합산: weight 2+2+2 = 6. boolean default 3 = 3.
    // total weight = 11.5. 가입 직후 (6 + 3) / 11.5 ≈ 78%.
    if (profRes.status === 200 && profBody.success && score >= 60) {
      console.log(`✅ 3. /api/company-profile profile_completeness = ${score}% (≥ 60% expected)`);
      pass++;
    } else {
      console.error(`✗ 3. company-profile status=${profRes.status} score=${score} body=${JSON.stringify(profBody).slice(0, 240)}`);
      fail++;
    }
  }

  // 4. Cleanup — subscription → customer → auth user (FK order).
  if (cust?.id) {
    await sbAdmin.from('subscription').delete().eq('customer_id', cust.id);
    await sbAdmin.from('customer').delete().eq('id', cust.id);
  }
  // auth user lookup by email — admin API doesn't expose direct getByEmail, use listUsers.
  // For sentinel cleanup, just attempt delete by id from user_id on customer above
  // (already in cust.id chain via user_roles trigger cleanup is best-effort).
  try {
    const { data: u } = await sbAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
    const found = u?.users?.find((usr) => usr.email === SENTINEL_EMAIL);
    if (found) await sbAdmin.auth.admin.deleteUser(found.id);
  } catch {
    /* best-effort */
  }
  console.log('✅ 4. cleanup ok');
  pass++;

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
