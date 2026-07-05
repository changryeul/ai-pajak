/**
 * Smoke test for Tax Code Rule (Track B + Track C):
 *   1.  MASTER GET → 200, 7 rows, expected category set
 *   2.  CONSULTANT GET → 403 (Track A narrow gate)
 *   3.  PLATFORM_ADMIN GET → 403 (blockPlatformAdmin)
 *   4.  MASTER PATCH PPh21.review_note → 200, value applied
 *   5.  re-GET → updated_by/updated_at reflect MASTER
 *   6.  MASTER PATCH revert → 200
 *   7.  SUPERVISOR PATCH → 403
 *   8.  TAX_OPERATOR PATCH → 403
 *   9.  CONSULTANT PATCH → 403
 *   10. PLATFORM_ADMIN PATCH → 403
 *   11. MASTER PATCH empty body → 400
 *   12. MASTER PATCH non-existent uuid → 404
 *   13. MASTER GET audit-log → 200, array (Track C)
 *   14. PATCH 후 audit-log 첫 행 = 방금 변경 (ruleId/category/before/after) (Track C)
 *   15. PLATFORM_ADMIN GET audit-log → 403 (Track C)
 *   16. SUPERVISOR GET → 200, 7 rows
 *   17. SUPERVISOR GET audit-log → 200, array
 *   18. OPERATOR GET → 403 (Track A 추가 차단)
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

  // Guard: prior aborted run could have left __SMOKE_ marker in prod.
  // If so, we'd overwrite the marker with another marker and the revert
  // would never get back to the real value. Abort with a clear message
  // instead so a human can investigate.
  if (pph21.review_note.startsWith('__SMOKE_')) {
    console.error(`✗ leftover TEMP marker detected in prod (${pph21.review_note}). A prior smoke run aborted mid-write — manual revert needed before this test can run.`);
    process.exit(1);
  }

  // Self-healing baseline: capture the real value from r1, not hardcoded.
  const originalReviewNote = pph21.review_note;

  // 2. CONSULTANT GET → 403 (Track A 의 narrow gate)
  const r2 = await get(consTok);
  if (r2.status === 403) { console.log(`✅ 2. CONSULTANT GET → 403`); pass++; }
  else { console.error(`✗ 2. CONSULTANT GET ${r2.status} (want 403)`); fail++; }

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
  const r6 = await patch(masterTok, pph21.id, { review_note: originalReviewNote });
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

  // ── Track C: audit-log endpoint ──

  // 13. MASTER GET audit-log → 200, array
  async function getAudit(token: string, limit = 10) {
    const r = await fetch(`${baseUrl}/api/admin/tax-code-rule/audit-log?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  const r13 = await getAudit(masterTok);
  if (r13.status === 200 && Array.isArray(r13.body.data)) {
    console.log(`✅ 13. MASTER GET audit-log → 200, ${r13.body.data.length} rows`); pass++;
  } else {
    console.error(`✗ 13. MASTER GET audit-log:`, r13); fail++;
  }

  // 14. PATCH 후 audit-log 첫 행 = 방금 변경
  const TEMP2 = `__SMOKE_AUDIT_${Date.now()}__`;
  const r14p = await patch(masterTok, pph21.id, { review_note: TEMP2 });
  if (r14p.status !== 200) {
    console.error(`✗ 14. setup PATCH failed:`, r14p); fail++;
  } else {
    const r14 = await getAudit(masterTok, 1);
    const first = r14.body.data?.[0];
    const matches =
      first?.ruleId === pph21.id &&
      first?.category === 'PPh21' &&
      first?.diff?.review_note?.before === originalReviewNote &&
      first?.diff?.review_note?.after === TEMP2;
    if (matches) {
      console.log(`✅ 14. audit-log 첫 행 = 방금 PATCH (before/after 정확)`); pass++;
    } else {
      console.error(`✗ 14. audit-log first row mismatch:`, first); fail++;
    }
    // revert
    await patch(masterTok, pph21.id, { review_note: originalReviewNote });
  }

  // 15. PLATFORM_ADMIN GET audit-log → 403
  const r15 = await getAudit(adminTok);
  if (r15.status === 403) { console.log(`✅ 15. PLATFORM_ADMIN GET audit-log → 403`); pass++; }
  else { console.error(`✗ 15. PLATFORM_ADMIN GET audit-log ${r15.status}`); fail++; }

  // ── Track A: narrow gate (SUPERVISOR/OPERATOR contracts) ──

  // 16. SUPERVISOR GET → 200 + 7 rows
  const r16 = await get(supTok);
  if (r16.status === 200 && Array.isArray(r16.body.data) && r16.body.data.length === 7) {
    console.log(`✅ 16. SUPERVISOR GET → 200, 7 rows`); pass++;
  } else {
    console.error(`✗ 16. SUPERVISOR GET unexpected:`, r16); fail++;
  }

  // 17. SUPERVISOR GET audit-log → 200 + array
  const r17 = await getAudit(supTok);
  if (r17.status === 200 && Array.isArray(r17.body.data)) {
    console.log(`✅ 17. SUPERVISOR GET audit-log → 200, ${r17.body.data.length} rows`); pass++;
  } else {
    console.error(`✗ 17. SUPERVISOR GET audit-log:`, r17); fail++;
  }

  // 18. OPERATOR GET → 403 (Track A 추가 차단)
  const r18 = await get(opTok);
  if (r18.status === 403) { console.log(`✅ 18. OPERATOR GET → 403`); pass++; }
  else { console.error(`✗ 18. OPERATOR GET ${r18.status} (want 403)`); fail++; }

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
