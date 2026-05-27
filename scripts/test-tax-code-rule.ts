/**
 * Smoke test for Tax Code Rule (Track B):
 *   1.  MASTER GET → 200, 7 rows, expected category set
 *   2.  CONSULTANT_JTC GET → 200 (read allowed)
 *   3.  PLATFORM_ADMIN GET → 403 (blockPlatformAdmin)
 *   4.  MASTER PATCH PPh21.review_note → 200, value applied
 *   5.  re-GET → updated_by/updated_at reflect MASTER
 *   6.  MASTER PATCH revert → 200
 *   7.  SUPERVISOR PATCH → 403
 *   8.  TAX_OPERATOR PATCH → 403
 *   9.  CONSULTANT_JTC PATCH → 403
 *   10. PLATFORM_ADMIN PATCH → 403
 *   11. MASTER PATCH empty body → 400
 *   12. MASTER PATCH non-existent uuid → 404
 *
 * Prereq: master.test@aipajak.com seeded (seed-master-and-external.ts).
 * Migration 20260527000001_tax_code_rule.sql applied.
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

const EXPECTED_CATEGORIES = ['PPh21', 'PPh23', 'PPh4(2)', 'PPh22', 'PPh26', 'PPN', 'PPh25'];
const ORIGINAL_PPH21_REVIEW = '직원구분/비과세/공제항목 확인';
const TEMP = `__SMOKE_${Date.now()}__`;

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
  const r = await fetch(`${baseUrl}/api/admin/tax-code-rule`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function patch(token: string, id: string, body: object) {
  const r = await fetch(`${baseUrl}/api/admin/tax-code-rule/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function run() {
  console.log('🧪 Tax Code Rule smoke\n');
  let pass = 0;
  let fail = 0;

  const masterTok = await login('master.test@aipajak.com');
  const supTok = await login('supervisor.test@aipajak.com');
  const opTok = await login('operator.test@aipajak.com');
  const consTok = await login('consultant.test@jakartatax.co.id');
  const adminTok = await login('admin.test@aipajak.com');
  if (!masterTok || !supTok || !opTok || !consTok || !adminTok) process.exit(1);
  console.log('✅ all 5 actors logged in\n');

  // 1. MASTER GET
  const r1 = await get(masterTok);
  if (r1.status === 200 && Array.isArray(r1.body.data) && r1.body.data.length === 7) {
    const cats = r1.body.data.map((x: { category: string }) => x.category);
    if (EXPECTED_CATEGORIES.every((c) => cats.includes(c))) {
      console.log(`✅ 1. MASTER GET → 200, 7 rows, expected categories present`); pass++;
    } else {
      console.error(`✗ 1. MASTER GET categories mismatch: ${cats.join(',')}`); fail++;
    }
  } else {
    console.error(`✗ 1. MASTER GET unexpected:`, r1); fail++;
  }
  const pph21 = r1.body.data?.find((x: { category: string }) => x.category === 'PPh21');
  if (!pph21) { console.error('✗ PPh21 row missing — abort'); process.exit(1); }

  // 2. CONSULTANT GET
  const r2 = await get(consTok);
  if (r2.status === 200) { console.log(`✅ 2. CONSULTANT GET → 200`); pass++; }
  else { console.error(`✗ 2. CONSULTANT GET ${r2.status}`); fail++; }

  // 3. PLATFORM_ADMIN GET
  const r3 = await get(adminTok);
  if (r3.status === 403) { console.log(`✅ 3. PLATFORM_ADMIN GET → 403`); pass++; }
  else { console.error(`✗ 3. PLATFORM_ADMIN GET ${r3.status} (want 403)`); fail++; }

  // 4. MASTER PATCH
  const r4 = await patch(masterTok, pph21.id, { review_note: TEMP });
  if (r4.status === 200 && r4.body.data?.review_note === TEMP) {
    console.log(`✅ 4. MASTER PATCH applied`); pass++;
  } else {
    console.error(`✗ 4. MASTER PATCH:`, r4); fail++;
  }

  // 5. re-GET reflects updated_by
  const r5 = await get(masterTok);
  const reread = r5.body.data?.find((x: { category: string }) => x.category === 'PPh21');
  if (reread?.review_note === TEMP && reread?.updated_by) {
    console.log(`✅ 5. re-GET reflects update + updated_by set`); pass++;
  } else {
    console.error(`✗ 5. re-GET:`, reread); fail++;
  }

  // 6. revert
  const r6 = await patch(masterTok, pph21.id, { review_note: ORIGINAL_PPH21_REVIEW });
  if (r6.status === 200) { console.log(`✅ 6. revert ok`); pass++; }
  else { console.error(`✗ 6. revert:`, r6); fail++; }

  // 7. SUPERVISOR PATCH
  const r7 = await patch(supTok, pph21.id, { review_note: 'x' });
  if (r7.status === 403) { console.log(`✅ 7. SUPERVISOR PATCH → 403`); pass++; }
  else { console.error(`✗ 7. SUPERVISOR PATCH ${r7.status}`); fail++; }

  // 8. OPERATOR PATCH
  const r8 = await patch(opTok, pph21.id, { review_note: 'x' });
  if (r8.status === 403) { console.log(`✅ 8. OPERATOR PATCH → 403`); pass++; }
  else { console.error(`✗ 8. OPERATOR PATCH ${r8.status}`); fail++; }

  // 9. CONSULTANT PATCH
  const r9 = await patch(consTok, pph21.id, { review_note: 'x' });
  if (r9.status === 403) { console.log(`✅ 9. CONSULTANT PATCH → 403`); pass++; }
  else { console.error(`✗ 9. CONSULTANT PATCH ${r9.status}`); fail++; }

  // 10. ADMIN PATCH
  const r10 = await patch(adminTok, pph21.id, { review_note: 'x' });
  if (r10.status === 403) { console.log(`✅ 10. PLATFORM_ADMIN PATCH → 403`); pass++; }
  else { console.error(`✗ 10. PLATFORM_ADMIN PATCH ${r10.status}`); fail++; }

  // 11. empty body
  const r11 = await patch(masterTok, pph21.id, {});
  if (r11.status === 400) { console.log(`✅ 11. empty body → 400`); pass++; }
  else { console.error(`✗ 11. empty body ${r11.status}`); fail++; }

  // 12. non-existent uuid
  const r12 = await patch(masterTok, '00000000-0000-0000-0000-000000000000', { review_note: 'x' });
  if (r12.status === 404) { console.log(`✅ 12. non-existent uuid → 404`); pass++; }
  else { console.error(`✗ 12. non-existent uuid ${r12.status}`); fail++; }

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
