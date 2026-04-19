'use client';

/**
 * Annual Tax Filing (SPT Tahunan) selection — redesigned 2x2 grid.
 *
 * Three form cards (1770SS / 1770S / 1770) plus an AI recommendation card
 * whose checkbox logic maps to:
 *   - hasBusiness            → 1770
 *   - hasMultipleOrFinancial → 1770S
 *   - else                   → 1770SS
 *
 * Corporate (1771) is still disabled per product direction.
 */

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

type FormId = '1770ss' | '1770s' | '1770';

interface FormCard {
  id: FormId;
  title: string;
  subtitleKey: string;
  bulletKeys: string[];
}

const FORMS: FormCard[] = [
  { id: '1770ss', title: 'SPT 1770 SS', subtitleKey: 'ssSubtitle', bulletKeys: ['ssBul1', 'ssBul2', 'ssBul3', 'ssBul4'] },
  { id: '1770s', title: 'SPT 1770 S', subtitleKey: 'sSubtitle', bulletKeys: ['sBul1', 'sBul2', 'sBul3'] },
  { id: '1770', title: 'SPT 1770', subtitleKey: 'fullSubtitle', bulletKeys: ['fullBul1', 'fullBul2'] },
];

function recommendForm(answers: {
  hasBusiness: boolean;
  multipleEmployers: boolean;
  financialIncome: boolean;
}): FormId {
  if (answers.hasBusiness) return '1770';
  if (answers.multipleEmployers || answers.financialIncome) return '1770s';
  return '1770ss';
}

export default function SPTTahunanPage() {
  const t = useTranslations('tax');
  const ts = useTranslations('sptSelectV2');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [hasBusiness, setHasBusiness] = useState(false);
  const [multipleEmployers, setMultipleEmployers] = useState(false);
  const [financialIncome, setFinancialIncome] = useState(false);

  const recommendation = useMemo(
    () => recommendForm({ hasBusiness, multipleEmployers, financialIncome }),
    [hasBusiness, multipleEmployers, financialIncome],
  );
  const recommendationTitle = FORMS.find((f) => f.id === recommendation)?.title ?? 'SPT';

  const goTo = (form: FormId) => router.push(`/${locale}/tax/spt-tahunan/${form}`);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          <span className="text-xs font-medium text-yellow-700">AI Auto-fill Available</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {t('sptTahunan.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{ts('pageSubtitle')}</p>
      </div>

      {/* 2 x 2 grid: 3 form cards + 1 AI card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {FORMS.map((f) => (
          <Card key={f.id} className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-6 flex flex-col h-full">
              <p className="text-lg font-bold text-gray-900">{f.title}</p>
              <p className="text-sm text-gray-500 mt-1">{ts(f.subtitleKey)}</p>
              <ul className="mt-4 space-y-1 text-sm text-gray-600 flex-1">
                {f.bulletKeys.map((k) => (
                  <li key={k}>• {ts(k)}</li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full bg-gray-800 hover:bg-gray-900 text-white"
                onClick={() => goTo(f.id)}
              >
                {ts('selectCta')}
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* AI recommendation card */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <p className="text-lg font-bold text-gray-900">{ts('aiCardTitle')}</p>
            </div>
            <div className="mt-4 space-y-2 flex-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-gray-800"
                  checked={hasBusiness}
                  onChange={(e) => setHasBusiness(e.target.checked)}
                />
                {ts('aiHasBusiness')}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-gray-800"
                  checked={multipleEmployers}
                  onChange={(e) => setMultipleEmployers(e.target.checked)}
                />
                {ts('aiMultipleEmployers')}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-gray-800"
                  checked={financialIncome}
                  onChange={(e) => setFinancialIncome(e.target.checked)}
                />
                {ts('aiFinancialIncome')}
              </label>
            </div>
            {(hasBusiness || multipleEmployers || financialIncome) && (
              <p className="mt-3 text-xs text-gray-500">
                {ts('aiResultPrefix')} <span className="font-semibold text-gray-900">{recommendationTitle}</span>
              </p>
            )}
            <Button
              className="mt-4 w-full bg-gray-800 hover:bg-gray-900 text-white"
              onClick={() => goTo(recommendation)}
            >
              {ts('aiApplyCta')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
