'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, AlertTriangle, FileSpreadsheet,
  Sparkles, Calendar, FileText, Building2, ArrowRight,
} from 'lucide-react';
import { ScreenHeader, MethodCard } from '@/components/tax';
import { determineAnnualRegime, type AnnualRegimeResult } from '@/lib/tax/annual-regime';

type ClosingType = 'umkm' | 'normal' | 'complex';

export default function AnnualFilingPage() {
  const t = useTranslations('closingWork');
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [selectedType, setSelectedType] = useState<ClosingType | null>(null);
  const [aiRecommending, setAiRecommending] = useState(false);
  const [aiResult, setAiResult] = useState<AnnualRegimeResult | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);

  const runAiRecommendation = async () => {
    if (!session?.customerId) return;
    setAiRecommending(true);
    setAiResult(null);
    setProfileMissing(false);
    try {
      const res = await fetch(`/api/company-profile?customerId=${session.customerId}`);
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data;
        const result = determineAnnualRegime({
          establishedYear: p.established_year,
          currentYear: new Date().getFullYear(),
          annualRevenue: p.annual_revenue,
          priorYearRevenues: [],
          npwpPph25Elected: p.npwp_pph25_elected,
          legalForm: p.legal_form,
          isUmkm: p.is_umkm,
          umkmStartYear: p.umkm_final_tax_start_year,
        });
        setAiResult(result);
        if (result.regime === 'PPH_FINAL') setSelectedType('umkm');
        else if (result.regime === 'PPH25') setSelectedType('normal');
      } else {
        setProfileMissing(true);
      }
    } catch {
      setProfileMissing(true);
    } finally {
      setAiRecommending(false);
    }
  };

  const handleNext = () => {
    if (!selectedType) return;
    const routes: Record<ClosingType, string> = {
      umkm: '/tax/umkm',
      normal: '/tax/annual/pph25',
      complex: '/tax/annual/pph25',
    };
    router.push(`/${locale}${routes[selectedType]}`);
  };

  if (sessionLoading) {
    return (
      <div className="container mx-auto py-20 px-4 max-w-2xl text-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
      </div>
    );
  }

  if (!session?.customerId) {
    return (
      <div className="container mx-auto py-20 px-4 max-w-2xl text-center">
        <FileSpreadsheet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">{t('aiNoCustomer')}</p>
        <Link href={`/${locale}/customers`} className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-4 inline-block">
          {t('goToCustomerList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-[1100px]">
      <ScreenHeader
        title={t('pageTitle')}
        step={1}
        aiSteps={[t('stepSelectType'), t('stepTaxAdjust'), t('stepFileGen')]}
      />

      {/* Guide Card */}
      <Card className="mb-4">
        <CardContent className="space-y-4 p-6 text-sm">
          <p className="font-semibold">{t('guideTitle')}</p>

          <div>
            <p className="font-medium flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-blue-600" />
              {t('sectionTiming')}
            </p>
            <p className="text-slate-600 mt-1 ml-5">{t('sectionTimingDesc')}</p>
          </div>

          <div>
            <p className="font-medium flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-emerald-600" />
              {t('sectionDocs')}
            </p>
            <ul className="ml-9 list-disc text-slate-600 mt-1 space-y-0.5">
              <li>{t('docFS')}</li>
              <li>{t('docSales')}</li>
              <li>{t('docPayroll')}</li>
              <li>{t('docAssets')}</li>
              <li>{t('docContracts')}</li>
            </ul>
          </div>

          <div>
            <p className="font-medium flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-purple-600" />
              {t('sectionTypes')}
            </p>
            <ul className="ml-9 list-disc text-slate-600 mt-1 space-y-0.5">
              <li>{t('typeUmkmInfo')}</li>
              <li>{t('typeNormalInfo')}</li>
              <li>{t('typeComplexInfo')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Type selection */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="font-semibold">{t('typeSelectTitle')}</p>
            <p className="text-sm text-slate-500 mt-1">{t('typeSelectDesc')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <MethodCard
              active={selectedType === 'umkm'}
              title={t('umkmTitle')}
              desc={t('umkmDesc')}
              onClick={() => setSelectedType('umkm')}
            />
            <MethodCard
              active={selectedType === 'normal'}
              title={t('normalTitle')}
              desc={t('normalDesc')}
              onClick={() => setSelectedType('normal')}
            />
            <MethodCard
              active={selectedType === 'complex'}
              title={t('complexTitle')}
              desc={t('complexDesc')}
              onClick={() => setSelectedType('complex')}
            />
          </div>

          {aiRecommending && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              <span className="text-indigo-700">{t('aiRecommendLoading')}</span>
            </div>
          )}

          {aiResult && !aiRecommending && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm text-emerald-900">{t('aiResultTitle')}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-emerald-600 text-white text-[10px]">{aiResult.title}</Badge>
                  </div>
                  <p className="text-xs text-emerald-800 mt-2">{aiResult.reason}</p>
                  {aiResult.legalBasis && (
                    <p className="text-[10px] text-emerald-700 mt-1">📖 {aiResult.legalBasis}</p>
                  )}
                  {aiResult.warnings && aiResult.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {aiResult.warnings.map((w, i) => (
                        <p key={i} className="text-[10px] text-amber-700 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          {w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {profileMissing && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-900">{t('noProfileWarning')}</p>
                <Link href={`/${locale}/company-profile`} className="text-xs text-amber-700 hover:underline mt-1 inline-block">
                  {t('goToCompanyInfo')}
                </Link>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={handleNext}
              disabled={!selectedType}
            >
              {t('btnNext')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={runAiRecommendation}
              disabled={aiRecommending}
            >
              {aiRecommending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {t('btnAiRecommend')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
