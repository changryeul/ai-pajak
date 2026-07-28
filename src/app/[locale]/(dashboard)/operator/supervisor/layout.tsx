import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';

export const dynamic = 'force-dynamic';

// /operator/supervisor/* — team-lead only. TAX_OPERATOR / LEAD / MASTER
// pass the parent /operator layout but should NOT see the supervisor
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
    // Fall back to the operator dashboard. Non-operators would have already
    // been bounced by the parent /operator layout.
    redirect(`/${locale}/operator/dashboard`);
  }

  return <>{children}</>;
}
