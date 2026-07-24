/**
 * 실고객 온보딩 골든패스 — 회원가입 → 접수 즉시 자동배정 (v13 §5, 트랙 4/5 후속).
 *
 * 실제 /api/auth/signup 을 호출해 신규 INDIVIDUAL 고객을 만들고:
 *   1. customer 행 생성 확인
 *   2. 접수 즉시 자동배정 훅이 operator_client_assignments 에 배정했는지
 *      (또는 전원 만석/오프라인이면 operator_assignment_log 에 overflow 기록)
 *   3. operator_assignment_log triggered_by=AUTO 감사 기록
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/test-signup-auto-assign.ts
 * sentinel: 이메일 prefix signup-autoassign-e2e — 종료 시 auth+customer 삭제.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let pass = 0;
function ok(m: string) { pass++; console.log(`  ✓ ${m}`); }
function fail(m: string): never { console.error(`  ✗ ${m}`); process.exit(1); }

async function main() {
  console.log(`🧪 signup → auto-assignment golden path on ${baseUrl}\n`);
  const email = `signup-autoassign-e2e-${Date.now()}@example.com`;
  const cleanup: { userId?: string; customerId?: string } = {};

  try {
    // ── 1. 회원가입 ──
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, password: 'TestPassword123!', fullName: '[SIGNUP-AUTOASSIGN-E2E]',
        accountType: 'INDIVIDUAL', phone: '08120000000',
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) fail(`signup expected 2xx, got ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
    ok(`signup succeeded (${res.status})`);

    // ── 2. customer 행 확인 ──
    const { data: customer } = await admin
      .from('customer').select('id, user_id, customer_type').eq('email', email).maybeSingle();
    if (!customer) fail('customer row not created');
    cleanup.customerId = customer.id;
    cleanup.userId = customer.user_id ?? undefined;
    if (customer.customer_type !== 'INDIVIDUAL') fail(`expected INDIVIDUAL, got ${customer.customer_type}`);
    ok(`customer row created (${customer.id.slice(0, 8)}…, INDIVIDUAL)`);

    // ── 3. 자동배정 감사 로그 (AUTO) ──
    const { data: logRow } = await admin
      .from('operator_assignment_log')
      .select('method, operator_id, triggered_by, candidates_considered')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!logRow) fail('no operator_assignment_log — 자동배정 훅이 실행되지 않음');
    if (logRow.triggered_by !== 'AUTO') fail(`triggered_by expected AUTO, got ${logRow.triggered_by}`);
    ok(`auto-assignment log recorded — method=${logRow.method}, triggered_by=AUTO`);

    // ── 4. 배정 결과 (배정 or overflow) ──
    const { data: assignment } = await admin
      .from('operator_client_assignments')
      .select('operator_id, is_active, assignment_reason')
      .eq('customer_id', customer.id)
      .eq('is_active', true)
      .maybeSingle();
    if (assignment) {
      if (!assignment.assignment_reason?.startsWith('auto:')) fail(`assignment_reason not auto: ${assignment.assignment_reason}`);
      ok(`assigned to operator ${assignment.operator_id?.slice(0, 8)}… on signup (${assignment.assignment_reason})`);
    } else {
      if (logRow.method !== 'overflow') fail(`no assignment but method=${logRow.method}`);
      ok('no eligible operator → overflow (미배정 큐 fallback), still audited');
    }

    console.log(`\n✅ ${pass} assertions passed`);
  } finally {
    console.log('\n🧹 cleanup');
    if (cleanup.customerId) {
      await admin.from('operator_assignment_log').delete().eq('customer_id', cleanup.customerId);
      await admin.from('operator_client_assignments').delete().eq('customer_id', cleanup.customerId);
      await admin.from('user_roles').delete().eq('user_id', cleanup.userId ?? '00000000-0000-0000-0000-000000000000');
      await admin.from('customer').delete().eq('id', cleanup.customerId);
    }
    if (cleanup.userId) {
      await admin.auth.admin.deleteUser(cleanup.userId).catch(() => {});
    }
    console.log('   sentinel user + customer removed');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
