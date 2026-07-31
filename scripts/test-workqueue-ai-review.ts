/**
 * Workqueue AI pre-review smoke test:
 *   operator POST /workqueue/[id]/ai-review with a synthetic detail payload
 *   → 200 + { riskLevel, findings[], recommendation, mode }. Graceful: no
 *   ANTHROPIC_API_KEY → mode='rule' (contract only checks shape).
 * Run with: SEED_TARGET=prod npx tsx scripts/test-workqueue-ai-review.ts
 * Sentinel prefix: [AIREV-E2E].
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
console.log(`🌐 ${baseUrl}\n`);

const PASSWORD = 'TestPassword123!';
const QID = '00000000-0000-0000-0000-000000000000'; // queueId is not used server-side

let failures = 0;
function assert(c: unknown, l: string) { if (c) console.log(`   ✓ ${l}`); else { console.error(`   ❌ ${l}`); failures++; } }

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) { console.error(`   ❌ login failed ${email}: ${error?.message}`); return null; }
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

const PAYLOAD = {
  taxView: 'withholding', period: '2026-06', summary: { txnCount: 3 },
  rows: [
    { flags: { level: 'red', label: '증빙·거래처 확인 필요' } },
    { flags: { level: 'red', label: 'NPWP 확인 필요' } },
    { flags: { level: 'green', label: '확인 완료' } },
  ],
};

async function main() {
  console.log('🧾 Workqueue AI pre-review smoke test\n');

  const operatorToken = await login('operator.test@aipajak.com');
  if (!operatorToken) process.exit(1);

  console.log('━━ 1. operator POST ai-review ━━');
  const r = await api(operatorToken, 'POST', `/api/operator/workqueue/${QID}/ai-review`, PAYLOAD);
  console.log(`   ${r.status}`);
  assert(r.status === 200 && r.json.success === true, 'ai-review returns 200 success');
  const d = r.json.data as { riskLevel?: string; findings?: unknown; recommendation?: string; mode?: string } | undefined;
  assert(['low', 'medium', 'high'].includes(d?.riskLevel ?? ''), 'riskLevel is low|medium|high');
  assert(Array.isArray(d?.findings), 'findings is array');
  assert(typeof d?.recommendation === 'string' && !!d?.recommendation, 'recommendation is non-empty string');
  assert(['ai', 'rule'].includes(d?.mode ?? ''), 'mode is ai|rule');
  console.log(`   → riskLevel=${d?.riskLevel} mode=${d?.mode} findings=${(d?.findings as unknown[])?.length}`);

  console.log('\n━━ 2. rows missing → 400 ━━');
  const bad = await api(operatorToken, 'POST', `/api/operator/workqueue/${QID}/ai-review`, { taxView: 'ppn' });
  assert(bad.status === 400, 'missing rows → 400');

  console.log('\n━━ 3. RBAC: customer → 403 ━━');
  const customerToken = await login('customer.test@example.com');
  if (customerToken) {
    const forbidden = await api(customerToken, 'POST', `/api/operator/workqueue/${QID}/ai-review`, PAYLOAD);
    console.log(`   ${forbidden.status}`);
    assert(forbidden.status === 403, 'non-operator gets 403');
  } else { console.error('   ⚠️ customer.test login failed'); failures++; }

  if (failures > 0) { console.error(`\n❌ FAIL — ${failures}`); process.exit(1); }
  console.log('\n✅ PASS — workqueue AI pre-review contract verified.');
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
