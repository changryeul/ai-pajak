'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { CustomerProfileCard, type CustomerProfileInitial } from '@/components/profile/CustomerProfileCard';

/**
 * Individual customer profile page (/settings/profile).
 *
 * Kept deliberately separate from the legacy /settings page — the profile
 * redesign is PR1 scope; the existing /settings (which covers notifications,
 * language, connected accounts, etc.) is untouched.
 *
 * Initial values come from /api/customer/profile via GET. If the GET is not
 * available yet the page still renders with empty fields and the user's
 * autosave writes land via PATCH.
 */
export default function ProfileSettingsPage() {
  const t = useTranslations();
  const [initial, setInitial] = useState<CustomerProfileInitial | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/customer/profile', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          if (alive && json?.data?.customer) {
            setInitial(json.data.customer);
            return;
          }
        }
      } catch {
        // fall through to empty initial
      }
      if (alive) setInitial({});
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!initial) {
    return (
      <div className="container mx-auto py-20 px-4 text-center">
        <PageTitle title={t('profile.title')} />
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <PageTitle title={t('profile.title')} />
      <CustomerProfileCard initial={initial} />
    </div>
  );
}
