import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

/**
 * Employee master sync (2026-06-21 정책 변경).
 *
 * 매월 PPh21 작업 (=`monthly_payslip` 행이 status='SUBMITTED' 로 flag) 가 끝난 뒤,
 * 사용자가 이 endpoint 를 호출하면:
 *
 *   - 이전 달까지 (현재 달 미만) 의 SUBMITTED payslip 중 employee_name 기준으로
 *     집계하여 employee_payroll 마스터를 갱신.
 *   - 마스터에 직원이 없으면 insert (식별 정보 + 최근 payslip 의 급여 정보).
 *   - 있으면 급여 부분만 update (gross_salary, position_allowance, other_allowances,
 *     jht_employee, jp_employee, other_deductions). 다른 HR 필드 (status, address,
 *     NPWP/PTKP 등) 는 손대지 않음 — 사용자가 직접 수정.
 *   - 마지막 sync 된 period 를 `customer.employee_synced_through_period` 에 기록.
 *
 * GET — 현재 sync 가능 상태 조회 (활성 버튼 여부 판단용)
 * POST — sync 실행
 */

interface SyncStatus {
  syncedThrough: string | null;     // 마지막 sync 완료 period (YYYY-MM)
  pendingThrough: string | null;    // 처리 가능한 가장 최근 period (이전 달)
  hasPending: boolean;              // sync 버튼 활성 여부
}

function currentPeriod(): string {
  // 2026-06-21 (사용자 결정): "현재 달도 포함해서 동기화" — 사용자가 그달
  // 작업을 SUBMITTED 한 즉시 sync 가능하도록.
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getSyncStatus(customerId: string): Promise<SyncStatus> {
  const admin = getSupabaseAdmin();
  const { data: c } = await admin
    .from('customer')
    .select('employee_synced_through_period')
    .eq('id', customerId)
    .single();
  const syncedThrough = (c?.employee_synced_through_period as string | null) ?? null;
  const pendingThrough = currentPeriod();
  const hasPending = !syncedThrough || syncedThrough < pendingThrough;
  return { syncedThrough, pendingThrough, hasPending };
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const customerId = url.searchParams.get('customerId');
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });
  const status = await getSyncStatus(customerId);
  return NextResponse.json({ success: true, ...status });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const { customerId } = await req.json();
    if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

    const status = await getSyncStatus(customerId);
    if (!status.hasPending) {
      return NextResponse.json({ error: 'Already synced through previous month' }, { status: 409 });
    }
    const admin = getSupabaseAdmin();
    const through = status.pendingThrough!;
    const since = status.syncedThrough ?? '0000-00';

    // 1) sync 범위 내 SUBMITTED payslip (이전 달까지)
    const { data: payslips } = await admin
      .from('monthly_payslip')
      .select('employee_name, employee_npwp, ptkp_category, base_salary, position_allowance, other_allowances, jht_employee, jp_employee, other_deductions, period')
      .eq('customer_id', customerId)
      .eq('status', 'SUBMITTED')
      .gt('period', since)
      .lte('period', through)
      .order('period', { ascending: false });

    if (!payslips || payslips.length === 0) {
      // sync 할 데이터 없음 — through 만 기록하고 종료
      await admin
        .from('customer')
        .update({ employee_synced_through_period: through })
        .eq('id', customerId);
      return NextResponse.json({ success: true, added: 0, updated: 0, through });
    }

    // 2) employee_name 기준 그룹핑 — 가장 최근 period 의 값을 사용
    const byName = new Map<string, typeof payslips[number]>();
    for (const ps of payslips) {
      if (!ps.employee_name) continue;
      if (!byName.has(ps.employee_name)) byName.set(ps.employee_name, ps);
    }

    // 3) 기존 마스터 직원 조회
    const names = Array.from(byName.keys());
    const { data: existing } = await admin
      .from('employee_payroll')
      .select('id, employee_name')
      .eq('customer_id', customerId)
      .in('employee_name', names);
    const existingByName = new Map((existing ?? []).map(e => [e.employee_name, e.id] as const));

    let added = 0;
    let updated = 0;

    for (const [name, ps] of byName.entries()) {
      const salaryFields = {
        gross_salary: Number(ps.base_salary || 0),
        position_allowance: Number(ps.position_allowance || 0),
        other_allowances: Number(ps.other_allowances || 0),
        jht_employee: Number(ps.jht_employee || 0),
        jp_employee: Number(ps.jp_employee || 0),
        other_deductions: Number(ps.other_deductions || 0),
      };
      const existingId = existingByName.get(name);
      if (existingId) {
        // 기존 직원 — 급여 부분만 갱신, 다른 HR 필드는 손대지 않음
        const { error } = await admin
          .from('employee_payroll')
          .update(salaryFields)
          .eq('id', existingId);
        if (error) {
          loggers.api.warn({ name, err: error.message }, 'Employee sync update error');
        } else {
          updated++;
        }
      } else {
        // 신규 — 식별 정보 + 급여 정보만. 다른 HR 필드는 null (사용자가 직접 채움).
        const { error } = await admin
          .from('employee_payroll')
          .insert({
            customer_id: customerId,
            employee_name: name,
            employee_npwp: ps.employee_npwp || null,
            ptkp_category: ps.ptkp_category || 'TK0',
            ...salaryFields,
            worker_type: 'REGULAR',
            is_active: true,
          });
        if (error) {
          loggers.api.warn({ name, err: error.message }, 'Employee sync insert error');
        } else {
          added++;
        }
      }
    }

    // 4) sync 완료 period 기록 + payslip 의 employee_id 채우기 (옵션)
    await admin
      .from('customer')
      .update({ employee_synced_through_period: through })
      .eq('id', customerId);

    // payslip 의 employee_id 갱신 (이름 매칭) — best-effort
    const { data: allEmp } = await admin
      .from('employee_payroll')
      .select('id, employee_name')
      .eq('customer_id', customerId)
      .in('employee_name', names);
    for (const e of allEmp ?? []) {
      await admin
        .from('monthly_payslip')
        .update({ employee_id: e.id })
        .eq('customer_id', customerId)
        .eq('employee_name', e.employee_name)
        .is('employee_id', null)
        .lte('period', through);
    }

    loggers.api.info({ customerId, added, updated, through }, 'Employee sync completed');
    return NextResponse.json({ success: true, added, updated, through });
  } catch (error) {
    loggers.api.error({ err: error }, 'Employee sync POST error');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sync failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, withAudit('EMPLOYEE_SYNC'))(request as RequestWithSession, handlePost);
}
