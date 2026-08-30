'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowUpRight, TrendingUp, Loader2 } from 'lucide-react';

/**
 * 요금제-데이터 초과 업그레이드 유도 배너. (2026-08-30)
 * 현재 유지 중인 법인 월관리 플랜의 한도를 신고 데이터(직원 수/원천세·PPN 거래)가
 * 초과하면, 적합한 상위 플랜으로의 업그레이드 프로세스를 안내한다.
 * 백엔드(GET/POST /api/billing/corporate-plan)의 사용량·추천·결제 흐름을 그대로 사용.
 */
interface PlanResp {
  subscription: { plan_id: string; status: string } | null;
  usage: { employees: number; withholdingPerMonth: number; ppnPerMonth: number };
  recommendation: { planId: string | null; exceedsAllPlans: boolean; exceedingDimensions: string[] };
}

const RANK: Record<string, number> = { UMKM: 0, BASIC: 1, PRO: 2 };
const PLAN_LABEL: Record<string, string> = { UMKM: 'UMKM', BASIC: 'Basic', PRO: 'Pro' };

const STR = {
  ko: {
    title: (cur: string, rec: string) => `현재 ${cur} 플랜의 한도를 초과했습니다 — ${rec} 업그레이드가 필요합니다`,
    titleCustom: (cur: string) => `현재 ${cur} 플랜 한도를 초과했습니다 — Enterprise 맞춤 견적이 필요합니다`,
    dims: { employees: '직원 수', withholdingPerMonth: '원천세 거래', ppnPerMonth: 'PPN 거래' } as Record<string, string>,
    exceed: (list: string) => `초과 항목: ${list}`,
    upgrade: (rec: string) => `${rec}로 업그레이드`,
    contact: '맞춤 견적 문의',
    sub: '정확한 신고를 위해 데이터 규모에 맞는 플랜으로 업그레이드하세요.',
  },
  id: {
    title: (cur: string, rec: string) => `Paket ${cur} Anda terlampaui — perlu upgrade ke ${rec}`,
    titleCustom: (cur: string) => `Paket ${cur} terlampaui — perlu penawaran Enterprise`,
    dims: { employees: 'Karyawan', withholdingPerMonth: 'Transaksi PPh', ppnPerMonth: 'Transaksi PPN' } as Record<string, string>,
    exceed: (list: string) => `Melebihi: ${list}`,
    upgrade: (rec: string) => `Upgrade ke ${rec}`,
    contact: 'Minta penawaran',
    sub: 'Upgrade ke paket sesuai volume data untuk pelaporan yang akurat.',
  },
  en: {
    title: (cur: string, rec: string) => `Your ${cur} plan limit is exceeded — upgrade to ${rec}`,
    titleCustom: (cur: string) => `Your ${cur} plan limit is exceeded — Enterprise quote needed`,
    dims: { employees: 'Employees', withholdingPerMonth: 'Withholding txns', ppnPerMonth: 'PPN txns' } as Record<string, string>,
    exceed: (list: string) => `Exceeded: ${list}`,
    upgrade: (rec: string) => `Upgrade to ${rec}`,
    contact: 'Request quote',
    sub: 'Upgrade to a plan matching your data volume for accurate filing.',
  },
};

export function PlanUpgradeBanner() {
  const params = useParams<{ locale?: string }>();
  const locale = (params?.locale as 'ko' | 'en' | 'id') ?? 'id';
  const s = STR[locale] ?? STR.id;
  const [data, setData] = useState<PlanResp | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/billing/corporate-plan')
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data as PlanResp); })
      .catch(() => {});
  }, []);

  if (!data || !data.subscription) return null; // 활성 구독 없으면 표시 안 함
  const cur = data.subscription.plan_id;
  const curRank = RANK[cur] ?? -1;
  const rec = data.recommendation.planId;
  const recRank = rec ? (RANK[rec] ?? 99) : 99;
  // 현재 플랜이 데이터를 못 담을 때만(추천이 더 상위이거나 전 플랜 초과)
  const needsUpgrade = data.recommendation.exceedsAllPlans || (rec != null && recRank > curRank);
  if (!needsUpgrade) return null;

  const exceededDims = data.recommendation.exceedingDimensions.map((d) => s.dims[d] ?? d);
  // exceedingDimensions 는 최상위 플랜 초과 항목만 채워짐. 없으면 사용량 기반 추정.
  const dimText = exceededDims.length > 0
    ? exceededDims.join(', ')
    : ['employees', 'withholdingPerMonth', 'ppnPerMonth'].map((d) => s.dims[d]).join(', ');

  const startUpgrade = async () => {
    if (!rec) { window.location.href = `/${locale}/pricing`; return; }
    setBusy(true);
    try {
      const res = await fetch('/api/billing/corporate-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: rec, billingCycle: 'MONTHLY' }),
      });
      const d = await res.json();
      if (d.success && d.data?.redirectUrl) window.location.href = d.data.redirectUrl;
      else if (d.success && d.data?.subscriptionId) window.location.href = `/${locale}/billing?pendingSubscriptionId=${d.data.subscriptionId}`;
      else window.location.href = `/${locale}/pricing`;
    } catch { window.location.href = `/${locale}/pricing`; }
    finally { setBusy(false); }
  };

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-100 p-2 text-amber-600"><TrendingUp className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-amber-900">
            {data.recommendation.exceedsAllPlans ? s.titleCustom(PLAN_LABEL[cur] ?? cur) : s.title(PLAN_LABEL[cur] ?? cur, rec ? (PLAN_LABEL[rec] ?? rec) : '')}
          </p>
          <p className="mt-0.5 text-xs text-amber-700">{s.exceed(dimText)} · {s.sub}</p>
        </div>
        <button onClick={startUpgrade} disabled={busy}
          className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>{data.recommendation.exceedsAllPlans ? s.contact : s.upgrade(rec ? (PLAN_LABEL[rec] ?? rec) : '')}<ArrowUpRight className="h-3.5 w-3.5" /></>}
        </button>
      </div>
    </div>
  );
}
