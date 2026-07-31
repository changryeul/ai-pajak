/**
 * Auto-queue creation smoke test:
 *   customer.test writes a PPh23 transaction (sentinel period) → the workqueue
 *   djp_submission_queue row is auto-created (best-effort hook).
 * Run with: SEED_TARGET=prod npx tsx scripts/test-auto-queue-creation.ts
 * Sentinel period 2099-12. Sentinel prefix: [AUTOQ-E2E].
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
const PERIOD = '2099-12';
const SENTINEL_MONTH = 12, SENTINEL_YEAR = 2099;

let failures = 0;
function assert(c: unknown, l: string) { if (c) console.log(`   ✓ ${l}`); else { console.error(`   ❌ ${l}`); failures++; } }

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) { console.error(`   ❌ login failed ${email}: ${error?.message}`); return null; }
  return data.session.access_token;
}

async function cleanup(admin: ReturnType<typeof createClient>, customerId: string) {
  await admin.from('djp_submission_queue').delete()
    .eq('customer_id', customerId).eq('tax_type', 'PPh23')
    .eq('tax_period_month', SENTINEL_MONTH).eq('tax_period_year', SENTINEL_YEAR);
  await admin.from('pph23_transaction').delete()
    .eq('customer_id', customerId).eq('tax_period', PERIOD).like('description', '[AUTOQ-E2E]%');
}

async function main() {
  console.log('🧾 Auto-queue creation smoke test\n');
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: customer } = await admin.from('customer').select('id').eq('email', 'customer.test@example.com').maybeSingle();
  if (!customer) { console.error('❌ customer.test not found'); process.exit(1); }
  console.log(`📌 customer: ${customer.id}`);

  await cleanup(admin, customer.id);

  const token = await login('customer.test@example.com');
  if (!token) process.exit(1);

  console.log('━━ 1. customer writes a PPh23 transaction (sentinel period) ━━');
  const res = await fetch(`${baseUrl}/api/tax/pph23-transactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      customerId: customer.id, taxPeriod: PERIOD, transactionDate: `${PERIOD}-15`,
      description: '[AUTOQ-E2E] auto queue test', invoiceNumber: 'AUTOQ-001',
      grossAmount: 1_000_000, counterpartyName: 'PT Auto Queue', counterpartyNpwp: '01.234.567.8-901.000',
      useResolution: true,
    }),
  });
  const j = await res.json().catch(() => ({}));
  console.log(`   POST ${res.status} ${res.ok ? '' : JSON.stringify(j)}`);
  assert(res.ok, 'pph23 transaction created');

  // best-effort hook 완료 대기
  await new Promise(r => setTimeout(r, 1500));

  console.log('\n━━ 2. queue row auto-created ━━');
  const { data: q } = await admin.from('djp_submission_queue')
    .select('id, status, operator_id')
    .eq('customer_id', customer.id).eq('tax_type', 'PPh23')
    .eq('tax_period_month', SENTINEL_MONTH).eq('tax_period_year', SENTINEL_YEAR).maybeSingle();
  assert(!!q, 'djp_submission_queue row exists after write');
  assert((q as { status?: string } | null)?.status === 'PENDING', 'auto-created row is PENDING');

  console.log('\n🧹 Cleanup');
  await cleanup(admin, customer.id);
  console.log('   cleaned');

  if (failures > 0) { console.error(`\n❌ FAIL — ${failures}`); process.exit(1); }
  console.log('\n✅ PASS — auto-queue creation verified.');
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
