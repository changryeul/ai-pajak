import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { SupervisorConsole } from '@/components/operator/supervisor-console/SupervisorConsole';

export const dynamic = 'force-dynamic';

const SUP_ROLES = ['TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_MASTER'];

/**
 * 수퍼바이저 콘솔 v13 — 통합 다크 콘솔 (fullscreen, 대시보드 사이드바 없음).
 * 접근: (fullscreen) layout 이 operator 게이트 + 여기서 supervisor 계열로 좁힘.
 */
export default async function SupervisorConsolePage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  const role = await resolveUserRole(supabase, user.id);
  if (!role || !SUP_ROLES.includes(role)) redirect(`/${locale}/operator/workqueue`);
  const name = (user.user_metadata?.full_name as string) || user.email || undefined;
  return <SupervisorConsole name={name} role={role} />;
}
