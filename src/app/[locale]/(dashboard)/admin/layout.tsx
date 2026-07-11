import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { checkOperatorMfaGate } from '@/lib/security/operator-mfa';

// Force dynamic — role check must run on every request.
export const dynamic = 'force-dynamic';

// /admin/* houses two audiences:
//   - PLATFORM_ADMIN: platform-wide monitoring/users/audit (NOT tax data)
//   - TAX_OPERATOR_MASTER: master governance (MRR, plan distribution, custom
//     pricing). Sub-tree /admin/master/* is further restricted by its own
//     server checks inside each page/API, so we admit MASTER at the top.
const ALLOWED_ROLES = ['PLATFORM_ADMIN', 'TAX_OPERATOR_MASTER'];

export default async function AdminLayout({
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

  // 2FA enforcement for operator-tier staff. TAX_OPERATOR_MASTER lands here
  // (/admin/master), so the operator MFA policy must gate this tree too.
  // PLATFORM_ADMIN is out of the 운영팀 policy scope.
  if (role === 'TAX_OPERATOR_MASTER') {
    const mfaGate = await checkOperatorMfaGate(supabase);
    if (mfaGate === 'enroll') {
      redirect(`/${locale}/settings?mfa=required`);
    }
    if (mfaGate === 'challenge') {
      redirect(`/${locale}/login?mfa=challenge`);
    }
  }

  return <>{children}</>;
}
