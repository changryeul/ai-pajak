import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { checkOperatorMfaGate } from '@/lib/security/operator-mfa';

// Force dynamic — role check must run on every request.
export const dynamic = 'force-dynamic';

// Operator workbench is restricted to back-office staff. CUSTOMER /
// CONSULTANT / TAX_ADVISOR / PLATFORM_ADMIN have no business here.
const ALLOWED_ROLES = [
  'TAX_OPERATOR',
  'TAX_OPERATOR_LEAD',
  'TAX_OPERATOR_SUPERVISOR',
  'TAX_OPERATOR_MASTER',
];

export default async function OperatorLayout({
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
    // Not an operator → bounce to the user's normal dashboard. They can still
    // hit the operator API endpoints directly (those have their own role
    // gating via composeMiddleware), but the UI is hidden.
    redirect(`/${locale}/dashboard`);
  }

  // 2FA enforcement (system_setting security.operator_mfa_required).
  // When the policy is on, operator-tier staff need a verified TOTP factor
  // AND an aal2 session to use the workbench.
  const mfaGate = await checkOperatorMfaGate(supabase);
  if (mfaGate === 'enroll') {
    redirect(`/${locale}/settings?mfa=required`);
  }
  if (mfaGate === 'challenge') {
    redirect(`/${locale}/login?mfa=challenge`);
  }

  return <>{children}</>;
}
