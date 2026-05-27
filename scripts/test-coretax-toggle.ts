/**
 * Smoke test for Coretax Toggle (Track D):
 *   1. SUPERVISOR GET → 200 + {enabled, updatedAt, updatedBy} shape
 *   2. MASTER GET → 200 (matches supervisor)
 *   3. PLATFORM_ADMIN GET → 403
 *   4. SUPERVISOR PATCH → 403
 *   5. MASTER PATCH {enabled: !current} → 200 + DB persists + revert
 *
 * Prereq: master/supervisor/admin 시드. Migration 20260527000003 적용.
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
  const r = await fetch(`${baseUrl}/api/admin/coretax/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function patch(token: string, body: object) {
  const r = await fetch(`${baseUrl}/api/admin/coretax/config`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function run() {
  console.log('🧪 Coretax toggle smoke\n');
  let pass = 0, fail = 0;

  const masterTok = await login('master.test@aipajak.com');
  const supTok = await login('supervisor.test@aipajak.com');
  const adminTok = await login('admin.test@aipajak.com');
  if (!masterTok || !supTok || !adminTok) process.exit(1);
  console.log('✅ 3 actors logged in\n');

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
    console.error('✗ initialEnabled not boolean — abort'); process.exit(1);
  }

  // 2. MASTER GET
  const r2 = await get(masterTok);
  if (r2.status === 200 && r2.body.data?.enabled === initialEnabled) {
    console.log(`✅ 2. MASTER GET → 200, matches supervisor view`); pass++;
  } else {
    console.error(`✗ 2. MASTER GET:`, r2); fail++;
  }

  // 3. PLATFORM_ADMIN GET → 403
  const r3 = await get(adminTok);
  if (r3.status === 403) { console.log(`✅ 3. PLATFORM_ADMIN GET → 403`); pass++; }
  else { console.error(`✗ 3. PLATFORM_ADMIN GET ${r3.status}`); fail++; }

  // 4. SUPERVISOR PATCH → 403
  const r4 = await patch(supTok, { enabled: !initialEnabled });
  if (r4.status === 403) { console.log(`✅ 4. SUPERVISOR PATCH → 403`); pass++; }
  else { console.error(`✗ 4. SUPERVISOR PATCH ${r4.status}`); fail++; }

  // 5. MASTER PATCH + verify + revert
  const r5flip = await patch(masterTok, { enabled: !initialEnabled });
  if (r5flip.status === 200 && r5flip.body.data?.enabled === !initialEnabled) {
    const r5verify = await get(masterTok);
    if (r5verify.body.data?.enabled === !initialEnabled) {
      console.log(`✅ 5. MASTER PATCH applied (${initialEnabled} → ${!initialEnabled})`); pass++;
    } else {
      console.error(`✗ 5. MASTER PATCH didn't persist:`, r5verify); fail++;
    }
    // revert
    await patch(masterTok, { enabled: initialEnabled });
  } else {
    console.error(`✗ 5. MASTER PATCH:`, r5flip); fail++;
  }

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
