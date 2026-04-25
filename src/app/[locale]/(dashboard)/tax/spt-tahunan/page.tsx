'use client';

/**
 * Annual Tax Filing (SPT Tahunan) selection — keynote-aligned 2x2 grid.
 *
 * Layout per keynote slide-6:
 *   Top-left    : 빠른 추천 질문 (salary? / salary tier / business?)
 *   Top-right   : 1770SS
 *   Bottom-left : 1770S
 *   Bottom-right: 1770
 *
 * AI answers drive recommendation:
 *   - hasBusiness            → 1770
 *   - salary > 60jt OR has financial/multi-employer → 1770S
 *   - else                   → 1770SS
 *
 * Bottom "다음 단계로 이동" button proceeds to the selected form's
 * data-entry page; each card still carries a direct "이 유형 선택" button.
 *
 * Corporate (1771) is disabled per product direction.
 */

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

type FormId = '1770ss' | '1770s' | '1770';
type YN = 'yes' | 'no';
type SalaryTier = 'low' | 'high'; // ≤ 60jt / > 60jt

interface FormCard {
  id: FormId;
  title: string;
  subtitleKey: string;
  bulletKeys: string[];
  hintKey: string;
}

const FORMS: FormCard[] = [
  { id: '1770ss', title: 'SPT 1770 SS', subtitleKey: 'ssSubtitle', bulletKeys: ['ssBul1', 'ssBul2', 'ssBul3', 'ssBul4'], hintKey: 'ssHint' },
  { id: '1770s',  title: 'SPT 1770 S',  subtitleKey: 'sSubtitle',  bulletKeys: ['sBul1', 'sBul2', 'sBul3', 'sBul4', 'sBul5'], hintKey: 'sHint' },
  { id: '1770',   title: 'SPT 1770',    subtitleKey: 'fullSubtitle', bulletKeys: ['fullBul1', 'fullBul2', 'fullBul3', 'fullBul4', 'fullBul5'], hintKey: 'fullHint' },
];

function recommendForm(answers: {
  hasSalary: YN;
  salaryTier: SalaryTier;
  hasBusiness: YN;
}): FormId {
  if (answers.hasBusiness === 'yes') return '1770';
  if (answers.hasSalary === 'yes' && answers.salaryTier === 'high') return '1770s';
  return '1770ss';
}

export default function SPTTahunanPage() {
  const ts = useTranslations('sptSelectV2');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [hasSalary, setHasSalary] = useState<YN>('yes');
  const [salaryTier, setSalaryTier] = useState<SalaryTier>('high');
  const [hasBusiness, setHasBusiness] = useState<YN>('no');

  const recommendation = useMemo(
    () => recommendForm({ hasSalary, salaryTier, hasBusiness }),
    [hasSalary, salaryTier, hasBusiness],
  );
  const recommendationTitle = FORMS.find((f) => f.id === recommendation)?.title ?? 'SPT';

  const goTo = (form: FormId) => router.push(`/${locale}/tax/spt-tahunan/${form}`);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {ts('pageTitle')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{ts('pageSubtitle')}</p>
      </div>

      {/* 2 x 2 grid: AI card + 3 form cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* AI recommendation card (top-left per keynote) */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <p className="text-lg font-bold text-gray-900">{ts('aiCardTitle')}</p>
            </div>
            <div className="mt-4 space-y-3 flex-1">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {ts('aiQSalary')}
                </label>
                <select
                  value={hasSalary}
                  onChange={(e) => setHasSalary(e.target.value as YN)}
                  className="h-9 w-full rounded-md border border-gray-200 bg-white text-sm px-2"
                >
                  <option value="yes">{ts('optYes')}</option>
                  <option value="no">{ts('optNo')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {ts('aiQSalaryTier')}
                </label>
                <select
                  value={salaryTier}
                  onChange={(e) => setSalaryTier(e.target.value as SalaryTier)}
                  className="h-9 w-full rounded-md border border-gray-200 bg-white text-sm px-2"
                  disabled={hasSalary === 'no'}
                >
                  <option value="low">{ts('optSalaryLow')}</option>
                  <option value="high">{ts('optSalaryHigh')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {ts('aiQBusiness')}
                </label>
                <select
                  value={hasBusiness}
                  onChange={(e) => setHasBusiness(e.target.value as YN)}
                  className="h-9 w-full rounded-md border border-gray-200 bg-white text-sm px-2"
                >
                  <option value="yes">{ts('optYes')}</option>
                  <option value="no">{ts('optNo')}</option>
                </select>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-800">
              👉 {ts('aiResultPrefix')} <span className="font-bold">{recommendationTitle}</span>
            </div>
          </CardContent>
        </Card>

        {FORMS.map((f) => {
          const isRecommended = recommendation === f.id;
          return (
            <Card
              key={f.id}
              className={
                'border-0 shadow-sm overflow-hidden ' +
                (isRecommended ? 'ring-2 ring-blue-500' : '')
              }
            >
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-gray-900">📌 {f.title}</p>
                  {isRecommended && (
                    <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      {ts('aiBadge')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{ts(f.subtitleKey)}</p>
                <ul className="mt-4 space-y-1 text-sm text-gray-600 flex-1">
                  {f.bulletKeys.map((k) => (
                    <li key={k}>- {ts(k)}</li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-gray-500">👉 {ts(f.hintKey)}</p>
                <Button
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => goTo(f.id)}
                >
                  {ts('selectCta')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* keynote 2026-04-25: 하단 "다음 단계로 이동" 버튼 제거 —
           각 카드의 "이 유형 선택" 버튼으로 바로 진입 */}
    </div>
  );
}
