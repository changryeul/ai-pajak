/**
 * New-customer → consultant assignment lifecycle (P1 온보딩 회귀).
 * test-unassigned-customers.ts 는 GET 계약만 보지만, 이 스크립트는 실제
 * 배정 라이프사이클을 끝-끝으로 검증한다:
 *  1. create a sentinel INDIVIDUAL customer (no consultant edge)
 *  2. supervisor GET /api/operator/unassigned-customers → sentinel present
 *  3. supervisor POST /api/customers/:id/assign → assign a JTC consultant
 *  4. GET unassigned again → sentinel gone (+ DB edge active)
 *  5. cleanup (customer_consultant + customer + auth user)
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/test-new-customer-assignment.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const BASE =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const EMAIL = 'assign.rehearsal.99010@example.com';
const PW = 'TestPassword123!';
let fail = 0;
const note = (s: string) => console.log(s);

async function token(email: string) {
  const { data, error } = await anon().auth.signInWithPassword({ email, password: PW });
  if (error || !data.session) throw new Error(`login ${email}: ${error?.message}`);
  return data.session.access_token;
}
async function cleanup() {
  const { data: rows } = await admin.from('customer').select('id,user_id').eq('email', EMAIL);
  for (const r of rows ?? []) {
    await admin.from('customer_consultant').delete().eq('customer_id', r.id);
    if (r.user_id) { await admin.from('user_roles').delete().eq('user_id', r.user_id); }
    await admin.from('customer').delete().eq('id', r.id);
    if (r.user_id) await admin.auth.admin.deleteUser(r.user_id);
  }
  if (rows?.length) note(`🧹 cleaned sentinel (${rows.length} row)`);
}

(async () => {
  await cleanup();
  try {
    // 1. create sentinel INDIVIDUAL (auth user + customer, no consultant edge)
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: EMAIL, password: PW, email_confirm: true,
    });
    if (cErr || !created.user) throw new Error(`createUser: ${cErr?.message}`);
    const uid = created.user.id;
    await admin.from('customer').insert({
      user_id: uid, customer_type: 'INDIVIDUAL', full_name: 'Assign Rehearsal',
      email: EMAIL, onboarding_step: 3,
    });
    await admin.from('user_roles').insert({ user_id: uid, role: 'CUSTOMER', is_active: true });
    const { data: custRow } = await admin.from('customer').select('id').eq('email', EMAIL).single();
    const customerId = custRow!.id;
    note(`✅ 1. sentinel INDIVIDUAL created (customer ${customerId})`);

    const supTok = await token('supervisor.test@aipajak.com');

    // 2. unassigned queue must contain the sentinel
    const q1 = await fetch(`${BASE}/api/operator/unassigned-customers`, { headers: { Authorization: `Bearer ${supTok}` } });
    const j1 = await q1.json();
    const inQueue1 = (j1.data?.customers || j1.data || []).some?.((c: { id: string }) => c.id === customerId)
      ?? JSON.stringify(j1).includes(customerId);
    if (inQueue1) note('✅ 2. 미배정 큐에 신규 고객 등장'); else { note(`✗ 2. 큐에 없음: ${JSON.stringify(j1).slice(0,200)}`); fail++; }

    // pick a JTC consultant to assign
    const { data: consultant } = await admin.from('consultant')
      .select('id, full_name, is_active').eq('is_active', true).limit(1).single();
    if (!consultant) { note('✗ no active consultant to assign'); fail++; throw new Error('no consultant'); }

    // 3. assign
    const a = await fetch(`${BASE}/api/customers/${customerId}/assign`, {
      method: 'POST', headers: { Authorization: `Bearer ${supTok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ consultantId: consultant.id }),
    });
    const aj = await a.json();
    if (a.status === 200 && aj.success) note(`✅ 3. 배정 성공 → ${consultant.full_name}`);
    else { note(`✗ 3. 배정 실패 ${a.status}: ${JSON.stringify(aj).slice(0,150)}`); fail++; }

    // 4. queue must no longer contain the sentinel
    const q2 = await fetch(`${BASE}/api/operator/unassigned-customers`, { headers: { Authorization: `Bearer ${supTok}` } });
    const j2 = await q2.json();
    const inQueue2 = JSON.stringify(j2).includes(customerId);
    if (!inQueue2) note('✅ 4. 배정 후 큐에서 사라짐'); else { note('✗ 4. 배정 후에도 큐에 남아있음'); fail++; }

    // verify DB edge
    const { data: edge } = await admin.from('customer_consultant')
      .select('is_active, assigned_by_user_id').eq('customer_id', customerId).eq('is_active', true).maybeSingle();
    note(`📊 DB: customer_consultant active=${!!edge}, assigned_by=${edge?.assigned_by_user_id ? 'set' : 'null'}`);
    if (!edge) fail++;
  } catch (e) {
    note(`✗ EXCEPTION: ${(e as Error).message}`); fail++;
  } finally {
    await cleanup();
  }
  console.log('\n' + '─'.repeat(46));
  console.log(fail === 0 ? '배정 리허설: ALL PASS' : `배정 리허설: ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
