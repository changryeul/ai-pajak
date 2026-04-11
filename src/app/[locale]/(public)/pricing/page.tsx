'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check, Sparkles, Loader2, ArrowRight, Store, Building2,
  FileText, User as UserIcon, Star, Briefcase, Users,
} from 'lucide-react';
import { CORPORATE_PLANS, formatPlanPrice, priceWithVat } from '@/config/corporate-pricing';
import { CONSULTANT_TIERS, formatTierPrice, tierPriceWithVat } from '@/config/consultant-pricing';
import { INDIVIDUAL_SPT_PLANS } from '@/config/individual-pricing';

interface SubscriptionState {
  subscription: { plan_id: string; status: string } | null;
  recommendation: {
    planId: string | null;
    reason: string;
    exceedsAllPlans: boolean;
  };
}

interface ConsultantState {
  subscription: { tier_id: string; status: string } | null;
  managedClientCount: number;
  recommendation: {
    tierId: string | null;
    tierName: string | null;
    reason: string;
  };
}

export default function PricingPage() {
  const { session } = useSession();
  const params = useParams();
  const locale = (params?.locale as string) || 'ko';

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subState, setSubState] = useState<SubscriptionState | null>(null);
  const [consultantState, setConsultantState] = useState<ConsultantState | null>(null);
  const isConsultant =
    session?.role === UserRole.CONSULTANT_JTC || session?.role === UserRole.TAX_ADVISOR_JTC;
  const [tab, setTab] = useState<'CORPORATE' | 'INDIVIDUAL' | 'CONSULTANT'>(
    session?.customerType === 'INDIVIDUAL' ? 'INDIVIDUAL'
    : isConsultant ? 'CONSULTANT'
    : 'CORPORATE'
  );

  // Load current subscription + recommendation for logged-in corporate customers
  useEffect(() => {
    if (!session || session.customerType !== 'COMPANY') return;
    fetch('/api/billing/corporate-plan')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSubState(d.data);
      })
      .catch(() => {});
  }, [session]);

  // Load tier subscription for logged-in external consultants
  useEffect(() => {
    if (!session || !isConsultant) return;
    fetch('/api/billing/consultant-plan')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setConsultantState(d.data);
      })
      .catch(() => {});
  }, [session, isConsultant]);

  const handleSubscribeConsultantTier = async (tierId: string) => {
    if (!session) {
      window.location.href = `/${locale}/register`;
      return;
    }
    if (!isConsultant) {
      setError('세무 사무소 컨설턴트만 이 플랜을 구독할 수 있습니다');
      return;
    }
    setCheckoutLoading(tierId);
    setError(null);
    try {
      const res = await fetch('/api/billing/consultant-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId, billingCycle: 'MONTHLY' }),
      });
      const d = await res.json();
      if (!d.success) {
        setError(d.error || '구독 신청 실패');
        return;
      }
      // Same graceful degrade as corporate-plan
      if (d.data?.redirectUrl) {
        window.location.href = d.data.redirectUrl;
      } else if (d.data?.subscriptionId) {
        window.location.href = `/${locale}/billing?pendingSubscriptionId=${d.data.subscriptionId}`;
      } else {
        setError('결제 페이지 생성 실패');
      }
    } catch {
      setError('서버 오류');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleStartIndividualSpt = async (sptType: string) => {
    if (!session) {
      window.location.href = `/${locale}/register`;
      return;
    }
    if (session.customerType === 'COMPANY') {
      setError('법인 고객은 SPT Pribadi가 아닌 법인 요금제를 이용해주세요');
      return;
    }
    setCheckoutLoading(sptType);
    setError(null);
    try {
      const res = await fetch('/api/billing/individual-spt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sptType }),
      });
      const d = await res.json();
      if (!d.success) {
        setError(d.error || '결제 준비 실패');
        return;
      }
      // Snap token available → redirect to Midtrans payment page.
      // No Snap token (Midtrans creds missing) → fall back to the
      // billing pay page so the user can retry payment from the in-app UI.
      if (d.data?.paymentUrl) {
        window.location.href = d.data.paymentUrl;
      } else if (d.data?.transactionId) {
        window.location.href = `/${locale}/billing/pay/${d.data.transactionId}`;
      } else {
        setError('결제 준비 실패');
      }
    } catch {
      setError('서버 오류');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!session) {
      // Not logged in → redirect to signup
      window.location.href = `/${locale}/register`;
      return;
    }
    if (session.customerType !== 'COMPANY') {
      setError('법인 고객만 이 플랜을 구독할 수 있습니다');
      return;
    }
    setCheckoutLoading(planId);
    setError(null);
    try {
      const res = await fetch('/api/billing/corporate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle: 'MONTHLY' }),
      });
      const d = await res.json();
      if (!d.success) {
        setError(d.error || '구독 신청 실패');
        return;
      }
      // Payment gateway available → redirect to Snap; otherwise the
      // PENDING_PAYMENT subscription is created and the user is sent to
      // the in-app billing page where they can retry payment later.
      if (d.data?.redirectUrl) {
        window.location.href = d.data.redirectUrl;
      } else if (d.data?.subscriptionId) {
        window.location.href = `/${locale}/billing?pendingSubscriptionId=${d.data.subscriptionId}`;
      } else {
        setError('결제 페이지 생성 실패');
      }
    } catch {
      setError('서버 오류');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const currentPlanId = subState?.subscription?.plan_id || null;
  const recommendedPlanId = subState?.recommendation?.planId || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href={`/${locale}`}>
            <img src="/logo.png" alt="AI Pajak" className="h-10 mx-auto mb-4" />
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">요금제</h1>
          <p className="text-gray-500 mt-2 max-w-xl mx-auto">
            법인은 월 구독, 개인은 SPT 신고 건당 결제. 필요에 맞게 선택하세요.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-xl bg-white border border-gray-200 p-1 shadow-sm flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setTab('CORPORATE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'CORPORATE' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Building2 className="h-4 w-4" />
              법인 고객 (월 구독)
            </button>
            <button
              type="button"
              onClick={() => setTab('INDIVIDUAL')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'INDIVIDUAL' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <UserIcon className="h-4 w-4" />
              개인 (건당 결제)
            </button>
            <button
              type="button"
              onClick={() => setTab('CONSULTANT')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'CONSULTANT' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Briefcase className="h-4 w-4" />
              세무 사무소 (월 구독)
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 max-w-2xl mx-auto p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Corporate plans */}
        {tab === 'CORPORATE' && (
          <>
            {subState?.recommendation?.reason && (
              <div className="mb-6 max-w-2xl mx-auto p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-blue-900">AI 추천</p>
                    <p className="text-xs text-blue-700 mt-1">{subState.recommendation.reason}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {CORPORATE_PLANS.map((plan) => {
                const isCurrent = currentPlanId === plan.id;
                const isRecommended = recommendedPlanId === plan.id && !isCurrent;
                const Icon = plan.id === 'UMKM' ? Store : plan.id === 'BASIC' ? Building2 : Star;
                const gradient = plan.id === 'UMKM' ? 'from-emerald-500 to-green-600'
                  : plan.id === 'BASIC' ? 'from-blue-500 to-indigo-600'
                  : 'from-purple-500 to-pink-600';

                return (
                  <Card
                    key={plan.id}
                    className={`border-2 relative overflow-hidden ${
                      isRecommended ? 'border-blue-500 shadow-lg ring-2 ring-blue-100'
                      : isCurrent ? 'border-green-500 shadow-md'
                      : 'border-gray-200'
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                        AI 추천
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute top-0 right-0 bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                        현재 플랜
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-sm`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                      <p className="text-xs text-gray-500 mt-1 h-8">{plan.description}</p>

                      <div className="mt-4">
                        <p className="text-3xl font-bold text-gray-900">{formatPlanPrice(plan)}</p>
                        <p className="text-[11px] text-gray-500">월 · VAT 별도 (VAT 포함 {formatPlanPrice({ ...plan, priceIdr: priceWithVat(plan) })})</p>
                      </div>

                      <div className="mt-4 space-y-1.5 text-[11px] text-gray-600">
                        <div className="flex items-center gap-1">
                          <Badge className="bg-gray-100 text-gray-700 text-[9px]">한도</Badge>
                        </div>
                        <p>• 직원 {plan.limits.employees.toLocaleString('id-ID')}명</p>
                        <p>• 원천세 월 {plan.limits.withholdingPerMonth}건</p>
                        <p>• PPN 월 {plan.limits.ppnPerMonth === 0 ? '해당 없음' : `${plan.limits.ppnPerMonth}건`}</p>
                      </div>

                      <div className="mt-4 pt-4 border-t space-y-2">
                        {plan.features.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                            <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>

                      <Button
                        className="w-full mt-6"
                        disabled={isCurrent || checkoutLoading !== null}
                        onClick={() => handleSubscribe(plan.id)}
                      >
                        {checkoutLoading === plan.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : isCurrent ? (
                          '현재 이용 중'
                        ) : session ? (
                          <>구독하기 <ArrowRight className="h-4 w-4 ml-1" /></>
                        ) : (
                          '가입 후 구독'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Custom pricing CTA for over-Pro usage */}
            {subState?.recommendation?.exceedsAllPlans && (
              <div className="mt-6 max-w-2xl mx-auto p-5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300">
                <p className="font-bold text-sm text-amber-900">Pro 플랜 한도 초과</p>
                <p className="text-xs text-amber-800 mt-1">
                  {subState.recommendation.reason}
                </p>
                <p className="text-xs text-amber-700 mt-2">
                  대규모 기업을 위한 맞춤 견적을 제공합니다. 아래 버튼으로 상담 요청을 보내주세요.
                </p>
                <Button variant="outline" className="mt-3 border-amber-400 text-amber-900" asChild>
                  <Link href={`/${locale}/contact`}>맞춤 견적 상담 요청 →</Link>
                </Button>
              </div>
            )}
          </>
        )}

        {/* Individual plans */}
        {tab === 'INDIVIDUAL' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {INDIVIDUAL_SPT_PLANS.map((plan, i) => {
              const gradient = i === 0 ? 'from-cyan-500 to-blue-600'
                : i === 1 ? 'from-indigo-500 to-purple-600'
                : 'from-pink-500 to-rose-600';

              return (
                <Card key={plan.id} className="border-2 border-gray-200">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-sm`}>
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 h-8">{plan.description}</p>

                    <div className="mt-4">
                      <p className="text-3xl font-bold text-gray-900">
                        Rp {plan.priceIdr.toLocaleString('id-ID')}
                      </p>
                      <p className="text-[11px] text-gray-500">SPT 신고 1건 (VAT 별도)</p>
                    </div>

                    <div className="mt-4 pt-4 border-t space-y-2">
                      {plan.features.map((f, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                          <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      className="w-full mt-6"
                      onClick={() => handleStartIndividualSpt(plan.id)}
                      disabled={checkoutLoading === plan.id}
                    >
                      {checkoutLoading === plan.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          준비 중…
                        </>
                      ) : (
                        <>
                          {session ? '결제하고 시작' : '가입하고 시작'}
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Consultant tier plans */}
        {tab === 'CONSULTANT' && (
          <>
            <div className="mb-6 max-w-2xl mx-auto p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 text-center">
              <p className="text-sm font-bold text-purple-900">세무 사무소 월 구독</p>
              <p className="text-xs text-purple-700 mt-1">
                AI Pajak을 사용해서 본인 사무소 고객을 관리하는 외부 세무사용 플랜.
                본인 고객들에게는 별도 청구 가능합니다.
              </p>
            </div>

            {consultantState && (
              <div className="mb-6 max-w-2xl mx-auto p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-blue-900">
                      현재 관리 고객 수: {consultantState.managedClientCount}명
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">{consultantState.recommendation.reason}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {CONSULTANT_TIERS.map((tier) => {
                const isCurrent = consultantState?.subscription?.tier_id === tier.id;
                const isRecommended =
                  consultantState?.recommendation.tierId === tier.id && !isCurrent;
                const gradient = tier.id === 'STARTER' ? 'from-emerald-500 to-green-600'
                  : tier.id === 'GROWTH' ? 'from-indigo-500 to-purple-600'
                  : 'from-pink-500 to-rose-600';
                const Icon = tier.id === 'STARTER' ? Briefcase
                  : tier.id === 'GROWTH' ? Users : Star;

                return (
                  <Card
                    key={tier.id}
                    className={`border-2 relative overflow-hidden ${
                      isRecommended ? 'border-blue-500 shadow-lg ring-2 ring-blue-100'
                      : isCurrent ? 'border-green-500 shadow-md'
                      : 'border-gray-200'
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                        AI 추천
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute top-0 right-0 bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                        현재 티어
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-sm`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
                      <p className="text-xs text-gray-500 mt-1 h-8">{tier.description}</p>

                      <div className="mt-4">
                        <p className="text-3xl font-bold text-gray-900">{formatTierPrice(tier)}</p>
                        <p className="text-[11px] text-gray-500">
                          월 · VAT 별도 (VAT 포함 Rp {tierPriceWithVat(tier).toLocaleString('id-ID')})
                        </p>
                      </div>

                      <div className="mt-4 py-2 px-3 rounded-lg bg-purple-50 border border-purple-100">
                        <p className="text-[11px] font-bold text-purple-900">
                          {tier.maxClients >= 999_999 ? '무제한 고객' : `최대 ${tier.maxClients}명 고객`}
                        </p>
                      </div>

                      <div className="mt-4 pt-4 border-t space-y-2">
                        {tier.features.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                            <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>

                      <Button
                        className="w-full mt-6"
                        disabled={isCurrent || checkoutLoading !== null}
                        onClick={() => handleSubscribeConsultantTier(tier.id)}
                      >
                        {checkoutLoading === tier.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : isCurrent ? (
                          '현재 이용 중'
                        ) : session ? (
                          <>구독하기 <ArrowRight className="h-4 w-4 ml-1" /></>
                        ) : (
                          '가입 후 구독'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-10">
          모든 가격은 인도네시아 루피아(IDR) 기준입니다. PPN 11%는 별도로 청구됩니다.
        </p>
      </div>
    </div>
  );
}
