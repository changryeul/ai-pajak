/**
 * 「상담원 백오피스」 5단계 워크플로우 회귀 스크립트.
 *
 * Phase 1~6 동안 늘려온 API의 응답 모양과 핵심 KPI가 깨지지 않았는지
 * service-role admin으로 EMP001의 실제 prod 데이터에 대해 검증한다.
 *
 * 실행:
 *   SEED_TARGET=prod npx tsx scripts/test-staff-workflow.ts
 *
 * 각 단계는 DB 직접 조회 + API 핸들러 로직과 동일한 변환을 수행해
 * /api/operator/* 엔드포인트가 200/유효 JSON을 돌려줄지 사전 검증.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'node:path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
config({ path: resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, key, { auth: { persistSession: false } });

const ACTIVE_STATUSES = [
  'PENDING', 'PENDING_DOCS', 'DATA_REVIEW', 'PENDING_APPROVAL',
  'APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING',
];

function ok(msg: string) { console.log(`  ✓ ${msg}`); }
function fail(msg: string): never { console.error(`  ✗ ${msg}`); process.exit(1); }

interface Op { id: string; employee_id: string; name: string }

async function findEmp(employee_id: string): Promise<Op> {
  const { data } = await admin.from('tax_operators').select('id, employee_id, name').eq('employee_id', employee_id).maybeSingle();
  if (!data) fail(`tax_operators row missing for ${employee_id}`);
  return data;
}

async function main() {
  console.log(`🧪 Staff workflow regression test on ${url}\n`);

  // Phase 1 — operator-staff routing.
  console.log('Phase 1 — sidebar routing & MyStatusCard');
  const me = await findEmp('EMP001');
  ok(`EMP001 resolved: ${me.id} (${me.name})`);
  const { count: activeCount } = await admin
    .from('djp_submission_queue').select('id', { count: 'exact', head: true })
    .eq('operator_id', me.id).in('status', ACTIVE_STATUSES);
  if ((activeCount ?? 0) < 3) fail(`EMP001 active cases too few (${activeCount}) — re-run seed-supervisor-demo`);
  ok(`Active case count: ${activeCount}`);

  // Phase 2 — /api/operator/my-cases 검증 (KPI 산정 로직 재현).
  console.log('\nPhase 2 — my-work feed');
  const { data: myCasesRaw } = await admin
    .from('djp_submission_queue')
    .select('id, case_code, customer_id, status, priority, ebilling_code, bpe_number, review_summary')
    .eq('operator_id', me.id).in('status', ACTIVE_STATUSES);
  const items = myCasesRaw ?? [];
  if (items.length < 3) fail(`my-work expects ≥ 3 items, got ${items.length}`);
  const kpi = {
    urgent: items.filter(i => i.priority === 'URGENT').length,
    needsReview: items.reduce((s, i) => s + (((i.review_summary ?? null) as { reviewRequired?: number } | null)?.reviewRequired ?? 0), 0),
    awaitingApproval: items.filter(i => i.status === 'PENDING_APPROVAL').length,
    coretaxReady: items.filter(i => ['APPROVED','EBILLING_GENERATED','PAYMENT_PENDING'].includes(i.status)).length,
  };
  ok(`KPI urgent=${kpi.urgent} needsReview=${kpi.needsReview} awaitingApproval=${kpi.awaitingApproval} coretaxReady=${kpi.coretaxReady}`);
  if (kpi.urgent < 1) fail('expected ≥ 1 URGENT case (C-002)');
  if (kpi.awaitingApproval < 1) fail('expected ≥ 1 PENDING_APPROVAL (C-002)');
  if (kpi.coretaxReady < 2) fail('expected ≥ 2 Coretax-ready cases (C-005, C-006)');

  // Phase 3 — review-detail.
  console.log('\nPhase 3 — review-case');
  const c002 = items.find(i => i.case_code === 'C-002');
  if (!c002) fail('C-002 missing — re-seed required');
  const rs002 = (c002.review_summary ?? null) as { items?: Array<unknown>; reviewRequired?: number } | null;
  if (!rs002 || (rs002.items?.length ?? 0) < 4) fail('C-002 review_summary should have 4 items');
  ok(`C-002 review_summary items=${rs002!.items!.length} reviewRequired=${rs002!.reviewRequired}`);

  // Phase 4 — final-review canSubmit gate.
  console.log('\nPhase 4 — approval-request');
  const c005 = items.find(i => i.case_code === 'C-005');
  if (!c005) fail('C-005 missing');
  const rs005 = (c005.review_summary ?? null) as { reviewRequired?: number } | null;
  ok(`C-005 reviewRequired=${rs005?.reviewRequired} (must be 0 to be 승인요청 가능)`);
  if ((rs005?.reviewRequired ?? -1) !== 0) fail('C-005 reviewRequired must be 0');

  // Phase 5 — coretax stages.
  console.log('\nPhase 5 — coretax');
  const c006 = items.find(i => i.case_code === 'C-006');
  if (!c006) fail('C-006 missing');
  if (c006.status !== 'EBILLING_GENERATED') fail(`C-006 must be EBILLING_GENERATED (got ${c006.status})`);
  if (!c006.ebilling_code) fail('C-006 must have ebilling_code');
  ok(`C-006 ebilling_code=${c006.ebilling_code} → NTPN 확인 단계 진입 가능`);

  // coretax_step_log 테이블 존재 여부.
  const { error: cstepErr } = await admin.from('coretax_step_log').select('id', { count: 'exact', head: true }).limit(1);
  if (cstepErr) fail(`coretax_step_log: ${cstepErr.message} (apply 20260507000002 migration to prod)`);
  ok('coretax_step_log table exists in prod');

  // Phase 6 — history payload 핵심 (case_audit_log).
  console.log('\nPhase 6 — history');
  const { error: auditErr } = await admin.from('case_audit_log').select('id', { count: 'exact', head: true }).limit(1);
  if (auditErr) fail(`case_audit_log: ${auditErr.message}`);
  ok('case_audit_log readable');

  // 같은 고객(C-001 / C-001-2025) 두 케이스가 회사별 이력에서 함께 묶이는지.
  const { data: hijau } = await admin.from('customer').select('id').eq('npwp', '010000020001000').maybeSingle();
  if (!hijau) fail('PT Hijau Lumut customer row missing');
  const { count: companyCaseCount } = await admin
    .from('djp_submission_queue').select('id', { count: 'exact', head: true })
    .eq('customer_id', hijau.id);
  if ((companyCaseCount ?? 0) < 2) fail(`PT Hijau Lumut should have ≥ 2 cases (got ${companyCaseCount})`);
  ok(`PT Hijau Lumut companyCases=${companyCaseCount}`);

  console.log('\n✅ All 6 phases pass on prod data.');
}

main().catch(err => { console.error(err); process.exit(1); });
