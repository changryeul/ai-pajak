import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

async function getSupervisor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = getSupabaseAdmin();
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true);
  const role = roles?.map(r => r.role).find(r => SUPERVISOR_ROLES.includes(r));
  if (!role) return { error: NextResponse.json({ error: 'Supervisor access required' }, { status: 403 }) };
  return { admin, user };
}

/**
 * PUT /api/operator/evaluation-settings
 * Updates the singleton evaluation settings row (weights + incentive policy).
 */
export async function PUT(req: NextRequest) {
  const auth = await getSupervisor();
  if ('error' in auth) return auth.error;
  const { admin, user } = auth;

  const body = await req.json();
  const patch: Record<string, unknown> = { updated_by: user.id, updated_at: new Date().toISOString() };
  if (body.weights) patch.weights = body.weights;
  if (body.incentive) patch.incentive = body.incentive;

  const { error } = await admin.from('operator_evaluation_settings').update(patch).eq('id', 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
