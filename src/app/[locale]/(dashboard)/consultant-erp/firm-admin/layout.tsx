import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';

export const dynamic = 'force-dynamic';

// Firm-admin sub-tree: FIRM_ADMIN 전용 (P6 follow-up).
// 상위 consultant-erp layout 이 CONSULTANT/TAX_ADVISOR/SUPERVISOR/FIRM_ADMIN
// 을 통과시키므로, 여기서 FIRM_ADMIN 으로 한 번 더 좁힌다. API 는 별도로
// requireFirmAdmin 이 지키고 있어 (role + consultant row + EXTERNAL 3중),
// 이 게이트는 페이지 셸 노출 차단용.
export default async function FirmAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const role = await resolveUserRole(supabase, user.id);
  if (role !== 'FIRM_ADMIN') {
    redirect(`/${locale}/consultant-erp/dashboard`);
  }

  return <>{children}</>;
}
