import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

const ACTIVE_STATUSES = [
  'PENDING', 'PENDING_DOCS', 'DATA_REVIEW', 'PENDING_APPROVAL',
  'APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING',
];

/**
 * GET /api/operator/me
 *
 * 상담원 본인 메타데이터 + 자기 큐 통계.
 * MyStatusCard / 5단계 stepper에서 사용.
 */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: roles } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true);
  const role = roles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });

  const { data: op } = await admin
    .from('tax_operators')
    .select('id, employee_id, name, work_state, auto_assign_enabled, max_managed, last_login_at, status')
    .eq('user_id', user.id)
    .maybeSingle();

  // 자기 활성 케이스 수.
  let activeCount = 0;
  if (op?.id) {
    const { count } = await admin
      .from('djp_submission_queue')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', op.id)
      .in('status', ACTIVE_STATUSES);
    activeCount = count ?? 0;
  }

  return NextResponse.json({
    success: true,
    data: {
      role,
      operator: op,
      activeCount,
      lastLoginAt: user.last_sign_in_at ?? null,
    },
  });
}
