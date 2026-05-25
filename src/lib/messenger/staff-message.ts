/**
 * Supervisor ↔ Operator 내부 메신저 helpers.
 *
 * Pair-level conversation (no customer / case context). DB RLS 가 customer
 * 와 platform_admin 을 차단하므로 이 모듈은 zod 검증 + supervisor 의
 * 산하 operator list 조회 helper 만 제공한다.
 */

import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole } from '@/types/auth';

export const staffSendSchema = z.object({
  counterpartyUserId: z.string().uuid(),
  body: z.string().min(1).max(4000),
  attachmentUrl: z.string().url().max(2000).optional(),
});

export const staffListQuerySchema = z.object({
  counterpartyUserId: z.string().uuid(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const SUPERVISOR_ROLES: readonly UserRole[] = [
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
];

const OPERATOR_ROLES: readonly UserRole[] = [
  UserRole.TAX_OPERATOR,
  UserRole.TAX_OPERATOR_LEAD,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
];

export function isSupervisorRole(role: UserRole): boolean {
  return SUPERVISOR_ROLES.includes(role);
}

export function isOperatorRole(role: UserRole): boolean {
  return OPERATOR_ROLES.includes(role);
}

export interface StaffThreadRow {
  operator_user_id: string;
  employee_id: string | null;
  name: string;
  work_state: string | null;
  active_load: number;
  unread: number;
  last_message_at: string | null;
  last_message_body: string | null;
}

/**
 * Supervisor 시점: 본인 산하 operator 들의 thread summary.
 * tax_operators 테이블에서 모든 active operator 를 가져온 뒤, 각 operator
 * 와 본인 사이의 staff_internal_message 마지막 메시지 + unread count 를
 * client-side aggregation 으로 계산. operator 수가 10~30 명 수준이라
 * 별도 SQL view 없이 두 query 로 충분히 빠름.
 */
export async function buildSupervisorThreads(
  supervisorUserId: string,
): Promise<StaffThreadRow[]> {
  const admin = getSupabaseAdmin();

  // 1) operator-tier 역할을 가진 active user 들. 환경에 따라 tax_operators 가
  //    비어 있을 수 있으므로 (prod 의 일부 시드 누락) source-of-truth 는
  //    user_roles 로 잡고, tax_operators 는 메타 (employee_id / work_state /
  //    active_load) enrich 용으로만 사용.
  const { data: roleRows } = await admin
    .from('user_roles')
    .select('user_id, role')
    .eq('is_active', true)
    .in('role', [
      'TAX_OPERATOR',
      'TAX_OPERATOR_LEAD',
      'TAX_OPERATOR_SUPERVISOR',
      'TAX_OPERATOR_MASTER',
    ])
    .neq('user_id', supervisorUserId);

  const operatorUserIds = Array.from(
    new Set((roleRows ?? []).map((r) => r.user_id as string)),
  );
  if (operatorUserIds.length === 0) return [];

  // tax_operators 메타 (있으면) — 정렬 안정성 위해 name 기준 정렬은 메타 있는
  // row 우선, 그 다음 미시드 row 는 user_id 순으로.
  const { data: opMeta } = await admin
    .from('tax_operators')
    .select('user_id, employee_id, name, work_state, active_load')
    .in('user_id', operatorUserIds);
  const metaByUid = new Map(
    (opMeta ?? []).map((o) => [o.user_id as string, o]),
  );

  // 메타 없는 row 의 fallback name 은 user_id 의 short prefix.
  const opsBase = operatorUserIds.map((uid) => {
    const m = metaByUid.get(uid);
    return {
      user_id: uid,
      employee_id: (m?.employee_id as string | null) ?? null,
      name: (m?.name as string | null) ?? `User ${uid.slice(0, 8)}`,
      work_state: (m?.work_state as string | null) ?? 'offline',
      active_load: (m?.active_load as number | null) ?? 0,
    };
  });
  opsBase.sort((a, b) => a.name.localeCompare(b.name));
  const ops = opsBase;

  // 2) 같은 supervisor 와의 모든 staff_internal_message — last + unread
  const { data: msgs } = await admin
    .from('staff_internal_message')
    .select('operator_user_id, body, created_at, sender_user_id, read_at_by_supervisor')
    .eq('supervisor_user_id', supervisorUserId)
    .in('operator_user_id', operatorUserIds)
    .order('created_at', { ascending: false });

  const lastByOperator = new Map<
    string,
    { body: string; created_at: string }
  >();
  const unreadByOperator = new Map<string, number>();
  for (const m of msgs ?? []) {
    const opId = m.operator_user_id as string;
    if (!lastByOperator.has(opId)) {
      lastByOperator.set(opId, {
        body: m.body as string,
        created_at: m.created_at as string,
      });
    }
    if (
      m.sender_user_id !== supervisorUserId &&
      !m.read_at_by_supervisor
    ) {
      unreadByOperator.set(opId, (unreadByOperator.get(opId) ?? 0) + 1);
    }
  }

  return ops.map((o) => {
    const last = lastByOperator.get(o.user_id);
    return {
      operator_user_id: o.user_id,
      employee_id: o.employee_id,
      name: o.name,
      work_state: o.work_state,
      active_load: o.active_load,
      unread: unreadByOperator.get(o.user_id) ?? 0,
      last_message_at: last?.created_at ?? null,
      last_message_body: last?.body ?? null,
    };
  });
}

/**
 * Operator 시점: 본인과 대화한 supervisor 들의 thread summary.
 * 보통 직접 보고 라인이 1 명이지만 master 등 추가 conversation 가능.
 */
export async function buildOperatorThreads(
  operatorUserId: string,
): Promise<
  Array<{
    supervisor_user_id: string;
    name: string;
    unread: number;
    last_message_at: string | null;
    last_message_body: string | null;
  }>
> {
  const admin = getSupabaseAdmin();
  const { data: msgs } = await admin
    .from('staff_internal_message')
    .select(
      'supervisor_user_id, body, created_at, sender_user_id, read_at_by_operator',
    )
    .eq('operator_user_id', operatorUserId)
    .order('created_at', { ascending: false });

  const lastBySup = new Map<string, { body: string; created_at: string }>();
  const unreadBySup = new Map<string, number>();
  for (const m of msgs ?? []) {
    const supId = m.supervisor_user_id as string;
    if (!lastBySup.has(supId)) {
      lastBySup.set(supId, {
        body: m.body as string,
        created_at: m.created_at as string,
      });
    }
    if (
      m.sender_user_id !== operatorUserId &&
      !m.read_at_by_operator
    ) {
      unreadBySup.set(supId, (unreadBySup.get(supId) ?? 0) + 1);
    }
  }

  const supervisorIds = Array.from(lastBySup.keys());
  if (supervisorIds.length === 0) return [];

  const { data: ops } = await admin
    .from('tax_operators')
    .select('user_id, name')
    .in('user_id', supervisorIds);
  const nameByUid = new Map(
    (ops ?? []).map((o) => [o.user_id as string, o.name as string]),
  );

  return supervisorIds.map((supId) => {
    const last = lastBySup.get(supId)!;
    return {
      supervisor_user_id: supId,
      name: nameByUid.get(supId) ?? '—',
      unread: unreadBySup.get(supId) ?? 0,
      last_message_at: last.created_at,
      last_message_body: last.body,
    };
  });
}
