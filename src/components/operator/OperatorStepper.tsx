'use client';

/**
 * 상담원 5단계 진행 stepper.
 *
 * PDF 「AI Pajak 백오피스_상담원」 상단의 1→5 진행바.
 * 현재 단계는 1) URL 경로, 2) 선택된 케이스 상태에서 결정한다.
 *
 *   1. 고객선택       /operator/my-work
 *   2. 자료/세금검토   /operator/review-case
 *   3. 승인요청       /operator/approval-request
 *   4. Coretax 처리   /operator/coretax
 *   5. 완료           /operator/history (또는 case 상태가 COMPLETED)
 */

import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Step {
  n: number;
  label: string;
  // 매칭되는 라우트 prefix (locale 제외)
  routes: string[];
}

const STEPS: Step[] = [
  { n: 1, label: '고객선택',     routes: ['/operator/my-work'] },
  { n: 2, label: '자료/세금검토', routes: ['/operator/review-case'] },
  { n: 3, label: '승인요청',     routes: ['/operator/approval-request'] },
  { n: 4, label: 'Coretax 처리', routes: ['/operator/coretax'] },
  { n: 5, label: '완료',         routes: ['/operator/history'] },
];

export function OperatorStepper() {
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();

  // 현재 활성 단계 결정 — 첫 번째로 매칭되는 step.
  // 매칭되는 게 없으면 1단계로 폴백.
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
              <span className="text-[13px] font-bold">{s.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
