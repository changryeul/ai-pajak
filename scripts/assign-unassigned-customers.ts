/**
 * P1 후속: prod 에 대기 중인 미배정 고객을 실제로 배정하는 실행 스크립트.
 *
 * 두 모드:
 *   npx tsx scripts/assign-unassigned-customers.ts           # dry-run (기본)
 *   npx tsx scripts/assign-unassigned-customers.ts --apply   # 실 실행
 *
 * 로직:
 *   1. GET /api/operator/unassigned-customers (SUPERVISOR 세션) — 대기 고객 로드
 *   2. JTC 소속 활성 consultant + 현재 workload (customer_consultant.is_active=true) 조회
 *   3. 라운드로빈 (workload 오름차순) 로 배정안 생성
 *   4. dry-run: 배정안 표만 출력
 *      --apply: 각 배정을 POST /api/customers/[id]/assign 로 실행
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.production.local' });

const BASE_URL = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SUPERVISOR = { email: 'supervisor.test@aipajak.com', password: 'TestPassword123!' };
const APPLY = process.argv.includes('--apply');
// 배정 대상에서 제외할 consultant 이메일. 테스트 계정 + 사용자 본인 계정.
const EXCLUDE_CONSULTANT_EMAILS = new Set([
  'advisor.test@jakartatax.co.id',
  'consultant.test@jakartatax.co.id',
  'crlee123@gmail.com',
]);

interface UnassignedCustomer {
  id: string;
  customer_type: 'INDIVIDUAL' | 'COMPANY';
  full_name: string;
  company_name: string | null;
  npwp: string | null;
  email: string;
  created_at: string;
}

interface ConsultantWithLoad {
  id: string;
  full_name: string;
  email: string;
  tax_partner_id: string;
  current_load: number;
}

async function signIn(email: string, password: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);
  return data.session.access_token;
}

async function main() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false } });

  const token = await signIn(SUPERVISOR.email, SUPERVISOR.password);

  // 1. 미배정 고객
  const listRes = await fetch(`${BASE_URL}/api/operator/unassigned-customers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listJson = await listRes.json();
  const unassigned: UnassignedCustomer[] = listJson?.data?.customers || [];

  console.log(`\n[unassigned] ${unassigned.length} customer(s) awaiting assignment\n`);

  if (unassigned.length === 0) {
    console.log('nothing to do');
    return;
  }

  // 2. JTC tax_partner 찾기
  const { data: jtcPartner } = await admin
    .from('tax_partner')
    .select('id, name')
    .eq('partner_type', 'JTC')
    .maybeSingle();

  if (!jtcPartner) throw new Error('JTC tax_partner not found');

  // 3. JTC 컨설턴트 + workload
  const { data: consultants } = await admin
    .from('consultant')
    .select('id, full_name, email, tax_partner_id')
    .eq('tax_partner_id', jtcPartner.id)
    .eq('is_active', true);

  const consultantIds = (consultants || []).map(c => c.id);
  const { data: loadRows } = await admin
    .from('customer_consultant')
    .select('consultant_id')
    .eq('is_active', true)
    .in('consultant_id', consultantIds);

  const loadMap = new Map<string, number>();
  (loadRows || []).forEach(r => loadMap.set(r.consultant_id, (loadMap.get(r.consultant_id) || 0) + 1));

  const roster: ConsultantWithLoad[] = (consultants || [])
    .filter(c => !EXCLUDE_CONSULTANT_EMAILS.has(c.email))
    .map(c => ({
      ...c,
      current_load: loadMap.get(c.id) || 0,
    }));

  if (roster.length === 0) {
    console.log('❌ No active JTC consultants — cannot assign');
    return;
  }

  console.log(`[roster] JTC active consultants: ${roster.length}`);
  roster
    .sort((a, b) => a.current_load - b.current_load || a.full_name.localeCompare(b.full_name))
    .forEach(c => console.log(`   ${c.full_name.padEnd(30)} load=${c.current_load}  <${c.email}>`));

  // 4. 라운드로빈 배정안: 가장 적은 load 순으로 순회
  const plan: { customer: UnassignedCustomer; consultant: ConsultantWithLoad }[] = [];
  const workingLoad = new Map(roster.map(c => [c.id, c.current_load]));

  for (const customer of unassigned) {
    const sorted = roster
      .slice()
      .sort((a, b) => (workingLoad.get(a.id)! - workingLoad.get(b.id)!) || a.full_name.localeCompare(b.full_name));
    const pick = sorted[0];
    plan.push({ customer, consultant: pick });
    workingLoad.set(pick.id, workingLoad.get(pick.id)! + 1);
  }

  console.log(`\n[plan] round-robin (workload-balanced):\n`);
  const perConsultant = new Map<string, number>();
  plan.forEach(({ customer, consultant }) => {
    const label = customer.company_name || customer.full_name;
    const type = customer.customer_type === 'COMPANY' ? '법인' : '개인';
    console.log(
      `   ${type} · ${label.padEnd(28)} → ${consultant.full_name}`,
    );
    perConsultant.set(consultant.full_name, (perConsultant.get(consultant.full_name) || 0) + 1);
  });

  console.log(`\n[summary] per-consultant intake:`);
  for (const [name, n] of perConsultant.entries()) {
    console.log(`   ${name.padEnd(30)} +${n}`);
  }

  if (!APPLY) {
    console.log(`\n(dry-run) rerun with --apply to execute ${plan.length} assignments`);
    return;
  }

  console.log(`\n[apply] executing ${plan.length} assignments…`);
  let ok = 0;
  let fail = 0;
  for (const { customer, consultant } of plan) {
    const res = await fetch(`${BASE_URL}/api/customers/${customer.id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ consultantId: consultant.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      ok++;
      console.log(`   ✅ ${customer.company_name || customer.full_name} → ${consultant.full_name}`);
    } else {
      fail++;
      console.log(`   ❌ ${customer.company_name || customer.full_name} status=${res.status} err=${json.error}`);
    }
  }
  console.log(`\n[done] ok=${ok} fail=${fail}`);
}

main().catch(err => {
  console.error('❌ crashed:', err);
  process.exit(1);
});
