/**
 * JTC consultant → operator 마이그레이션 (결정 ①, 계획서 Phase 1-3).
 * 계획: docs/01-plan/features/jtc-consultant-to-operator-migration.md
 *
 * 두 그룹:
 *   PURGE (jakartatax 테스트 계정): Test Consultant / Test Tax Advisor
 *     → 데모 세션 삭제, active 배정 비활성, consultant row 삭제,
 *       user_roles CONSULTANT/TAX_ADVISOR 비활성, auth user 삭제.
 *   OPERATOR (gmail 실계정): CR Lee / Tommy Lee
 *     → tax_operators 배치(없으면 생성), active 배정 → operator_client_assignments
 *       이관, consultant row 은퇴(is_active=false, 삭제 금지),
 *       TAX_ADVISOR/CONSULTANT role 비활성 + TAX_OPERATOR 부여, CUSTOMER 는 유지.
 *
 * 안전:
 *   - 기본 DRY-RUN (계획만 출력). --apply 로 실제 반영.
 *   - 실행 전 대상 스냅샷을 scratch JSON 으로 남김(롤백 참조).
 *   - 과거 신고이력 consultant_id FK 는 건드리지 않음(무결성 보존).
 *
 * 실행:
 *   SEED_TARGET=prod npx tsx scripts/migrate-jtc-consultant-to-operator.ts
 *   SEED_TARGET=prod npx tsx scripts/migrate-jtc-consultant-to-operator.ts --apply
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const APPLY = process.argv.includes('--apply');

// 대상 정의 (Phase 0 실측 + 사용자 결정 기준).
// PURGE: 순수 테스트 계정 완전 폐기.
const PURGE = [
  { userId: 'ed3c1988-b252-4289-b6f6-c9cc9a109174', consultantId: 'e9d88904-dd85-4082-800e-698a529aa69d', email: 'consultant.test@jakartatax.co.id', name: 'Test Consultant' },
];
// STRIP: consultant 정체성만 제거, tax_operators supervisor 로 존속 (auth 유지).
const STRIP = [
  { userId: 'ebef877c-9bf2-4b76-9c6a-b5452fe28817', consultantId: '32c80ecd-36de-4d29-8484-5ef536f80af2', email: 'advisor.test@jakartatax.co.id', name: 'Test Tax Advisor (=Bob Johnson supervisor)' },
];
// OPERATOR: gmail 실계정 operator 이전.
const OPERATOR = [
  { userId: 'dee525ef-8a70-4834-9f83-5f573ec16745', consultantId: '6fdaa5c4-6390-4e4f-a7c9-52ea1de38a6f', email: 'crlee123@gmail.com', name: 'CR Lee' },
  { userId: '0abe006c-e983-4319-b85a-a57726836bf3', consultantId: '8b628a15-1995-40d0-9e35-8402c36a0271', email: 'iamtommylee66@gmail.com', name: 'Tommy Lee' },
];

const log: string[] = [];
function say(m: string) { log.push(m); console.log(m); }
async function q<T = unknown>(fn: () => PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await fn();
  if (error) throw new Error(JSON.stringify(error));
  return data;
}

async function snapshot() {
  const ids = [...PURGE, ...STRIP, ...OPERATOR].map(x => x.consultantId);
  const userIds = [...PURGE, ...STRIP, ...OPERATOR].map(x => x.userId);
  const inC = `(${ids.map(i => `'${i}'`).join(',')})`;
  const [cons, assign, sess, roles, ops] = await Promise.all([
    admin.from('consultant').select('*').in('id', ids),
    admin.from('customer_consultant').select('*').in('consultant_id', ids),
    admin.from('consultant_session').select('id, consultant_id, status').in('consultant_id', ids),
    admin.from('user_roles').select('*').in('user_id', userIds),
    admin.from('tax_operators').select('*').in('user_id', userIds),
  ]);
  void inC;
  const snap = { at: new Date().toISOString(), consultant: cons.data, customer_consultant: assign.data, consultant_session: sess.data, user_roles: roles.data, tax_operators: ops.data };
  const dir = process.env.SCRATCH_DIR || '/tmp';
  const p = path.join(dir, `jtc-migration-snapshot.json`);
  try { fs.writeFileSync(p, JSON.stringify(snap, null, 2)); say(`📸 snapshot → ${p}`); } catch { say('⚠ snapshot 파일 기록 실패 (계속)'); }
  return snap;
}

async function ensureOperator(o: typeof OPERATOR[number]): Promise<string> {
  const existing = await q(() => admin.from('tax_operators').select('id, name').eq('user_id', o.userId).maybeSingle());
  if (existing) { say(`  · ${o.name}: tax_operators 이미 존재 (${(existing as {name:string}).name}) → 재사용`); return (existing as {id:string}).id; }
  if (!APPLY) { say(`  · ${o.name}: tax_operators 신규 생성 예정`); return 'DRY'; }
  const made = await q(() => admin.from('tax_operators').insert({
    user_id: o.userId, name: o.name, email: o.email,
    employee_id: `JTC-${o.name.replace(/\W+/g, '').slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
    role: 'tax_operator', status: 'active', max_clients: 35, work_state: 'available', auto_assign_enabled: true,
  }).select('id').single());
  say(`  · ${o.name}: tax_operators 생성 (${(made as {id:string}).id.slice(0, 8)}…)`);
  return (made as {id:string}).id;
}

async function main() {
  say(`🔀 JTC consultant → operator 마이그레이션 — mode=${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);
  await snapshot();

  // ── 그룹 OPERATOR ──
  say('\n=== OPERATOR 이전 (gmail 실계정) ===');
  for (const o of OPERATOR) {
    say(`▶ ${o.name} (${o.email})`);
    const opId = await ensureOperator(o);
    // active 배정 이관
    const assigns = await q(() => admin.from('customer_consultant').select('id, customer_id').eq('consultant_id', o.consultantId).eq('is_active', true)) as Array<{id:string;customer_id:string}>;
    say(`  · active 고객배정 ${assigns.length}건 → operator_client_assignments 이관`);
    if (APPLY && opId !== 'DRY') {
      for (const a of assigns) {
        // 이미 operator 배정 있으면 skip
        const dup = await q(() => admin.from('operator_client_assignments').select('id').eq('customer_id', a.customer_id).is('unassigned_date', null).maybeSingle());
        if (!dup) {
          await q(() => admin.from('operator_client_assignments').insert({ operator_id: opId, customer_id: a.customer_id, assigned_date: new Date().toISOString(), assignment_reason: `migrated from consultant ${o.name}` }).select('id').single());
        }
        await admin.from('customer_consultant').update({ is_active: false, unassigned_at: new Date().toISOString() }).eq('id', a.id);
      }
      // role: TAX_ADVISOR/CONSULTANT 비활성, TAX_OPERATOR 부여(없으면), CUSTOMER 유지
      await admin.from('user_roles').update({ is_active: false }).eq('user_id', o.userId).in('role', ['CONSULTANT', 'TAX_ADVISOR']);
      const hasOp = await q(() => admin.from('user_roles').select('id').eq('user_id', o.userId).eq('role', 'TAX_OPERATOR').maybeSingle());
      if (!hasOp) await q(() => admin.from('user_roles').insert({ user_id: o.userId, role: 'TAX_OPERATOR', is_active: true }).select('id').single());
      // consultant row 은퇴 (삭제 금지)
      await admin.from('consultant').update({ is_active: false }).eq('id', o.consultantId);
      say(`  ✓ 이관 완료 (role 회수 + TAX_OPERATOR + consultant 은퇴)`);
    }
  }

  // ── 그룹 STRIP (consultant 정체성만 제거, supervisor 존속) ──
  say('\n=== STRIP (consultant 제거 + supervisor 존속) ===');
  for (const s of STRIP) {
    say(`▶ ${s.name} (${s.email})`);
    say(`  · consultant row 은퇴 + TAX_ADVISOR/CONSULTANT 회수 + TAX_OPERATOR_SUPERVISOR 부여 (auth·tax_operators 유지)`);
    if (APPLY) {
      await admin.from('user_roles').update({ is_active: false }).eq('user_id', s.userId).in('role', ['CONSULTANT', 'TAX_ADVISOR']);
      // 기존 (비)활성 supervisor row 가 있으면 활성화, 없으면 생성 — inactive row 를
      // 놓쳐 활성 role 0 이 되던 버그 방지.
      const supRow = await q(() => admin.from('user_roles').select('id, is_active').eq('user_id', s.userId).eq('role', 'TAX_OPERATOR_SUPERVISOR').maybeSingle()) as { id: string; is_active: boolean } | null;
      if (supRow) { if (!supRow.is_active) await admin.from('user_roles').update({ is_active: true }).eq('id', supRow.id); }
      else await q(() => admin.from('user_roles').insert({ user_id: s.userId, role: 'TAX_OPERATOR_SUPERVISOR', is_active: true }).select('id').single());
      await admin.from('tax_advisor').delete().eq('consultant_id', s.consultantId);
      await admin.from('consultant').update({ is_active: false }).eq('id', s.consultantId);
      say(`  ✓ STRIP 완료 (supervisor 로 존속)`);
    }
  }

  // ── 그룹 PURGE ──
  say('\n=== PURGE 폐기 (순수 테스트 계정) ===');
  for (const p2 of PURGE) {
    say(`▶ ${p2.name} (${p2.email})`);
    const sess = await q(() => admin.from('consultant_session').select('id').eq('consultant_id', p2.consultantId)) as Array<{id:string}>;
    const assigns = await q(() => admin.from('customer_consultant').select('id').eq('consultant_id', p2.consultantId)) as Array<{id:string}>;
    say(`  · 세션 ${sess.length} 삭제, 배정 ${assigns.length} 삭제, consultant/role/auth 삭제 예정`);
    if (APPLY) {
      // 세션 자식(calc/parse/approval/invoice/review) → 세션 삭제 시 CASCADE 가정. 명시 정리.
      for (const s of sess) {
        await admin.from('consultant_review_request').delete().eq('session_id', s.id);
        await admin.from('consultant_session_calc').delete().eq('session_id', s.id);
        await admin.from('consultant_session_approval').delete().eq('session_id', s.id);
        await admin.from('id_billing_issuance').delete().eq('session_id', s.id);
        await admin.from('id_billing_workbook_log').delete().eq('session_id', s.id);
      }
      await admin.from('consultant_session').delete().eq('consultant_id', p2.consultantId);
      await admin.from('customer_consultant').delete().eq('consultant_id', p2.consultantId);
      await admin.from('user_roles').update({ is_active: false }).eq('user_id', p2.userId).in('role', ['CONSULTANT', 'TAX_ADVISOR']);
      await admin.from('tax_advisor').delete().eq('consultant_id', p2.consultantId);
      await admin.from('consultant').delete().eq('id', p2.consultantId);
      await admin.auth.admin.deleteUser(p2.userId).catch((e) => say(`  ⚠ auth 삭제 실패: ${(e as Error).message}`));
      say(`  ✓ 폐기 완료`);
    }
  }

  say(`\n${APPLY ? '✅ APPLIED' : '🔎 DRY-RUN (변경 없음, --apply 로 실행)'}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
