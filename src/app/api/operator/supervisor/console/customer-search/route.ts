/**
 * GET /api/operator/supervisor/console/customer-search?q=name
 *
 * 8/21 #36 — 수동 배정변경에서 고객명을 직접 타이핑해 불러오기.
 * 자동배정 완료 목록에 없는 고객도 검색해 배정 변경 대상으로 선택할 수 있게 한다.
 * 수퍼바이저(및 상위) 전용. admin 클라이언트로 조회(미들웨어 인증 후).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const SUP_ROLES = ['TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_MASTER'];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !SUP_ROLES.includes(roleRow.role)) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 1) return NextResponse.json({ success: true, data: { customers: [] } });

  const admin = getSupabaseAdmin();
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const { data: rows } = await admin
    .from('customer')
    .select('id, full_name, company_name, npwp')
    .or(`company_name.ilike.${like},full_name.ilike.${like},npwp.ilike.${like}`)
    .limit(12);

  // 현재 배정 상담원(있으면) 표시
  const ids = (rows ?? []).map(r => r.id);
  const opByCust = new Map<string, string>();
  if (ids.length) {
    const { data: assigns } = await admin
      .from('operator_client_assignments')
      .select('customer_id, operator_id')
      .in('customer_id', ids).eq('is_active', true);
    const opIds = [...new Set((assigns ?? []).map(a => a.operator_id))];
    const opName = new Map<string, string>();
    if (opIds.length) {
      const { data: ops } = await admin.from('tax_operators').select('id, name').in('id', opIds);
      for (const o of ops ?? []) opName.set(o.id, o.name);
    }
    for (const a of assigns ?? []) if (!opByCust.has(a.customer_id)) opByCust.set(a.customer_id, opName.get(a.operator_id) ?? '—');
  }

  const customers = (rows ?? []).map(r => ({
    customerId: r.id,
    name: r.company_name || r.full_name || '—',
    npwp: r.npwp ?? null,
    operator: opByCust.get(r.id) ?? null,
  }));
  return NextResponse.json({ success: true, data: { customers } }, { headers: { 'Cache-Control': 'no-store' } });
}
