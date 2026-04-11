'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, X, Loader2, CheckCircle2 } from 'lucide-react';
import { fmtRp } from '@/lib/utils';

interface Quote {
  id: string;
  quote_title: string;
  quote_description: string | null;
  service_type: string;
  monthly_price_idr: number | null;
  one_time_price_idr: number | null;
  valid_until: string | null;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
}

const SERVICE_TYPE_LABEL: Record<string, string> = {
  CORPORATE_PLAN: '맞춤 법인 요금제',
  TAX_AUDIT: '세무조사 대응',
  TRANSFER_PRICING: '이전가격 (TP)',
  ADVISORY: '특별 자문',
  OTHER: '기타 서비스',
};

export function CustomPricingWidget() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ko';
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/custom-pricing');
      const d = await res.json();
      if (d.success) setQuotes(d.data?.quotes || []);
    } catch {
      // ignore — widget is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAction = async (quoteId: string, action: 'accept' | 'reject') => {
    setActing(quoteId + ':' + action);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/billing/custom-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, action }),
      });
      const d = await res.json();
      if (!d.success) {
        setError(d.error || '처리 실패');
        return;
      }
      if (action === 'accept') {
        setSuccess(
          d.data?.nextStep || '견적이 수락되었습니다.',
        );
      } else {
        setSuccess('견적이 거절되었습니다.');
      }
      await refresh();
    } catch {
      setError('서버 오류');
    } finally {
      setActing(null);
    }
  };

  // Loading or no quotes — render nothing (the widget should be invisible
  // when there's nothing for the customer to act on)
  if (loading) return null;
  const sentQuotes = quotes.filter((q) => q.status === 'SENT');
  const acceptedQuotes = quotes.filter((q) => q.status === 'ACCEPTED');
  if (sentQuotes.length === 0 && acceptedQuotes.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 via-pink-50 to-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <h3 className="font-semibold text-sm text-gray-900">맞춤 가격 견적</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
            JTC 마스터
          </span>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded p-2 mb-2">{error}</p>
        )}
        {success && (
          <p className="text-xs text-green-700 bg-green-50 rounded p-2 mb-2 flex items-start gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            {success}
          </p>
        )}

        <div className="space-y-3">
          {sentQuotes.map((q) => (
            <div key={q.id} className="rounded-lg bg-white border border-purple-100 p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{q.quote_title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {SERVICE_TYPE_LABEL[q.service_type] || q.service_type}
                  </p>
                </div>
              </div>

              {q.quote_description && (
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">{q.quote_description}</p>
              )}

              <div className="mt-3 flex items-baseline gap-3 flex-wrap">
                {q.monthly_price_idr != null && (
                  <span className="text-base font-bold text-gray-900">
                    {fmtRp(q.monthly_price_idr)}
                    <span className="text-[10px] text-gray-500 ml-1">/월</span>
                  </span>
                )}
                {q.one_time_price_idr != null && (
                  <span className="text-base font-bold text-gray-900">
                    {fmtRp(q.one_time_price_idr)}
                    <span className="text-[10px] text-gray-500 ml-1">1회</span>
                  </span>
                )}
                {q.valid_until && (
                  <span className="text-[10px] text-gray-500">
                    유효기간 ~ {new Date(q.valid_until).toLocaleDateString('ko-KR')}
                  </span>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleAction(q.id, 'accept')}
                  disabled={!!acting}
                >
                  {acting === q.id + ':accept' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      수락
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(q.id, 'reject')}
                  disabled={!!acting}
                >
                  {acting === q.id + ':reject' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5 mr-1" />
                      거절
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}

          {acceptedQuotes.map((q) => (
            <div
              key={q.id}
              className="rounded-lg bg-green-50 border border-green-200 p-3"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                <p className="font-semibold text-sm text-gray-900 truncate">
                  {q.quote_title}
                </p>
              </div>
              <p className="text-[11px] text-gray-600 mt-1">
                {SERVICE_TYPE_LABEL[q.service_type] || q.service_type} · 수락 완료
                {q.accepted_at && ` (${new Date(q.accepted_at).toLocaleDateString('ko-KR')})`}
              </p>
              {q.service_type === 'CORPORATE_PLAN' && (
                <a
                  href={`/${locale}/billing`}
                  className="inline-block mt-2 text-[11px] text-green-700 hover:text-green-800 font-medium"
                >
                  결제 페이지로 이동 →
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
