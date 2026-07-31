import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { checkOperatorMfaGate } from '@/lib/security/operator-mfa';

// Operator workbench is restricted to back-office staff. CUSTOMER /
// CONSULTANT / TAX_ADVISOR / PLATFORM_ADMIN have no business here.
export const OPERATOR_ALLOWED_ROLES = [
  'TAX_OPERATOR',
  'TAX_OPERATOR_LEAD',
  'TAX_OPERATOR_SUPERVISOR',
  'TAX_OPERATOR_MASTER',
];

/**
 * Shared operator role + 2FA gate used by every route that renders the
 * operator workbench (both the `(dashboard)/operator` shell and any
 * `(fullscreen)` operator routes). Redirects on failure; returns the
 * resolved role on success.
 */
export async function assertOperatorAccess(
  supabase: SupabaseClient,
  locale: string,
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const role = await resolveUserRole(supabase, user.id);
  if (!role || !OPERATOR_ALLOWED_ROLES.includes(role)) {
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

  return role;
}
