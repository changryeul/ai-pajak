import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ queueId: string }> }) {
  const { queueId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
    return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  }

  const { employeeId, message } = await req.json();
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: q } = await admin
    .from('djp_submission_queue').select('id, notes, status').eq('id', queueId).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });

  const stamp = new Date().toISOString();
  const noteLine = `[요청 ${stamp}]${employeeId ? ` emp=${employeeId}` : ''} ${message}`;
  const nextNotes = q.notes ? `${q.notes}\n${noteLine}` : noteLine;

  const { error } = await admin
    .from('djp_submission_queue')
    .update({ status: 'PENDING_DOCS', notes: nextNotes, updated_at: stamp })
    .eq('id', queueId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data: { queueId, status: 'PENDING_DOCS' } });
}
