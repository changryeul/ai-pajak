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

      {/* Progress indicator — display-only, not interactive. Clarifies that steps 2~4 are AI-driven. */}
      <div
        aria-label="AI auto-processing progress"
        className="flex items-center gap-2 flex-wrap select-none cursor-default"
      >
        <div
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            step === 1 ? 'bg-slate-900 text-white' : step > 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          1. {t('uploadData')}
        </div>
        {aiSteps.map((label, i) => {
          const stepNum = i + 2;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className="h-px w-3 bg-slate-300" />
              <div
                className={`rounded-md px-2.5 py-1 text-xs ${
                  step === stepNum
                    ? 'bg-slate-900 text-white'
                    : step > stepNum
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {stepNum}. {label}
              </div>
            </div>
          );
        })}
        <span className="ml-1 text-[11px] text-slate-400 italic">{t('aiExecutes')}</span>
      </div>
    </div>
  );
}
