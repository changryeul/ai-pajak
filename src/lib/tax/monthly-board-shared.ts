/**
 * 월신고 보드 공용 로직 (보드 페이지 + 대시보드 미니 위젯 공유, 2026-08-30).
 * 납부 마감: 급여·원천세 익월 10일 / 선납법인세 익월 15일 / PPN 익월 말일(0).
 */
export const PAY_DAY: Record<'pph21' | 'withholding' | 'prepaid' | 'ppn', number> = {
  pph21: 10, withholding: 10, prepaid: 15, ppn: 0,
};

export const TAX_COLOR: Record<keyof typeof PAY_DAY, string> = {
  pph21: '#3b82f6', withholding: '#10b981', prepaid: '#8b5cf6', ppn: '#f59e0b',
};

/** 귀속월(YYYY-MM) 기준 납부 마감일. day=0 → 익월 말일. */
export function deadlineOf(period: string, day: number): Date {
  const [y, m] = period.split('-').map(Number);
  return day === 0 ? new Date(y, m + 1, 0) : new Date(y, m, day);
}

export function ddayText(dl: Date): { text: string; urgent: boolean; passed: boolean } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((dl.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { text: `D+${-diff}`, urgent: false, passed: true };
  return { text: diff === 0 ? 'D-DAY' : `D-${diff}`, urgent: diff <= 3, passed: false };
}

/** 신고 대상 기본 귀속월 = 지난달. */
export function defaultFilingPeriod(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
