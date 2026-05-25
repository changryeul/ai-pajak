'use client';

/**
 * Supervisor / Master 사이드바 하단 KPI 줄.
 *
 * PDF 「수퍼바이저 화면」 좌측 하단 "전체·승인·배정" 표기를 재현.
 * /api/operator/cases?scope=all 응답을 한 번 fetch 해서 클라이언트에서
 * count. sessionStorage 60초 캐시로 페이지 navigation 마다 재호출 방지.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface KpiData {
  total: number;
  approval: number;
  assigned: number;
}

const CACHE_KEY = 'aip.opsSidebar.kpi.v1';
const CACHE_TTL_MS = 60_000;

function readCache(): KpiData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: KpiData; ts: number };
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: KpiData) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    /* ignore quota */
  }
}

export function OpsSidebarFooter() {
  const t = useTranslations('supervisorSidebar');
  const [data, setData] = useState<KpiData | null>(() => readCache());

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/operator/cases?scope=all');
        const j = await res.json();
        if (cancelled || !j.success) return;
        const items: Array<{ status?: string; operator_id?: string | null }> =
          j.data?.items ?? [];
        const next: KpiData = {
          total: items.length,
          approval: items.filter((i) => i.status === 'PENDING_APPROVAL').length,
          assigned: items.filter((i) => !!i.operator_id).length,
        };
        setData(next);
        writeCache(next);
      } catch {
        /* silent — KPI degrades to placeholder dashes below */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (!data) {
    return (
      <p className="px-3 text-[10px] text-gray-400">
        {t('kpiAll')} · {t('kpiApproval')} · {t('kpiAssignment')}
      </p>
    );
  }
  return (
    <p className="px-3 text-[10px] text-gray-500">
      {t('kpiAll')} {data.total} · {t('kpiApproval')} {data.approval} · {t('kpiAssignment')}{' '}
      {data.assigned}
    </p>
  );
}
