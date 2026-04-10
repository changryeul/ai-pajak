'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, AlertTriangle, CheckCircle, FileSpreadsheet,
  Building2, Store, ArrowRight, Sparkles,
} from 'lucide-react';
import { determineAnnualRegime, type AnnualRegimeResult } from '@/lib/tax/annual-regime';

export default function AnnualFilingRouterPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [loading, setLoading] = useState(true);
  const [regime, setRegime] = useState<AnnualRegimeResult | null>(null);

  useEffect(() => {
    if (sessionLoading || !session?.customerId) return;
    (async () => {
      try {
        const res = await fetch(`/api/company-profile?customerId=${session.customerId}`);
        const data = await res.json();
        if (data.success) {
          const p = data.data;
          const result = determineAnnualRegime({
            establishedYear: p.established_year,
            currentYear: new Date().getFullYear(),
            annualRevenue: p.annual_revenue,
            priorYearRevenues: [], // TODO: load historical
            npwpPph25Elected: p.npwp_pph25_elected,
            legalForm: p.legal_form,
            isUmkm: p.is_umkm,
            umkmStartYear: p.umkm_final_tax_start_year,
          });
          setRegime(result);
        }
      } catch { /* */ }
      finally { setLoading(false); }
    })();
  }, [session, sessionLoading]);

  if (loading || sessionLoading) {
    return (
      <div className="container mx-auto py-20 px-4 max-w-2xl text-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">연 결산 방식을 판별 중입니다...</p>
      </div>
    );
  }

  if (!regime) {
    return (
      <div className="container mx-auto py-20 px-4 max-w-2xl text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <p className="text-sm text-gray-500">회사 정보를 불러올 수 없습니다</p>
        <Link href={`/${locale}/company-profile`}>
          <Button className="mt-4">회사 정보 입력</Button>
        </Link>
      </div>
    );
  }

  const isDetermined = regime.regime !== 'NOT_DETERMINED';
  const Icon = regime.regime === 'PPH_FINAL' ? Store : Building2;
  const color = regime.regime === 'PPH_FINAL' ? 'emerald' : 'blue';

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
          연 결산
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          회사 정보를 기반으로 적용 받을 신고 방식을 자동 판별합니다
        </p>
      </div>

      {!isDetermined ? (
        <Card className="border-2 border-amber-300 bg-amber-50">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-amber-600 mx-auto" />
            <div>
              <h2 className="text-lg font-bold text-amber-900">{regime.title}</h2>
              <p className="text-sm text-amber-800 mt-2">{regime.reason}</p>
            </div>
            {regime.warnings?.map((w, i) => (
              <p key={i} className="text-xs text-amber-700 bg-white/60 rounded p-2">⚠ {w}</p>
            ))}
            <Link href={`/${locale}/company-profile`}>
              <Button className="bg-amber-600 hover:bg-amber-700">
                회사 정보 입력하러 가기
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className={`border-2 border-${color}-300 bg-gradient-to-br from-${color}-50 to-white`}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl bg-${color}-100`}>
                <Icon className={`h-8 w-8 text-${color}-700`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`bg-${color}-600 text-white`}>
                    자동 판별
                  </Badge>
                  <Sparkles className={`h-4 w-4 text-${color}-600`} />
                </div>
                <h2 className={`text-2xl font-bold text-${color}-900`}>{regime.title}</h2>
                <p className={`text-sm text-${color}-800 mt-2`}>{regime.reason}</p>
              </div>
            </div>

            <div className={`text-xs text-${color}-700 bg-white/60 rounded-lg p-3`}>
              <p className="font-medium mb-1">📖 법적 근거</p>
              <p>{regime.legalBasis}</p>
            </div>

            {regime.warnings && regime.warnings.length > 0 && (
              <div className="space-y-1">
                {regime.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {regime.umkmYearsRemaining !== undefined && (
              <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2 flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                UMKM 적용 잔여 기간: <b>{regime.umkmYearsRemaining}년</b>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                size="lg"
                onClick={() => {
                  if (regime.route) router.push(`/${locale}${regime.route}`);
                }}
                className={`flex-1 bg-${color}-600 hover:bg-${color}-700`}
              >
                {regime.title} 신고 시작
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Link href={`/${locale}/company-profile`}>
                <Button variant="outline" size="lg">
                  회사 정보 수정
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regime comparison table — educational */}
      <Card className="mt-6 border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-bold text-sm mb-3">두 가지 연 결산 방식 비교</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center gap-2 mb-2">
                <Store className="h-4 w-4 text-emerald-700" />
                <p className="font-bold text-emerald-900">PPh Final UMKM</p>
              </div>
              <ul className="space-y-1 text-emerald-800">
                <li>• 세율: 매출의 0.5% (매월 선납)</li>
                <li>• 조건: 연매출 48억 미만</li>
                <li>• 기간: PT 3년 · CV/Firma/Koperasi 4년 · UD 7년</li>
                <li>• 계산: 단순 — 매출 × 0.5%</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-blue-700" />
                <p className="font-bold text-blue-900">PPh 25 일반</p>
              </div>
              <ul className="space-y-1 text-blue-800">
                <li>• 세율: 과세소득 22% (기본)</li>
                <li>• 조건: UMKM 대상 아니거나 기간 만료</li>
                <li>• 납부: 전년도 세금 1/12 매월 선납</li>
                <li>• 계산: 손익계산서 + 세무 조정</li>
              </ul>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-3 text-center">
            * 어떤 방식을 적용할지는 회사 정보(설립 연도, 법인 형태, 매출, NPWP 선택 이력)를 바탕으로 자동 결정됩니다
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
