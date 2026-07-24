/**
 * Smoke test for /api/admin/master/customer-ai-templates and the
 * operator inbox read endpoint at /api/operator/customer-inbox/templates.
 *
 * Assertions (9):
 *   1. MASTER GET (admin) → 200 with array
 *   2. SUPERVISOR GET (admin) → 200
 *   3. OPERATOR GET (admin) → 403 (admin endpoint = SUPERVISOR+)
 *   4. OPERATOR GET (inbox endpoint) → 200 (operator-tier read)
 *   5. CONSULTANT GET (admin) → 403
 *   6. MASTER POST → 201 with id
 *   7. MASTER PATCH that row → 200, persisted on re-GET
 *   8. SUPERVISOR POST → 403 (write needs MASTER)
 *   9. MASTER DELETE that row → 200
 *
 * Pattern reference: test-luxury-classifications.ts (commit f242e9f).
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

const ADMIN_ROUTE = '/api/admin/master/customer-ai-templates';
const INBOX_ROUTE = '/api/operator/customer-inbox/templates';
const TEMP_TITLE = `__SMOKE_TPL_${Date.now()}__`;
const TEMP_TITLE_2 = `${TEMP_TITLE}_UPDATED`;

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'TestPassword123!' });
  if (error || !data.session?.access_token) {
    console.error(`✗ login ${email}: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

async function req(
  route: string,
  method: string,
  token: string,
  qs?: string,
  body?: object,
): Promise<{ status: number; body: any }> {
  const r = await fetch(`${baseUrl}${route}${qs ?? ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function run() {
  console.log('🧪 Customer AI Templates smoke\n');
  let pass = 0;
  let fail = 0;
  let createdId: string | null = null;

  const masterTok = await login('master.test@aipajak.com');
  const supTok = await login('supervisor.test@aipajak.com');
  const opTok = await login('operator.test@aipajak.com');
  const consTok = await login('external.consultant@mitrapajak.com');
  if (!masterTok || !supTok || !opTok || !consTok) process.exit(1);
  console.log('✅ all 4 actors logged in\n');

  // 1. MASTER GET (admin) → 200
  const r1 = await req(ADMIN_ROUTE, 'GET', masterTok);
  if (r1.status === 200 && Array.isArray(r1.body.data)) {
    console.log(`✅ 1. MASTER GET (admin) → 200, ${r1.body.data.length} rows`);
    pass++;
  } else {
    console.error(`✗ 1. MASTER GET:`, r1);
    fail++;
  }

  // 2. SUPERVISOR GET (admin) → 200
  const r2 = await req(ADMIN_ROUTE, 'GET', supTok);
  if (r2.status === 200 && Array.isArray(r2.body.data)) {
    console.log(`✅ 2. SUPERVISOR GET (admin) → 200`);
    pass++;
  } else {
    console.error(`✗ 2. SUPERVISOR GET ${r2.status}`, r2.body);
    fail++;
  }

  // 3. OPERATOR GET (admin) → 403
  const r3 = await req(ADMIN_ROUTE, 'GET', opTok);
  if (r3.status === 403) {
    console.log(`✅ 3. OPERATOR GET (admin) → 403`);
    pass++;
  } else {
    console.error(`✗ 3. OPERATOR GET (admin) ${r3.status} (want 403)`, r3.body);
    fail++;
  }

  // 4. OPERATOR GET (inbox endpoint) → 200
  const r4 = await req(INBOX_ROUTE, 'GET', opTok);
  if (r4.status === 200 && Array.isArray(r4.body.data)) {
    // Sanity-check DTO shape on first row if present
    const first = r4.body.data[0];
    if (!first || (typeof first.id === 'string' && typeof first.title === 'string' && typeof first.body === 'string')) {
      console.log(`✅ 4. OPERATOR GET (inbox) → 200, ${r4.body.data.length} rows`);
      pass++;
    } else {
      console.error(`✗ 4. OPERATOR GET (inbox): bad DTO shape`, first);
      fail++;
    }
  } else {
    console.error(`✗ 4. OPERATOR GET (inbox) ${r4.status}`, r4.body);
    fail++;
  }

  // 5. CONSULTANT GET (admin) → 403
  const r5 = await req(ADMIN_ROUTE, 'GET', consTok);
  if (r5.status === 403) {
    console.log(`✅ 5. CONSULTANT GET (admin) → 403`);
    pass++;
  } else {
    console.error(`✗ 5. CONSULTANT GET (admin) ${r5.status}`, r5.body);
    fail++;
  }

  // 6. MASTER POST → 201 with id
  const r6 = await req(ADMIN_ROUTE, 'POST', masterTok, undefined, {
    title: TEMP_TITLE,
    body: 'Smoke body text.',
    category: 'smoke',
    display_order: 999,
    is_active: true,
  });
  if (r6.status === 201 && r6.body.data?.id) {
    createdId = r6.body.data.id;
    console.log(`✅ 6. MASTER POST → 201 (id=${createdId})`);
    pass++;
  } else {
    console.error(`✗ 6. MASTER POST:`, r6);
    fail++;
  }

  // 7. MASTER PATCH → 200, persisted on re-GET
  if (createdId) {
    const r7 = await req(ADMIN_ROUTE, 'PATCH', masterTok, `?id=${createdId}`, { title: TEMP_TITLE_2 });
    const r7g = await req(ADMIN_ROUTE, 'GET', masterTok);
    const found = r7g.body.data?.find((r: { id: string }) => r.id === createdId);
    if (r7.status === 200 && r7.body.data?.title === TEMP_TITLE_2 && found?.title === TEMP_TITLE_2) {
      console.log(`✅ 7. MASTER PATCH → 200, persisted on re-GET`);
      pass++;
    } else {
      console.error(`✗ 7. MASTER PATCH:`, r7, 're-GET row:', found);
      fail++;
    }
  } else {
    console.error(`✗ 7. skip — no createdId from step 6`);
    fail++;
  }

  // 8. SUPERVISOR POST → 403
  const r8 = await req(ADMIN_ROUTE, 'POST', supTok, undefined, {
    title: '__SHOULD_NEVER_INSERT__',
    body: 'nope',
  });
  if (r8.status === 403) {
    console.log(`✅ 8. SUPERVISOR POST → 403`);
    pass++;
  } else {
    console.error(`✗ 8. SUPERVISOR POST ${r8.status}`, r8.body);
    fail++;
  }

  // 9. MASTER DELETE → 200
  if (createdId) {
    const r9 = await req(ADMIN_ROUTE, 'DELETE', masterTok, `?id=${createdId}`);
    if (r9.status === 200 && r9.body.data?.ok === true) {
      console.log(`✅ 9. MASTER DELETE → 200`);
      pass++;
      createdId = null;
    } else {
      console.error(`✗ 9. MASTER DELETE:`, r9);
      fail++;
    }
  } else {
    console.error(`✗ 9. skip — no createdId from step 6`);
    fail++;
  }

  // ── cleanup safety net ─────────────────────────────────────────────
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (createdId && serviceKey) {
    console.log(`⚠ cleanup: hard-deleting leftover id=${createdId}`);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    await admin.from('customer_ai_template').delete().eq('id', createdId);
  }
  // Nuke any leftover smoke-prefixed rows from earlier aborted runs.
  if (serviceKey) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    await admin
      .from('customer_ai_template')
      .delete()
      .like('title', '__SMOKE_TPL_%');
  }

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
