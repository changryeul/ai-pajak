/**
 * Verify POST /api/operator/spt-masa/create — operator-initiated SPT Masa.
 *
 *   1. CONSULTANT POST → 403 (operator-only)
 *   2. CUSTOMER  POST → 403
 *   3. OPERATOR  POST → 200 + filingId + actor.consultantName
 *   4. tax_filing row exists with status=DRAFT (consultant_id null for JTC operator-managed; 결정 ①)
 *   5. operator second POST (same period) → updates existing row (no dup)
 *   6. cleanup
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-operator-spt-masa-create.ts
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`✗ ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const BASE_URL =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000011';
const PERIOD = '2099-05';

async function login(email: string, password: string): Promise<string> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`login failed: ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function post(token: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/api/operator/spt-masa/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  let pass = 0, fail = 0;

  // Pre-cleanup
  await sbAdmin.from('tax_filing').delete()
    .eq('customer_id', CUSTOMER_ID).eq('tax_type', 'PPh23').eq('tax_period', PERIOD);

  // 1. CONSULTANT POST → 403
  const consultantToken = await login('external.consultant@mitrapajak.com', 'TestPassword123!');
  const r1 = await post(consultantToken, { customerId: CUSTOMER_ID, taxType: 'PPh23', period: PERIOD });
  if (r1.status === 403) { console.log(`✅ 1. CONSULTANT POST → 403`); pass++; }
  else { console.error(`✗ 1. CONSULTANT POST → status=${r1.status}`); fail++; }

  // 2. CUSTOMER POST → 403
  const customerToken = await login('company.test@example.com', 'TestPassword123!');
  const r2 = await post(customerToken, { customerId: CUSTOMER_ID, taxType: 'PPh23', period: PERIOD });
  if (r2.status === 403) { console.log(`✅ 2. CUSTOMER POST → 403`); pass++; }
  else { console.error(`✗ 2. CUSTOMER POST → status=${r2.status}`); fail++; }

  // 3. OPERATOR POST → 200 + filingId + operator recorded as actor.
  //    (결정 ①) JTC 고객(...011)은 assigned consultant 가 없으므로 operator 가 actor.
  //    consultant_id 는 null, actor.initiatorUserId 에 operator 가 기록된다.
  const operatorToken = await login('operator.test@aipajak.com', 'TestPassword123!');
  const r3 = await post(operatorToken, { customerId: CUSTOMER_ID, taxType: 'PPh23', period: PERIOD });
  if (r3.status === 200 && r3.json.success && r3.json.filingId && r3.json.actor?.initiatorUserId) {
    console.log(`✅ 3. OPERATOR POST → filing ${String(r3.json.filingId).slice(0, 8)} (actor initiator: ${String(r3.json.actor.initiatorUserId).slice(0, 8)}, consultant: ${r3.json.actor.consultantName ?? 'null (operator-managed)'})`);
    pass++;
  } else {
    console.error(`✗ 3. OPERATOR POST → status=${r3.status}`, r3.json);
    fail++;
  }

  // 4. tax_filing DRAFT row exists (consultant_id null for JTC operator-managed customer).
  const { data: rows } = await sbAdmin.from('tax_filing')
    .select('id, consultant_id, status')
    .eq('customer_id', CUSTOMER_ID).eq('tax_type', 'PPh23').eq('tax_period', PERIOD);
  if (rows && rows.length === 1 && rows[0].status === 'DRAFT') {
    console.log(`✅ 4. tax_filing row DRAFT (consultant_id=${rows[0].consultant_id ?? 'null, operator actor'})`);
    pass++;
  } else {
    console.error(`✗ 4. expected 1 DRAFT row, got`, rows);
    fail++;
  }

  // 5. OPERATOR second POST → same row updated, no dup
  const r5 = await post(operatorToken, { customerId: CUSTOMER_ID, taxType: 'PPh23', period: PERIOD });
  const { data: rows2 } = await sbAdmin.from('tax_filing')
    .select('id').eq('customer_id', CUSTOMER_ID).eq('tax_type', 'PPh23').eq('tax_period', PERIOD);
  if (r5.status === 200 && rows2 && rows2.length === 1) {
    console.log(`✅ 5. second POST upserted (still 1 row)`);
    pass++;
  } else {
    console.error(`✗ 5. expected upsert, got ${rows2?.length} rows`);
    fail++;
  }

  // 6. Cleanup
  await sbAdmin.from('tax_filing').delete()
    .eq('customer_id', CUSTOMER_ID).eq('tax_type', 'PPh23').eq('tax_period', PERIOD);
  console.log(`✅ 6. cleanup`); pass++;

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
