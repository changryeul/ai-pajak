'use client';

import { useEffect } from 'react';
import { APP_NAME } from '@/config/constants';

const DEFAULT = `${APP_NAME} - Platform Pajak Cerdas Indonesia`;

export function usePageTitle(title: string) {
  useEffect(() => {
    const target = title ? `${title} | ${APP_NAME}` : DEFAULT;
    document.title = target;
    // Next.js' built-in metadata can re-apply the default title on hydration
    // and on route transitions, overwriting ours. Observe the <title> node and
    // re-apply when something else touches it.
    const titleEl = document.querySelector('title');
    if (!titleEl) return;
    const obs = new MutationObserver(() => {
      if (document.title !== target) document.title = target;
    });
    obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => obs.disconnect();
  }, [title]);
}

export function PageTitle({ title }: { title: string }) {
  usePageTitle(title);
  return null;
}
