'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CreditCard, Receipt, TrendingUp, Loader2 } from 'lucide-react';

interface SubscriptionRow {
  id: string;
  tier_id: string;
  tier_name: string | null;
  price_idr: number;
  billing_cycle: string;
  max_clients: number | null;
  status: string;
  valid_from: string | null;
  valid_until: string | null;
  midtrans_order_id: string | null;
  paid_at: string | null;
  created_at: string;
}

interface Tier {
  id: string;
  priceIdr: number;
  maxClients: number;
}

interface BillingData {
  partnerName: string | null;
  subscription: SubscriptionRow | null;
  history: SubscriptionRow[];
  managedClientCount: number;
  recommendation: { tierId: string; reason?: string } | null;
  availableTiers: Tier[];
}

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
  PENDING_PAYMENT: 'bg-amber-50 text-amber-700 hover:bg-amber-50',
  CANCELED: 'text-slate-500',
  EXPIRED: 'text-slate-500',
  SUPERSEDED: 'text-slate-400',
};

export function FirmAdminBillingView() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/firm-admin/billing');
      const j = await r.json();
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : '불러오기 실패');
      } else {
        setData(j.data);
      }
    } catch {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const subscribe = async (tierId: string) => {
    if (!window.confirm(`${tierId} 플랜을 신청할까요? Midtrans 결제 페이지로 이동합니다.`)) return;
    setBusy(true);
    try {
      // 기존 consultant-plan endpoint 재사용 (FIRM_ADMIN 도 consultant row 보유)
      const r = await fetch('/api/billing/consultant-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(typeof j.error === 'string' ? j.error : '신청 실패');
      } else if (j.data?.redirectUrl) {
        window.open(j.data.redirectUrl, '_blank', 'noopener');
        toast.success('결제 페이지를 열었습니다. 결제 완료 후 이 페이지를 새로고침하세요.');
        void load();
      } else {
        // graceful-degrade: PENDING_PAYMENT row 는 보존됨
        toast.info('신청이 접수되었습니다. 결제 링크 생성이 지연되어 잠시 후 다시 시도해주세요.');
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-red-600">
          {error ?? '데이터 없음'}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              다시 시도
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sub = data.subscription;
  const overLimit =
    sub?.max_clients != null && sub.max_clients > 0 && data.managedClientCount > sub.max_clients;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-600" />
              현재 구독
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sub ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-slate-900">{sub.tier_id}</span>
                  <Badge className={STATUS_BADGE[sub.status]}>{sub.status}</Badge>
                </div>
                <p className="text-slate-600">
                  {rp(sub.price_idr)} / 월 · 클라이언트 한도{' '}
                  {sub.max_clients == null || sub.max_clients === 0 ? '무제한' : sub.max_clients}
                </p>
                {sub.valid_until && (
                  <p className="text-xs text-slate-400">
                    유효기간 ~{new Date(sub.valid_until).toLocaleDateString('ko-KR')}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-md bg-slate-50 py-6 text-center text-sm text-slate-400">
                활성 구독이 없습니다. 아래에서 플랜을 선택하세요.
              </div>
            )}
            <div className="mt-4 rounded-lg border border-slate-200 px-4 py-3 text-sm">
              <p className="text-slate-500">현재 관리 클라이언트</p>
              <p
                className={`mt-0.5 text-2xl font-bold tabular-nums ${overLimit ? 'text-red-600' : 'text-indigo-600'}`}
              >
                {data.managedClientCount}
                {sub?.max_clients ? (
                  <span className="ml-1 text-sm font-normal text-slate-400">
                    / {sub.max_clients}
                  </span>
                ) : null}
              </p>
              {overLimit && (
                <p className="mt-1 text-xs text-red-600">
                  한도를 초과했습니다 — 상위 플랜으로 업그레이드하세요.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              플랜 변경
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.availableTiers.map((t) => {
              const isCurrent = sub?.status === 'ACTIVE' && sub.tier_id === t.id;
              const isRecommended = data.recommendation?.tierId === t.id;
              return (
                <div
                  key={t.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    isCurrent ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {t.id}
                      {isRecommended && !isCurrent && (
                        <Badge className="ml-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                          추천
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {rp(t.priceIdr)} / 월 · 한도{' '}
                      {t.maxClients === 0 || !Number.isFinite(t.maxClients)
                        ? '무제한'
                        : t.maxClients}
                    </p>
                  </div>
                  {isCurrent ? (
                    <Badge variant="secondary">현재 플랜</Badge>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void subscribe(t.id)}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '신청'}
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-slate-500" />
            결제 이력
            <Badge variant="secondary">{data.history.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.history.length === 0 ? (
            <div className="rounded-md bg-slate-50 py-6 text-center text-sm text-slate-400">
              이력이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-2 pr-3">신청일</th>
                    <th className="py-2 pr-3">플랜</th>
                    <th className="py-2 pr-3 text-right">금액</th>
                    <th className="py-2 pr-3">상태</th>
                    <th className="py-2 pr-3">주문번호</th>
                    <th className="py-2">결제일</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 text-slate-500">
                        {new Date(h.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="py-2.5 pr-3 font-medium">{h.tier_id}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{rp(h.price_idr)}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="secondary" className={STATUS_BADGE[h.status]}>
                          {h.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-400">
                        {h.midtrans_order_id ?? '—'}
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">
                        {h.paid_at ? new Date(h.paid_at).toLocaleDateString('ko-KR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
