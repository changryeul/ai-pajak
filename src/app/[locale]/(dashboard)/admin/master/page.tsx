'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, Building2, User as UserIcon, TrendingUp, DollarSign,
  FileText, AlertTriangle, Sparkles, Loader2, ArrowRight,
  Star, BarChart3, Calendar,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

interface MasterStats {
  customers: {
    total: number;
    corporate: number;
    individual: number;
    recentSignups30d: number;
  };
  subscriptions: {
    active: number;
    unsubscribedCorporate: number;
    planDistribution: Record<string, number>;
    mrrIdr: number;
  };
  volume: {
    currentPeriod: string;
    activeEmployees: number;
    withholdingTransactions: number;
    ppnTransactions: number;
  };
  proExceeding: {
    count: number;
    candidates: Array<{
      customerId: string;
      companyName: string | null;
      reason: string;
      exceedingDimensions: string[];
    }>;
  };
  customPricing: {
    openQuotes: number;
  };
}

export default function MasterDashboardPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'ko';

  const [stats, setStats] = useState<MasterStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Role guard: master-only
  useEffect(() => {
    if (sessionLoading || !session) return;
    if (!hasRole(session, UserRole.TAX_OPERATOR_MASTER)) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [session, sessionLoading, router, locale]);

  useEffect(() => {
    fetch('/api/admin/master/stats')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStats(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || sessionLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="container mx-auto py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <p className="text-sm text-gray-500">통계를 불러올 수 없습니다</p>
      </div>
    );
  }

  const planOrder: Array<{ id: string; label: string; color: string }> = [
    { id: 'UMKM', label: 'UMKM', color: 'bg-emerald-500' },
    { id: 'BASIC', label: 'Basic', color: 'bg-blue-500' },
    { id: 'PRO', label: 'Pro', color: 'bg-purple-500' },
    { id: 'CUSTOM', label: 'Custom', color: 'bg-amber-500' },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            마스터 대시보드
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            플랫폼 전체 통계 · 처리량 · 수익 · Pro 초과 고객
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/${locale}/admin/master/custom-pricing`}>
              맞춤 가격 관리
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                <Users className="h-4 w-4 text-white" />
              </div>
              <p className="text-xs text-gray-500">총 고객</p>
            </div>
            <p className="text-2xl font-bold">{stats.customers.total}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              최근 30일 +{stats.customers.recentSignups30d}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
              <p className="text-xs text-gray-500">MRR</p>
            </div>
            <p className="text-2xl font-bold font-mono">{fmtRp(stats.subscriptions.mrrIdr)}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              활성 구독 {stats.subscriptions.active}건
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <p className="text-xs text-gray-500">Pro 초과 고객</p>
            </div>
            <p className="text-2xl font-bold">{stats.proExceeding.count}</p>
            <p className="text-[10px] text-gray-400 mt-1">맞춤 견적 필요</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <p className="text-xs text-gray-500">오픈 견적</p>
            </div>
            <p className="text-2xl font-bold">{stats.customPricing.openQuotes}</p>
            <p className="text-[10px] text-gray-400 mt-1">SENT/ACCEPTED</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer type breakdown + Plan distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-indigo-600" />
              고객 유형별 분포
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">법인 고객</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{stats.customers.corporate}</span>
                  <Badge className="bg-blue-100 text-blue-700 text-[9px]">
                    구독 {stats.subscriptions.active}
                  </Badge>
                </div>
              </div>
              {stats.subscriptions.unsubscribedCorporate > 0 && (
                <div className="flex items-center justify-between pl-6">
                  <span className="text-[11px] text-amber-600">· 미구독 법인</span>
                  <span className="text-xs font-bold text-amber-600">
                    {stats.subscriptions.unsubscribedCorporate}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-green-600" />
                  <span className="text-sm">개인 고객</span>
                </div>
                <span className="font-bold">{stats.customers.individual}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              플랜 분포
            </h3>
            <div className="space-y-3">
              {planOrder.map((plan) => {
                const count = stats.subscriptions.planDistribution[plan.id] || 0;
                const total = Object.values(stats.subscriptions.planDistribution).reduce((s, c) => s + c, 0) || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={plan.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{plan.label}</span>
                      <span className="text-xs text-gray-500">
                        {count}명 ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${plan.color} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volume snapshot */}
      <Card className="border-0 shadow-sm mb-5">
        <CardContent className="p-5">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            처리량 (이번 달 {stats.volume.currentPeriod})
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[11px] text-gray-500">활성 직원</p>
              <p className="text-2xl font-bold mt-1">{stats.volume.activeEmployees.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-gray-400">PPh 21 대상</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500">원천세 거래</p>
              <p className="text-2xl font-bold mt-1">{stats.volume.withholdingTransactions.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-gray-400">PPh 22/23/4(2)</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500">PPN 인보이스</p>
              <p className="text-2xl font-bold mt-1">{stats.volume.ppnTransactions.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-gray-400">e-Faktur</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pro-exceeding customers */}
      {stats.proExceeding.candidates.length > 0 && (
        <Card className="border-2 border-amber-300 bg-amber-50/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm flex items-center gap-2 text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                Pro 플랜 한도 초과 고객 ({stats.proExceeding.count}명)
              </h3>
              <Button size="sm" asChild>
                <Link href={`/${locale}/admin/master/custom-pricing`}>
                  맞춤 견적 등록 →
                </Link>
              </Button>
            </div>
            <div className="space-y-2">
              {stats.proExceeding.candidates.map((cand) => (
                <div
                  key={cand.customerId}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-200"
                >
                  <Star className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{cand.companyName || 'Unknown'}</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">{cand.reason}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {cand.exceedingDimensions.map((dim) => (
                        <Badge key={dim} className="bg-red-100 text-red-700 text-[9px]">
                          {dim}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/${locale}/admin/master/custom-pricing?customerId=${cand.customerId}`}>
                      견적 등록
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-[10px] text-gray-400 text-center mt-6">
        <Calendar className="inline h-3 w-3 mr-1" />
        Pro 초과 감지는 corporate 고객 상위 50개 대상 · 현재 달 기준
      </p>
    </div>
  );
}
