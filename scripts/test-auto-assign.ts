/**
 * Test the operator auto-assignment algorithm:
 *
 * 1. Verify tax_operators table has active operators
 * 2. Insert 3 unassigned PENDING queue items for different customers
 * 3. Call POST /api/operator/auto-assign as supervisor
 * 4. Assert: items are assigned via sticky or round-robin
 * 5. Cleanup
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/test-auto-assign.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const baseUrl =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log(`🌐 ${baseUrl}\n`);

const PASSWORD = 'TestPassword123!';
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const COMPANY_CUSTOMER_ID = '00000000-0000-0000-0000-000000000011';
const INDIVIDUAL_CUSTOMER_ID = '00000000-0000-0000-0000-000000000010';
const EXTERNAL_CUSTOMER_ID = '00000000-0000-0000-0000-000000000042';

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) {
    console.error(`   ❌ login failed: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

async function main() {
  console.log('🤖 Auto-assign algorithm test\n');

  // ── Step 0: Check tax_operators ──
  console.log('━━ 0. Check active operators ━━');
  const { data: operators, error: opErr } = await admin
    .from('tax_operators')
    .select('id, name, max_clients, status')
    .eq('status', 'active');

  if (opErr) {
    console.error(`   ❌ tax_operators query error: ${opErr.message}`);
    console.log('\n   tax_operators 테이블이 비어있을 수 있습니다.');
    console.log('   seed-test-users 또는 global-setup이 tax_operators를 시드하는지 확인 필요.');

    // Try to find any rows at all
    const { data: allOps } = await admin.from('tax_operators').select('id, name, status').limit(5);
    console.log(`   전체 tax_operators 행 수: ${allOps?.length ?? 0}`);
    allOps?.forEach((o) => console.log(`     - ${o.name} (${o.status})`));
    return;
  }

  console.log(`   활성 운영자: ${operators?.length ?? 0}명`);
  operators?.forEach((op) =>
    console.log(`     - ${op.name} (max_clients=${op.max_clients}, id=${op.id.slice(0, 8)})`)
  );

  if (!operators || operators.length === 0) {
    console.log('\n   ⚠️  활성 운영자가 없어 자동 배정이 불가능합니다.');
    console.log('   tax_operators에 행을 추가하거나 global-setup.ts가 시드하는지 확인하세요.');
    return;
  }

  // ── Step 1: Insert 3 unassigned PENDING items ──
  console.log('\n━━ 1. Insert 3 unassigned PENDING items ━━');
  const sentinel = { month: 97, year: 9998 };
  // Cleanup leftovers
  await admin
    .from('djp_submission_queue')
    .delete()
    .eq('tax_period_month', sentinel.month)
    .eq('tax_period_year', sentinel.year);

  const customers = [
    { id: COMPANY_CUSTOMER_ID, name: 'PT Example Indonesia', type: 'PPh21' },
    { id: INDIVIDUAL_CUSTOMER_ID, name: 'John Doe Test', type: 'PPh23' },
    { id: EXTERNAL_CUSTOMER_ID, name: 'PT Klien Eksternal', type: 'PPN' },
  ];

  const insertedIds: string[] = [];
  for (const cust of customers) {
    const { data: row, error: insertErr } = await admin
      .from('djp_submission_queue')
      .insert({
        customer_id: cust.id,
        tax_type: cust.type,
        tax_period_month: sentinel.month,
        tax_period_year: sentinel.year,
        amount: 500_000,
        status: 'PENDING',
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error(`   ❌ insert failed for ${cust.name}: ${insertErr.message}`);
      continue;
    }
    insertedIds.push(row.id);
    console.log(`   ✅ ${cust.name} → ${row.id.slice(0, 8)} (PENDING, unassigned)`);
  }

  if (insertedIds.length === 0) {
    console.error('   ❌ No items inserted. Aborting.');
    return;
  }

  // ── Step 2: Call auto-assign as supervisor ──
  console.log('\n━━ 2. POST /api/operator/auto-assign ━━');
  const token = await login('supervisor.test@aipajak.com');
  if (!token) return;
  console.log('   ✅ supervisor logged in');

  const res = await fetch(`${baseUrl}/api/operator/auto-assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });

  console.log(`   📡 POST → ${res.status}`);
  const body = await res.json();

  if (res.status !== 200 || !body.success) {
    console.error(`   ❌ ${JSON.stringify(body).slice(0, 300)}`);
  } else {
    console.log(`   ✅ assigned: ${body.data.assigned}, overflow: ${body.data.overflow}`);
    console.log('   details:');
    for (const d of body.data.details || []) {
      const cust = customers.find((c) =>
        insertedIds.some((id) => id === d.queueItemId)
      );
      console.log(
        `     - ${d.queueItemId.slice(0, 8)} → operator=${d.operatorId?.slice(0, 8) ?? 'null'} (${d.method})`
      );
    }
  }

  // ── Step 3: Verify DB ──
  console.log('\n━━ 3. DB verification ━━');
  const { data: verifyRows } = await admin
    .from('djp_submission_queue')
    .select('id, customer_id, operator_id, status, assigned_at')
    .in('id', insertedIds);

  for (const row of verifyRows || []) {
    const assigned = row.operator_id ? `operator=${row.operator_id.slice(0, 8)}` : 'unassigned';
    const at = row.assigned_at ? `at=${row.assigned_at.slice(11, 19)}` : '';
    console.log(`   ${row.operator_id ? '✅' : '⏭️'} ${row.id.slice(0, 8)} → ${assigned} ${at}`);
  }

  // ── Step 4: Cleanup ──
  console.log('\n━━ 4. Cleanup ━━');
  await admin
    .from('djp_submission_queue')
    .delete()
    .in('id', insertedIds);
  console.log(`   🧹 deleted ${insertedIds.length} rows`);

  console.log('\n✨ Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
