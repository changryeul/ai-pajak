/**
 * Smoke test for Operator 2FA enforcement toggle:
 *   1. SUPERVISOR GET → 200 + {enabled, updatedAt, updatedBy} shape
 *   2. MASTER GET → 200 (matches supervisor)
 *   3. OPERATOR GET → 403 (governance scope — SUPERVISOR/MASTER only)
 *   4. PLATFORM_ADMIN GET → 403
 *   5. SUPERVISOR PATCH → 403
 *   6. MASTER PATCH {enabled: !current} → 200 + DB persists + revert
 *
 * Prereq: master/supervisor/operator/admin 시드. Migration 20260711000001 적용.
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

const ENDPOINT = '/api/admin/security/operator-mfa';

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'TestPassword123!' });
  if (error || !data.session?.access_token) {
    console.error(`✗ login ${email}: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

async function get(token: string) {
  const r = await fetch(`${baseUrl}${ENDPOINT}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function patch(token: string, body: object) {
  const r = await fetch(`${baseUrl}${ENDPOINT}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function run() {
  console.log('🧪 Operator MFA toggle smoke\n');
  let pass = 0, fail = 0;

  const masterTok = await login('master.test@aipajak.com');
  const supTok = await login('supervisor.test@aipajak.com');
  const opTok = await login('operator.test@aipajak.com');
  const adminTok = await login('admin.test@aipajak.com');
  if (!masterTok || !supTok || !opTok || !adminTok) process.exit(1);
  console.log('✅ 4 actors logged in\n');

  // 1. SUPERVISOR GET
  const r1 = await get(supTok);
  if (
    r1.status === 200 &&
    typeof r1.body.data?.enabled === 'boolean' &&
    'updatedAt' in r1.body.data &&
    'updatedBy' in r1.body.data
  ) {
    console.log(`✅ 1. SUPERVISOR GET → 200, enabled=${r1.body.data.enabled}`); pass++;
  } else {
    console.error(`✗ 1. SUPERVISOR GET unexpected:`, r1); fail++;
  }
  const initialEnabled = r1.body.data?.enabled;
  if (typeof initialEnabled !== 'boolean') {
    console.error('✗ initialEnabled not boolean — abort (migration 20260711000001 applied?)');
    process.exit(1);
  }

  // 2. MASTER GET
  const r2 = await get(masterTok);
  if (r2.status === 200 && r2.body.data?.enabled === initialEnabled) {
    console.log(`✅ 2. MASTER GET → 200, matches supervisor view`); pass++;
  } else {
    console.error(`✗ 2. MASTER GET:`, r2); fail++;
  }

  // 3. OPERATOR GET → 403
  const r3 = await get(opTok);
  if (r3.status === 403) { console.log(`✅ 3. OPERATOR GET → 403`); pass++; }
  else { console.error(`✗ 3. OPERATOR GET ${r3.status}`); fail++; }

  // 4. PLATFORM_ADMIN GET → 403
  const r4 = await get(adminTok);
  if (r4.status === 403) { console.log(`✅ 4. PLATFORM_ADMIN GET → 403`); pass++; }
  else { console.error(`✗ 4. PLATFORM_ADMIN GET ${r4.status}`); fail++; }

  // 5. SUPERVISOR PATCH → 403
  const r5 = await patch(supTok, { enabled: !initialEnabled });
  if (r5.status === 403) { console.log(`✅ 5. SUPERVISOR PATCH → 403`); pass++; }
  else { console.error(`✗ 5. SUPERVISOR PATCH ${r5.status}`); fail++; }

  // 6. MASTER PATCH + verify + revert
  const r6flip = await patch(masterTok, { enabled: !initialEnabled });
  if (r6flip.status === 200 && r6flip.body.data?.enabled === !initialEnabled) {
    const r6verify = await get(masterTok);
    if (r6verify.body.data?.enabled === !initialEnabled) {
      console.log(`✅ 6. MASTER PATCH applied (${initialEnabled} → ${!initialEnabled})`); pass++;
    } else {
      console.error(`✗ 6. MASTER PATCH didn't persist:`, r6verify); fail++;
    }
    // revert — never leave the enforcement flag flipped by a test run
    await patch(masterTok, { enabled: initialEnabled });
  } else {
    console.error(`✗ 6. MASTER PATCH:`, r6flip); fail++;
    // best-effort revert in case the flip landed but response was odd
    await patch(masterTok, { enabled: initialEnabled });
  }

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
