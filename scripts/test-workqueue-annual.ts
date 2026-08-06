/**
 * Workqueue 연 신고(SPT Tahunan) smoke test:
 *   quick-create(SPT_TAHUNAN) → GET annual 상세 (세션 미연결 red)
 *   → 결산 세션+문서+제출 연결 → GET annual (green + shape)
 *   → 연도 단위 목록 조회 → RBAC 403 → cleanup.
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/test-workqueue-annual.ts
 * Sentinel fiscal year 2099. Sentinel prefix: [WQ-ANNUAL-E2E].
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const baseUrl = process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
console.log(`🌐 ${baseUrl}\n`);

const PASSWORD = 'TestPassword123!';
const CUSTOMER_ID = '00000000-0000-4000-8000-000000000011'; // company.test
const FISCAL_YEAR = 2099;

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let failures = 0;
function assert(cond: unknown, label: string) {
  if (cond) console.log(`   ✓ ${label}`);
  else { console.error(`   ❌ ${label}`); failures++; }
}

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) { console.error(`   ❌ login failed for ${email}: ${error?.message ?? 'no session'}`); return null; }
  return data.session.access_token;
}
async function api(token: string, method: string, pathname: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Record<string, unknown>;
  try { json = await res.json(); } catch { json = { error: await res.text() }; }
  return { status: res.status, json };
}

async function cleanup() {
  const { data: sessions } = await admin.from('tax_closing_session')
    .select('id').eq('customer_id', CUSTOMER_ID).eq('fiscal_year', FISCAL_YEAR);
  for (const s of sessions ?? []) {
    await admin.from('closing_submission').delete().eq('session_id', s.id);
    await admin.from('closing_document').delete().eq('session_id', s.id);
  }
  await admin.from('djp_submission_queue').delete()
    .eq('customer_id', CUSTOMER_ID).eq('tax_type', 'SPT_TAHUNAN').eq('tax_period_year', FISCAL_YEAR);
  await admin.from('tax_closing_session').delete()
    .eq('customer_id', CUSTOMER_ID).eq('fiscal_year', FISCAL_YEAR);
}

async function main() {
  console.log('🧾 Workqueue annual (SPT Tahunan) smoke test\n');

  console.log('🧹 Pre-cleanup');
  await cleanup();

  const supToken = await login('supervisor.test@aipajak.com');
  const custToken = await login('company.test@example.com');
  if (!supToken || !custToken) process.exit(1);

  console.log('\n━━ 1. quick-create SPT_TAHUNAN queue row ━━');
  const created = await api(supToken, 'POST', '/api/operator/queue', {
    customerId: CUSTOMER_ID, taxType: 'SPT_TAHUNAN', month: 12, year: FISCAL_YEAR,
  });
  assert(created.status === 200, `quick-create 200 (got ${created.status})`);
  const queueId = (created.json as { data?: { id?: string } }).data?.id;
  assert(!!queueId, 'queue row id returned');
  if (!queueId) { await cleanup(); process.exit(1); }

  console.log('\n━━ 2. GET annual detail — 세션 미연결 (red) ━━');
  const d1 = await api(supToken, 'GET', `/api/operator/workqueue/${queueId}/annual`);
  const d1data = (d1.json as { data?: { flags?: { level?: string; issues?: string[] }; summary?: { closingType?: string | null } } }).data;
  assert(d1.status === 200, `detail 200 (got ${d1.status})`);
  assert(d1data?.flags?.level === 'red', `unlinked case flags red (got ${d1data?.flags?.level})`);
  assert(d1data?.summary?.closingType === null, 'closingType null when unlinked');

  console.log('\n━━ 3. link closing session + document + submission ━━');
  const { data: session, error: sesErr } = await admin.from('tax_closing_session').insert({
    customer_id: CUSTOMER_ID, fiscal_year: FISCAL_YEAR, closing_type: 'UMKM',
    current_step: 'submit', status: 'COMPLETED', signed_statements_uploaded: true,
    data: { sentinel: '[WQ-ANNUAL-E2E]' },
  }).select('id').single();
  assert(!sesErr && !!session, `closing session inserted ${sesErr?.message ?? ''}`);
  if (!session) { await cleanup(); process.exit(1); }

  const { error: docErr } = await admin.from('closing_document').insert({
    session_id: session.id, doc_type: 'bank', file_name: '[WQ-ANNUAL-E2E] bank.pdf',
    storage_path: 'closing-documents/e2e/wq-annual-sentinel.pdf', mime_type: 'application/pdf', size_bytes: 1234,
  });
  const { error: subErr } = await admin.from('closing_submission').insert({
    session_id: session.id, status: 'SUBMITTED', channel: 'RPA',
    package_summary: { sentinel: '[WQ-ANNUAL-E2E]' },
  });
  const { error: linkErr } = await admin.from('djp_submission_queue')
    .update({ closing_session_id: session.id }).eq('id', queueId);
  assert(!docErr && !subErr && !linkErr,
    `document+submission+link ok ${docErr?.message ?? subErr?.message ?? linkErr?.message ?? ''}`);

  console.log('\n━━ 4. GET annual detail — linked shape ━━');
  const d2 = await api(supToken, 'GET', `/api/operator/workqueue/${queueId}/annual`);
  const d2data = (d2.json as { data?: {
    fiscalYear?: number;
    flags?: { level?: string; issues?: string[] };
    summary?: { closingType?: string | null; documentCount?: number; submissionStatus?: string | null; sessionStatus?: string | null };
    rows?: Array<{ docType?: string; fileName?: string }>;
  } }).data;
  assert(d2.status === 200, `detail 200 (got ${d2.status})`);
  assert(d2data?.summary?.closingType === 'UMKM', `closingType UMKM (got ${d2data?.summary?.closingType})`);
  assert(d2data?.summary?.documentCount === 1, `documentCount 1 (got ${d2data?.summary?.documentCount})`);
  assert(d2data?.summary?.submissionStatus === 'SUBMITTED', `submissionStatus SUBMITTED (got ${d2data?.summary?.submissionStatus})`);
  assert(d2data?.flags?.level === 'green', `flags green when complete (got ${d2data?.flags?.level}: ${d2data?.flags?.issues?.join(', ')})`);
  assert(d2data?.rows?.[0]?.docType === 'bank', 'document row present');
  assert(d2data?.fiscalYear === FISCAL_YEAR, 'fiscalYear matches');

  console.log('\n━━ 5. year-scoped list (no month filter) ━━');
  const list = await api(supToken, 'GET', `/api/operator/queue?taxType=SPT_TAHUNAN&year=${FISCAL_YEAR}&limit=50`);
  const items = ((list.json as { data?: { items?: Array<{ id: string }> } }).data?.items) ?? [];
  assert(list.status === 200 && items.some(i => i.id === queueId), 'annual list contains sentinel row');

  console.log('\n━━ 6. RBAC — customer 403 ━━');
  const rbac = await api(custToken, 'GET', `/api/operator/workqueue/${queueId}/annual`);
  assert(rbac.status === 403, `customer blocked with 403 (got ${rbac.status})`);

  console.log('\n🧹 Cleanup');
  await cleanup();

  console.log(`\n📊 ${failures === 0 ? 'PASS' : `${failures} FAILED`}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await cleanup(); process.exit(1); });
