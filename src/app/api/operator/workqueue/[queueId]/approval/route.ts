import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ queueId: string }> }) {
  const { queueId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
    return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data: q } = await admin
    .from('djp_submission_queue')
    .select('id, status, rejected_reason, approved_at, approval_notes, notes')
    .eq('id', queueId).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });

  return NextResponse.json({
    success: true,
    data: {
      status: q.status,
      rejectedReason: q.rejected_reason ?? null,
      approvedAt: q.approved_at ?? null,
      approvalNotes: q.approval_notes ?? null,
      requestNote: q.notes ?? null,
      canApprove: SUPERVISOR_ROLES.includes(roleRow.role),
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
