import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { assertOperatorAccess } from '@/lib/security/operator-access';

// Force dynamic — role check must run on every request.
export const dynamic = 'force-dynamic';

// Escapes the shared (dashboard) shell (SidebarWrapper + Header +
// ChatbotWrapper) for pages that need their own full-bleed layout (e.g. the
// counselor workqueue mockup's dark full-screen shell). Runs ONLY the
// operator role/MFA gate — no chrome of its own.
export default async function FullscreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const supabase = await createClient();
  await assertOperatorAccess(supabase, locale);

  return <>{children}</>;
}
