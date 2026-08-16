/**
 * 수정요청 #63 — 운영팀이 고객 PPN 환급신청을 처리(상태 변경)한다.
 * PATCH { id, status } — PENDING → PROCESSED / CANCELLED.
 * 운영팀(TAX_OPERATOR 계열) role 만 통과. admin 클라이언트로 갱신(고객 RLS 우회).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
const bodySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['PROCESSED', 'CANCELLED', 'PENDING']),
});

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { id, status } = parsed.data;
  const { error } = await getSupabaseAdmin()
    .from('ppn_refund_request')
    .update({
      status,
      processed_at: status === 'PROCESSED' ? new Date().toISOString() : null,
      processed_by: status === 'PROCESSED' ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
