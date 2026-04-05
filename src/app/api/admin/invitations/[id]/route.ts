import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';

/**
 * DELETE /api/admin/invitations/[id]
 * Cancel a pending invitation (soft delete via cancelled_at).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['TAX_ADVISOR_JTC', 'TAX_OPERATOR_SUPERVISOR'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = getSupabaseAdmin();

    // Supervisors can only cancel their own invitations
    let query = admin.from('staff_invitation').update({ cancelled_at: new Date().toISOString() }).eq('id', id);
    if (role === 'TAX_OPERATOR_SUPERVISOR') {
      query = query.eq('invited_by', user.id);
    }

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, message: '초대가 취소되었습니다' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
