import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { assertOperatorAccess } from '@/lib/security/operator-access';
import { WorkqueueClient } from '@/components/operator/workqueue/WorkqueueClient';

export const dynamic = 'force-dynamic';

export default async function WorkqueuePage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const role = await assertOperatorAccess(supabase, locale);
  return <WorkqueueClient role={role} />;
}
