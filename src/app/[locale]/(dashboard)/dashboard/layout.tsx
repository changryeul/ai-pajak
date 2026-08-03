/**
 * /dashboard route-segment layout — server-side role guard.
 *
 * Why a layout (not the page itself)?
 *   /dashboard/page.tsx is 'use client', so it cannot call redirect() from
 *   next/navigation directly. Putting the role-based redirect in a layout
 *   that wraps the page lets us short-circuit on the server BEFORE the
 *   client component ever mounts. This is the only reliable way to stop the
 *   /dashboard ↔ /operator/dashboard client-side ping-pong some users hit on
 *   Next 16 when a stale Service Worker / RSC cache keeps re-mounting the
 *   page despite the client useEffect + ref guard.
 *
 * Outcome for an operator-tier user:
 *   GET /ko/dashboard → server resolves role → server redirect → user lands
 *   on /operator/dashboard (or /admin/master, /operator/my-work) with no
 *   client mount of the /dashboard tree. Loop becomes structurally
 *   impossible.
 *
 * Other roles (CUSTOMER / CONSULTANT / TAX_ADVISOR / PLATFORM_ADMIN
 * / signed-out) pass through unchanged — the existing client page renders
 * its own role-aware dashboard.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';

export const dynamic = 'force-dynamic';

export default async function DashboardSegmentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const role = await resolveUserRole(supabase, user.id);
    if (role === 'TAX_OPERATOR_MASTER') {
      redirect(`/${locale}/admin/master`);
    } else if (
      role === 'TAX_OPERATOR_LEAD' ||
      role === 'TAX_OPERATOR_SUPERVISOR'
    ) {
      redirect(`/${locale}/operator/dashboard`);
    } else if (role === 'TAX_OPERATOR') {
      // MUST match middleware.ts /dashboard branch (핑퐁 방지).
      redirect(`/${locale}/operator/workqueue`);
    }
  }

  return <>{children}</>;
}
