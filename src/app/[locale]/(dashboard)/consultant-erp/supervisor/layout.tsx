import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';

export const dynamic = 'force-dynamic';

// /consultant-erp/supervisor/* — team-lead only. CONSULTANT /
// TAX_ADVISOR pass the parent layout but should NOT see the supervisor
// console (PDF p.11/11 menus + reassign + quality view etc).
const ALLOWED_ROLES = ['TAX_OPERATOR_SUPERVISOR'];

export default async function SupervisorErpLayout({
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
    // Fall back to the staff ERP dashboard. Non-staff would have already been
    // bounced by the parent /consultant-erp layout.
    redirect(`/${locale}/consultant-erp/dashboard`);
  }

  return <>{children}</>;
}
