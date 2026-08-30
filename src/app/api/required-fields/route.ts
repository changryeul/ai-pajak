/**
 * GET /api/required-fields?formKey=company_profile|my_profile|pph23|ppn|payslip
 *
 * 고객/운영팀이 폼별 "필수항목" 설정을 읽는다(별표 표시 + 빈 값 입력유도).
 * MASTER 가 required_field_config 에서 관리. 로그인 사용자면 누구나 읽기.
 * (2026-08-30 필수항목 레지스트리)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formKey = request.nextUrl.searchParams.get('formKey');
  const admin = getSupabaseAdmin();
  let q = admin.from('required_field_config')
    .select('form_key, field_key, label, is_required, sort_order')
    .order('form_key', { ascending: true }).order('sort_order', { ascending: true });
  if (formKey) q = q.eq('form_key', formKey);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map(r => ({
    formKey: r.form_key, fieldKey: r.field_key, label: r.label,
    isRequired: r.is_required, sortOrder: r.sort_order,
  }));
  // 필수(active)만 별도로도 제공 — 폼 소비 편의
  const requiredKeys = rows.filter(r => r.isRequired).map(r => r.fieldKey);
  return NextResponse.json({ success: true, data: { fields: rows, requiredKeys } },
    { headers: { 'Cache-Control': 'no-store' } });
}
