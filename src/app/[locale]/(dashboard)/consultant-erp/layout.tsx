import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';

export const dynamic = 'force-dynamic';

// Consultant ERP is EXTERNAL tax-firm only (운영팀 미개입 — 결정 ①):
//   - CONSULTANT / TAX_ADVISOR: 직원용 5단계 워크플로우
//   - FIRM_ADMIN: 세무컨설팅 법인 관리자 (firm-admin sub-tree 에 별도 layout)
// 운영팀(TAX_OPERATOR/LEAD/SUPERVISOR/MASTER) · CUSTOMER · PLATFORM_ADMIN 는 차단.
// Supervisor 콘솔은 /operator/supervisor/* 로 분리됨 (더 이상 여기 없음).
const ALLOWED_ROLES = [
  'CONSULTANT',
  'TAX_ADVISOR',
  'FIRM_ADMIN',
];

export default async function ConsultantErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const role = await resolveUserRole(supabase, user.id);
  if (!role || !ALLOWED_ROLES.includes(role)) {
    redirect(`/${locale}/dashboard`);
  }

  return <>{children}</>;
}
