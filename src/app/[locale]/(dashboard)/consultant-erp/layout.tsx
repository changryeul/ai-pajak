import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';

export const dynamic = 'force-dynamic';

// Consultant ERP is for tax-firm staff:
//   - CONSULTANT / TAX_ADVISOR: 직원용 5단계 워크플로우
//   - TAX_OPERATOR_SUPERVISOR: 팀장용 (supervisor sub-tree 에 별도 layout)
//   - FIRM_ADMIN: 세무컨설팅 법인 관리자 (firm-admin sub-tree 에 별도 layout)
// CUSTOMER / PLATFORM_ADMIN / TAX_OPERATOR(LEAD/MASTER) 는 차단.
const ALLOWED_ROLES = [
  'CONSULTANT',
  'TAX_ADVISOR',
  'TAX_OPERATOR_SUPERVISOR',
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
