'use client';

/**
 * 이번 달 신고 보드 — 월신고 가이드 + 실시간 진행 (2026-08-30).
 * 세목 4행 × 공통 5단계(자료입력→검토→승인→ID Billing→납부).
 * 처음 방문 시 가이드 모드(세목 설명 전부 펼침), 이후엔 접힘.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';
import { PageTitle } from '@/components/layout/PageTitle';
import { fmtRp } from '@/lib/utils';
import {
  CalendarClock, ChevronDown, ChevronUp, CheckCircle2, Circle, CircleDot,
  Users, Receipt, Shield, Calculator, Info, ArrowRight,
} from 'lucide-react';

const GUIDE_SEEN_KEY = 'monthlyBoardGuideSeen';

interface TaxState {
  key: 'pph21' | 'withholding' | 'prepaid' | 'ppn';
  applicable: boolean;
  dataCount: number;
  queueStatus: string | null;
  amount: number;
  doneThrough: number;
  currentStep: number | null;
}
interface BoardData {
  period: string;
  profile: { isPkp: boolean; isUmkm: boolean; pph25Elected: boolean };
  taxes: TaxState[];
}

const STEP_KEYS = ['stepData', 'stepReview', 'stepApprove', 'stepBilling', 'stepPay'] as const;

// 세목별 정적 메타: 아이콘/색/입력 화면/마감 규칙
const TAX_META = {
  pph21: { icon: Users, color: '#3b82f6', href: '/tax/pph21', payDay: 10, reportDay: 20 },
  withholding: { icon: Receipt, color: '#10b981', href: '/tax/pph23', payDay: 10, reportDay: 20 },
  prepaid: { icon: Shield, color: '#8b5cf6', href: '/tax/umkm', payDay: 15, reportDay: null },
  ppn: { icon: Calculator, color: '#f59e0b', href: '/tax/ppn', payDay: 0, reportDay: 0 }, // 0 = 익월 말일
} as const;

function defaultPeriod(): string {
  // 신고 대상은 통상 지난달 귀속분
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 귀속월 기준 마감일 (익월 day일; day=0 → 익월 말일). */
function deadlineOf(period: string, day: number): Date {
  const [y, m] = period.split('-').map(Number);
  return day === 0 ? new Date(y, m + 1, 0) : new Date(y, m, day);
}
function ddayText(dl: Date): { text: string; urgent: boolean; passed: boolean } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((dl.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { text: `D+${-diff}`, urgent: false, passed: true };
  return { text: diff === 0 ? 'D-DAY' : `D-${diff}`, urgent: diff <= 3, passed: false };
}

export default function MonthlyBoardPage() {
  const t = useTranslations('monthlyBoard');
  const params = useParams();
  const locale = params.locale as string;
  const { customerId, isConsultant, customers, selectedCustomerId, setSelectedCustomerId } =
    useEffectiveCustomerId({ companyOnly: true });

  const [period, setPeriod] = useState(defaultPeriod());
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  // 첫 방문 = 가이드 모드 (모든 설명 펼침)
  const [openGuides, setOpenGuides] = useState<Record<string, boolean>>({});
  const [guideMode, setGuideMode] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(GUIDE_SEEN_KEY)) {
        setGuideMode(true);
        setOpenGuides({ pph21: true, withholding: true, prepaid: true, ppn: true });
        localStorage.setItem(GUIDE_SEEN_KEY, '1');
      }
    } catch { /* */ }
  }, []);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/tax/monthly-board?period=${period}&customerId=${customerId}`);
      const j = await r.json();
      if (j.success) setData(j.data as BoardData);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [customerId, period]);
  useEffect(() => { load(); }, [load]);

  const showAllGuides = () => {
    setGuideMode(true);
    setOpenGuides({ pph21: true, withholding: true, prepaid: true, ppn: true });
  };

  const monthOptions = useMemo(() => {
    const opts: string[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() - 1);
    }
    return opts;
  }, []);

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <PageTitle title={t('title')} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isConsultant && customers.length > 0 && (
            <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={selectedCustomerId ?? ''} onChange={e => setSelectedCustomerId(e.target.value)}>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name ?? c.full_name}</option>)}
            </select>
          )}
          <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono"
            value={period} onChange={e => setPeriod(e.target.value)}>
            {monthOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={showAllGuides}
            className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100">
            <Info className="h-3.5 w-3.5" />{t('showGuide')}
          </button>
        </div>
      </div>

      {/* 처음 온 사람을 위한 개요 — 가이드 모드에서만 */}
      {guideMode && (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
          <p className="font-bold mb-1">{t('introTitle')}</p>
          <p className="text-[13px] leading-relaxed whitespace-pre-line">{t('introBody')}</p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading && !data && <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6 text-sm text-slate-500">{t('loading')}</CardContent></Card>}
        {data && data.taxes.map(tax => {
          const meta = TAX_META[tax.key];
          const IconC = meta.icon;
          const dl = deadlineOf(data.period, meta.payDay);
          const dd = ddayText(dl);
          const open = !!openGuides[tax.key];
          const done = tax.doneThrough >= 5;
          return (
            <Card key={tax.key} className={`rounded-2xl border-0 shadow-sm overflow-hidden ${!tax.applicable ? 'opacity-60' : ''}`}>
              <CardContent className="p-4 md:p-5">
                {/* 헤더줄: 세목 + 마감 D-day + 설명 토글 */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${meta.color}1a` }}>
                    <IconC className="h-4.5 w-4.5" style={{ color: meta.color }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{t(`${tax.key}Name`)}</p>
                    <p className="text-[11px] text-slate-500">{t(`${tax.key}Short`)}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    {!tax.applicable ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{t('notApplicable')}</span>
                    ) : done ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{t('allDone')}</span>
                    ) : (
                      <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${dd.passed ? 'bg-red-100 text-red-700' : dd.urgent ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                        <CalendarClock className="h-3 w-3" />{t('payBy')} {dl.getMonth() + 1}/{dl.getDate()} · {dd.text}
                      </span>
                    )}
                    <button onClick={() => setOpenGuides(g => ({ ...g, [tax.key]: !open }))}
                      aria-expanded={open} aria-label={t('whatIsThis')}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50">
                      <Info className="h-3.5 w-3.5" />{t('whatIsThis')}
                      {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                {/* 세목 설명 (가이드) */}
                {open && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[12.5px] leading-relaxed text-slate-700 whitespace-pre-line">
                    {t(`${tax.key}Guide`)}
                  </div>
                )}

                {tax.applicable && (
                  <>
                    {/* 5단계 스텝퍼 */}
                    <div className="mt-4 flex items-center gap-0 overflow-x-auto pb-1">
                      {STEP_KEYS.map((sk, i) => {
                        const stepNo = i + 1;
                        const isDone = tax.doneThrough >= stepNo;
                        const isCurrent = tax.currentStep === stepNo;
                        return (
                          <div key={sk} className="flex items-center shrink-0">
                            {i > 0 && <span className={`h-0.5 w-6 md:w-10 ${tax.doneThrough >= stepNo - 0 ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                            <div className="flex flex-col items-center gap-1 px-1">
                              {isDone ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                : isCurrent ? <CircleDot className="h-5 w-5 text-blue-500" />
                                : <Circle className="h-5 w-5 text-slate-300" />}
                              <span className={`text-[10px] whitespace-nowrap ${isDone ? 'text-emerald-700 font-semibold' : isCurrent ? 'text-blue-700 font-bold' : 'text-slate-400'}`}>
                                {t(sk)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {tax.amount > 0 && (
                        <span className="ml-auto pl-4 text-xs font-mono font-bold text-slate-700 shrink-0">{fmtRp(tax.amount)}</span>
                      )}
                    </div>

                    {/* 지금 할 일 */}
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2">
                      <p className="text-xs text-slate-700">
                        <span className="font-bold text-slate-900">{t('todoLabel')}</span>{' '}
                        {done ? t('todoDone')
                          : tax.currentStep === 1 || tax.dataCount === 0 ? t(`${tax.key}Todo1`)
                          : tax.currentStep === 5 ? t('todoPay')
                          : t('todoWait')}
                      </p>
                      {!done && (tax.currentStep === 1 || tax.dataCount === 0) && (
                        <Link href={`/${locale}${meta.href}`}
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700">
                          {t('goEnter')} <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                      {!done && tax.currentStep === 5 && (
                        <Link href={`/${locale}/tax/billing`}
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
                          {t('goBilling')} <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 단계 의미 안내 (하단 고정 도움말) */}
      <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">{t('legend')}</p>
    </div>
  );
}
