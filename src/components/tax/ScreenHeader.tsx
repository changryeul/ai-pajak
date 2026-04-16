'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  step: number;
  aiSteps: string[];
  showBackButton?: boolean;
}

export function ScreenHeader({ title, onBack, step, aiSteps, showBackButton = true }: ScreenHeaderProps) {
  const t = useTranslations('taxScreen');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const handleBack = () => {
    if (onBack) onBack();
    else router.push(`/${locale}/dashboard`);
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {showBackButton && (
          <Button variant="outline" onClick={handleBack}>
            {t('backToDashboard')}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            step === 1 ? 'bg-slate-900 text-white' : step > 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
          }`}
        >
          1. {t('uploadData')}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-2 rounded-lg border bg-slate-100 px-3 py-2">
            {aiSteps.map((label, i) => {
              const stepNum = i + 2;
              return (
                <div
                  key={label}
                  className={`rounded px-3 py-1 text-sm transition-colors ${
                    step === stepNum
                      ? 'bg-slate-900 text-white'
                      : step > stepNum
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {stepNum}. {label}
                </div>
              );
            })}
          </div>
          <span className="text-xs text-slate-500">{t('aiExecutes')}</span>
        </div>
      </div>
    </div>
  );
}
