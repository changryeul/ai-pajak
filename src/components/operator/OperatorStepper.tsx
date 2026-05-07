'use client';

/**
 * 상담원 5단계 진행 stepper.
 *
 * PDF 「AI Pajak 백오피스_상담원」 상단의 1→5 진행바.
 * 현재 단계는 1) URL 경로, 2) 선택된 케이스 상태에서 결정한다.
 */

import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type StepKey = 'step1' | 'step2' | 'step3' | 'step4' | 'step5';

interface Step {
  n: number;
  key: StepKey;
  routes: string[];
}

const STEPS: Step[] = [
  { n: 1, key: 'step1', routes: ['/operator/my-work'] },
  { n: 2, key: 'step2', routes: ['/operator/review-case'] },
  { n: 3, key: 'step3', routes: ['/operator/approval-request'] },
  { n: 4, key: 'step4', routes: ['/operator/coretax'] },
  { n: 5, key: 'step5', routes: ['/operator/history'] },
];

export function OperatorStepper() {
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('operatorStaff.stepper');

  const activeIdx = (() => {
    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i];
      if (s.routes.some(r => pathname.startsWith(`/${locale}${r}`))) return i;
    }
    return 0;
  })();

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <div className="grid grid-cols-5 gap-2">
        {STEPS.map((s, i) => {
          const isActive = i === activeIdx;
          const isPassed = i < activeIdx;
          const target = `/${locale}${s.routes[0]}`;
          return (
            <Link
              key={s.n}
              href={target}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-center transition-all',
                isActive && 'bg-blue-600 text-white shadow-md shadow-blue-500/20',
                isPassed && 'bg-blue-100 text-blue-700',
                !isActive && !isPassed && 'bg-slate-50 text-slate-400 hover:bg-slate-100',
              )}
            >
              <span className="text-[11px] font-bold opacity-90">{s.n}</span>
              <span className="text-[13px] font-bold">{t(s.key)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
