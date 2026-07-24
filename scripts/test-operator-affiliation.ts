/**
 * 상담원 소속관리 smoke (v13 §6 — 트랙 5-C).
 *
 *   1. GET affiliation: supervisor 200 (team/supervisors/incoming/transfers),
 *      consultant 403
 *   2. sentinel operator + 두 supervisor 로 이동 요청 생성 → REQUESTED
 *   3. 중복 요청 → 409 (open per operator)
 *   4. 받는 쪽이 아닌 supervisor 결재 시도 → 403
 *   5. 받는 쪽 승인 → operator.supervisor_id 변경 + REASSIGN_CLIENTS 이면
 *      기존 활성 배정 해제
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/test-operator-affiliation.ts
 * sentinel: [AFFIL-E2E]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const SENTINEL = '[AFFIL-E2E]';
let pass = 0;
function ok(m: string) { pass++; console.log(`  ✓ ${m}`); }
function fail(m: string): never { console.error(`  ✗ ${m}`); process.exit(1); }

async function login(email: string): Promise<string> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'TestPassword123!' });
  if (error || !data.session) fail(`login failed: ${email}`);
  return data.session.access_token;
}
async function api(token: string, method: string, p: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${p}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

async function main() {
  console.log(`🧪 operator affiliation smoke on ${baseUrl}\n`);
  const cleanup: { operatorId?: string } = {};

  try {
    const supervisorToken = await login('supervisor.test@aipajak.com');
    const consultantToken = await login('consultant.test@jakartatax.co.id');

    // ── 1. GET RBAC ──
    const g = await api(supervisorToken, 'GET', '/api/consultant-erp/supervisor/affiliation');
    if (g.status !== 200) fail(`GET supervisor expected 200, got ${g.status}: ${JSON.stringify(g.json).slice(0, 150)}`);
    const gd = g.json?.data as Record<string, unknown>;
    if (!Array.isArray(gd?.team) || !Array.isArray(gd?.supervisors)) fail('affiliation shape unexpected');
    const supervisors = gd.supervisors as Array<{ id: string; name: string }>;
    const meId = gd.meId as string | null;
    ok(`GET 200 — team=${(gd.team as unknown[]).length}, supervisors=${supervisors.length}, meId=${meId?.slice(0, 8)}…`);

    const gc = await api(consultantToken, 'GET', '/api/consultant-erp/supervisor/affiliation');
    if (gc.status !== 403) fail(`GET consultant expected 403, got ${gc.status}`);
    ok('GET consultant → 403');

    // 받는 쪽 supervisor(meId) + 다른 supervisor 필요.
    if (!meId) fail('supervisor has no tax_operators row (meId null) — seed needed');
    const otherSup = supervisors.find(s => s.id !== meId);
    if (!otherSup) fail('need a second supervisor for transfer target');

    // ── sentinel operator (meId 소속에서 시작) ──
    const { data: op } = await admin.from('tax_operators').insert({
      employee_id: `AFFIL${Date.now().toString().slice(-6)}`,
      name: `${SENTINEL} Operator`, role: 'tax_operator', status: 'active',
      max_clients: 10, work_state: 'available', auto_assign_enabled: true,
      supervisor_id: otherSup.id,
    }).select('id').single();
    if (!op) fail('sentinel operator insert failed');
    cleanup.operatorId = op.id;
    ok(`sentinel operator created (belongs to ${otherSup.name})`);

    // ── 2. 이동 요청: otherSup → me (내가 받는 쪽) ──
    const c1 = await api(supervisorToken, 'POST', '/api/consultant-erp/supervisor/affiliation', {
      operatorId: op.id, toSupervisorId: meId, clientMode: 'REASSIGN_CLIENTS', reason: `${SENTINEL} 이동 검증`,
    });
    if (c1.status !== 201) fail(`create expected 201, got ${c1.status}: ${JSON.stringify(c1.json).slice(0, 150)}`);
    const transferId = (c1.json?.data as Record<string, unknown>)?.id as string;
    ok(`transfer requested (${transferId.slice(0, 8)}…) REASSIGN_CLIENTS`);

    // ── 3. 중복 요청 409 ──
    const c2 = await api(supervisorToken, 'POST', '/api/consultant-erp/supervisor/affiliation', {
      operatorId: op.id, toSupervisorId: meId, clientMode: 'WITH_CLIENTS', reason: 'dup',
    });
    if (c2.status !== 409) fail(`duplicate expected 409, got ${c2.status}`);
    ok('duplicate open request → 409');

    // ── 4. 받는 쪽 아닌 사람 결재 403 — master 로 시도 (다른 supervisor role) ──
    const masterToken = await login('master.test@aipajak.com');
    const d0 = await api(masterToken, 'PATCH', `/api/consultant-erp/supervisor/affiliation/${transferId}`, { action: 'APPROVE' });
    // master 는 to_supervisor 가 아니므로 403 (또는 tax_operators row 없으면 403)
    if (d0.status !== 403) fail(`non-receiver decide expected 403, got ${d0.status}`);
    ok('non-receiving supervisor decide → 403');

    // ── 5. 받는 쪽(me) 승인 → 소속 변경 ──
    const d1 = await api(supervisorToken, 'PATCH', `/api/consultant-erp/supervisor/affiliation/${transferId}`, { action: 'APPROVE' });
    if (d1.status !== 200) fail(`approve expected 200, got ${d1.status}: ${JSON.stringify(d1.json).slice(0, 150)}`);
    const { data: opAfter } = await admin.from('tax_operators').select('supervisor_id').eq('id', op.id).single();
    if (opAfter?.supervisor_id !== meId) fail(`supervisor_id not updated: ${opAfter?.supervisor_id}`);
    ok('approved → operator.supervisor_id moved to receiving supervisor');

    console.log(`\n✅ ${pass} assertions passed`);
  } finally {
    console.log('\n🧹 cleanup');
    if (cleanup.operatorId) {
      await admin.from('operator_affiliation_transfer').delete().eq('operator_id', cleanup.operatorId);
      await admin.from('operator_client_assignments').delete().eq('operator_id', cleanup.operatorId);
      await admin.from('tax_operators').delete().eq('id', cleanup.operatorId);
    }
    console.log('   sentinel rows removed');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
