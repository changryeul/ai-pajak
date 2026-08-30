'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';

// SPT Masa PDF 즉석 생성 가능한 월 세목 (endpoint 지원)
const MONTHLY_PDF_TYPES = ['PPh21', 'PPh23', 'PPh4_2', 'PPh_FINAL', 'PPN'];

interface ClosingRow {
  kind: 'CLOSING';
  sessionId: string;
  fiscalYear: number;
  closingType: 'UMKM' | 'PPH25';
  sessionStatus: string;
  submission: {
    status: string;
    bpeNumber: string | null;
    ntpn: string | null;
    completedAt: string | null;
  } | null;
  idBilling: {
    billingCode: string;
    amount: number;
    status: string;
    ntpn: string | null;
  } | null;
}

type ListTab = 'all' | 'monthly' | 'annual';
type RowStatus = 'filed' | 'paidPending' | 'aiReview';

const STEP_KEYS: ('yearMonth' | 'monthly' | 'annual' | 'ntpn')[] = [
  'yearMonth', 'monthly', 'annual', 'ntpn',
];

const LIST_TABS: ListTab[] = ['all', 'monthly', 'annual'];

interface Row {
  id: string;
  kind: 'monthly' | 'annual';
  period: string;
  type: string;
  status: RowStatus;
  payDeadline: string;
  fileDeadline: string;
  amount: string;
  ntpn: string;
  bpe: string;
  // 2026-08-30 — 월신고 상세/다운로드용 (SPT Masa PDF by customer+type+period)
  taxTypeRaw?: string;   // PPh21 | PPh23 | PPh4_2 | PPh_FINAL | PPN | PPh25 ...
  periodYm?: string;     // YYYY-MM
}

const ROW_KEYS: ('pph21' | 'ppn' | 'sptBadan' | 'pph25')[] = ['pph21', 'ppn', 'sptBadan', 'pph25'];
const ROW_KIND: Record<(typeof ROW_KEYS)[number], 'monthly' | 'annual'> = {
  pph21: 'monthly',
  ppn: 'monthly',
  sptBadan: 'annual',
  pph25: 'monthly',
};

export function CompanyFilingsView() {
  const t = useTranslations('filingsPage');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { session } = useSession();
  const customerId = session?.customerId ?? null;
  const [listTab, setListTab] = useState<ListTab>('all');
  const [closingRows, setClosingRows] = useState<Row[]>([]);
  // 2026-06-21: 실제 tax_filing 행 — 두 버튼 link 활성
  const [realRows, setRealRows] = useState<Row[]>([]);
  // 2026-06-21: 사용자가 자료 정리 + 최종 제출했지만 운영팀 처리 전 — "처리 대기" 행
  const [requestRows, setRequestRows] = useState<Row[]>([]);
  // 2026-08-30: 실제 월신고 (djp_submission_queue) — 상세보기 + SPT Masa PDF 다운로드
  const [queueRows, setQueueRows] = useState<Row[]>([]);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [dl, setDl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tax/filings?limit=50', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        type FilingApi = { id: string; taxType: string; taxPeriod: string; status: string; taxDue: number; bpeNumber?: string | null };
        const rows = ((json?.data ?? []) as FilingApi[]).map((f): Row => {
          const isCompleted = f.status === 'FILED' || f.status === 'ACCEPTED' || f.status === 'COMPLETED' || f.status === 'SUBMITTED';
          return {
            id: f.id,
            kind: 'monthly',
            period: f.taxPeriod,
            type: f.taxType,
            status: isCompleted ? 'filed' : 'aiReview',
            payDeadline: '—',
            fileDeadline: '—',
            amount: f.taxDue ? `Rp ${Number(f.taxDue).toLocaleString('id-ID')}` : '—',
            ntpn: '—',
            bpe: f.bpeNumber ?? '—',
            taxTypeRaw: f.taxType,
            periodYm: /^\d{4}-\d{2}/.test(f.taxPeriod) ? f.taxPeriod.slice(0, 7) : undefined,
          };
        });
        if (!cancelled) setRealRows(rows);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // 2026-08-30 — 실제 월신고(djp_submission_queue) → 행. 상세보기 + SPT Masa PDF 다운로드.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customer/queue', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        type QItem = { id: string; tax_type: string; tax_period_month: number; tax_period_year: number; amount: number | null; status: string; bpe_number: string | null };
        const items = (json?.data?.items ?? json?.data ?? []) as QItem[];
        const rows = items
          .filter((q) => q.tax_type !== 'SPT_TAHUNAN')
          .map((q): Row => {
            const ym = `${q.tax_period_year}-${String(q.tax_period_month).padStart(2, '0')}`;
            const completed = ['COMPLETED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'APPROVED'].includes(q.status);
            return {
              id: `q-${q.id}`,
              kind: 'monthly',
              period: ym,
              type: q.tax_type === 'PPh4_2' ? 'PPh 4(2)' : q.tax_type,
              status: completed ? 'filed' : 'aiReview',
              payDeadline: '—', fileDeadline: '—',
              amount: q.amount ? `Rp ${Number(q.amount).toLocaleString('id-ID')}` : '—',
              ntpn: '—', bpe: q.bpe_number ?? '—',
              taxTypeRaw: q.tax_type, periodYm: ym,
            };
          });
        if (!cancelled) setQueueRows(rows);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customer/spt-masa-request', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        type ReqApi = { id: string; tax_type: string; tax_period: string; status: string; filing_id: string | null };
        const rows = ((json?.data ?? []) as ReqApi[])
          .filter((r) => r.status === 'PENDING' && !r.filing_id) // 운영팀 처리 전 + tax_filing 없음
          .map((r): Row => ({
            id: `req-${r.id}`,
            kind: 'monthly',
            period: r.tax_period,
            type: r.tax_type === 'PPh42' ? 'PPh 4(2)' : r.tax_type,
            status: 'aiReview',
            payDeadline: '—',
            fileDeadline: '—',
            amount: '—',
            ntpn: '—',
            bpe: '—',
          }));
        if (!cancelled) setRequestRows(rows);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tax/closing-filings', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        const rows = ((json?.data ?? []) as ClosingRow[]).map((r): Row => {
          const completed = r.submission?.status === 'COMPLETED';
          const paid = r.idBilling?.status === 'PAID';
          const status: RowStatus = completed ? 'filed' : paid ? 'paidPending' : 'aiReview';
          const amountFmt =
            r.idBilling?.amount != null
              ? `Rp ${r.idBilling.amount.toLocaleString('id-ID')}`
              : '—';
          const typeLabel =
            r.closingType === 'UMKM'
              ? `SPT Tahunan ${r.fiscalYear} (UMKM)`
              : `SPT Tahunan ${r.fiscalYear} (PPh25)`;
          return {
            id: `closing-${r.sessionId}`,
            kind: 'annual',
            period: String(r.fiscalYear),
            type: typeLabel,
            status,
            payDeadline: '—',
            fileDeadline: '—',
            amount: amountFmt,
            ntpn: r.submission?.ntpn ?? r.idBilling?.ntpn ?? '—',
            bpe: r.submission?.bpeNumber ?? '—',
          };
        });
        if (!cancelled) setClosingRows(rows);
      } catch {
        /* non-fatal */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const mockRows: Row[] = ROW_KEYS.map((id) => ({
    id,
    kind: ROW_KIND[id],
    period: t(`rows.${id}.period`),
    type: t(`rows.${id}.type`),
    status: t(`rows.${id}.status`) as RowStatus,
    payDeadline: t(`rows.${id}.payDeadline`),
    fileDeadline: t(`rows.${id}.fileDeadline`),
    amount: t(`rows.${id}.amount`),
    ntpn: t(`rows.${id}.ntpn`),
    bpe: t(`rows.${id}.bpe`),
  }));

  // 실제 월신고 = tax_filing + djp_submission_queue (period+type 중복 제거, tax_filing 우선)
  const seenMonthly = new Set(realRows.map((r) => `${r.taxTypeRaw}|${r.periodYm}`));
  const dedupQueue = queueRows.filter((r) => !seenMonthly.has(`${r.taxTypeRaw}|${r.periodYm}`));
  const realMonthly = [...realRows, ...dedupQueue];
  // 실데이터가 있으면 mock(placeholder)은 숨김
  const hasReal = realMonthly.length > 0 || requestRows.length > 0 || closingRows.length > 0;
  const allRows: Row[] = [...realMonthly, ...requestRows, ...closingRows, ...(hasReal ? [] : mockRows)];
  // uuid 형태이면 진짜 tax_filing 행 — 두 버튼이 동작
  const isRealFilingId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  // req-* prefix 는 spt_masa_submission_request 행
  const isRequestRow = (id: string) => id.startsWith('req-');
  const filteredRows = listTab === 'all' ? allRows : allRows.filter((r) => r.kind === listTab);

  const counts = {
    result: allRows.length,
    complete: allRows.filter((r) => r.status === 'filed').length,
    inProgress: allRows.filter((r) => r.status !== 'filed').length,
    total: 'Rp 34,500,000',
  };

  // 2026-08-30 — 월신고 SPT Masa PDF 다운로드 (customer + type + period 즉석 생성)
  const canDownloadMonthly = (r: Row) => !!(customerId && r.periodYm && r.taxTypeRaw && MONTHLY_PDF_TYPES.includes(r.taxTypeRaw));
  const downloadMonthlyPdf = async (r: Row) => {
    if (!canDownloadMonthly(r)) { toast.info(tc('comingSoon')); return; }
    setDl(r.id);
    try {
      const res = await fetch('/api/tax/spt-masa-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, taxType: r.taxTypeRaw, period: r.periodYm }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `SPT_Masa_${r.taxTypeRaw}_${r.periodYm}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success(t('ctaDownload'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF');
    } finally { setDl(null); }
  };

  const renderStatus = (status: RowStatus) => {
    if (status === 'filed') {
      return (
        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {t('statusFiled')}
        </span>
      );
    }
    if (status === 'paidPending') {
      return (
        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {t('statusPaidPending')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        {t('statusAiReview')}
      </span>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Title row */}
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{t('pageTitle')}</h1>
        <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/dashboard`)}>
          {t('backToDashboard')}
        </Button>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
          {t('currentStep')}
        </span>
        {STEP_KEYS.map((s) => (
          <span key={s} className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
            {t(`steps.${s}`)}
          </span>
        ))}
      </div>

      {/* Query card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        <p className="text-base font-bold text-slate-900">{t('query.title')}</p>
        <p className="text-sm text-slate-500 mt-1">{t('query.subtitle')}</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5 items-end">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-700">{t('query.year')}</p>
            <select className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm bg-white" defaultValue="2025">
              <option value="2025">2025{locale === 'ko' ? '년' : ''}</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-700">{t('query.month')}</p>
            <select className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm bg-white">
              <option>{t('query.all')}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-700">{t('query.kind')}</p>
            <select className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm bg-white">
              <option>{t('query.all')}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-700">{t('query.taxType')}</p>
            <select className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm bg-white">
              <option>{t('query.all')}</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => toast.success(tc('comingSoon'))}>
            {t('query.search')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.info(tc('comingSoon'))}>
            {t('query.reset')}
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard t={t} k="result" value={t('statusCards.result.value', { count: counts.result })} />
        <StatCard t={t} k="complete" value={t('statusCards.complete.value', { count: counts.complete })} />
        <StatCard t={t} k="inProgress" value={t('statusCards.inProgress.value', { count: counts.inProgress })} />
        <StatCard t={t} k="total" value={t('statusCards.total.value', { amount: counts.total })} />
      </div>

      {/* List card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-base font-bold text-slate-900">{t('list.title')}</p>
            <p className="text-sm text-slate-500 mt-1">{t('list.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {LIST_TABS.map((tb) => (
              <button
                key={tb}
                onClick={() => setListTab(tb)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  listTab === tb
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                )}
              >
                {t(`listTabs.${tb}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">{t('columns.period')}</th>
                <th className="px-4 py-3">{t('columns.type')}</th>
                <th className="px-4 py-3">{t('columns.status')}</th>
                <th className="px-4 py-3">{t('columns.deadline')}</th>
                <th className="px-4 py-3 text-right">{t('columns.amount')}</th>
                <th className="px-4 py-3">{t('columns.ntpn')}</th>
                <th className="px-4 py-3">{t('columns.bpe')}</th>
                <th className="px-4 py-3">{t('columns.method')}</th>
                <th className="px-4 py-3 w-32">{t('columns.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="text-sm align-top">
                  <td className="px-4 py-4 text-slate-700">{row.period}</td>
                  <td className="px-4 py-4 font-medium text-slate-900">{row.type}</td>
                  <td className="px-4 py-4">{renderStatus(row.status)}</td>
                  <td className="px-4 py-4 text-slate-600 leading-relaxed">
                    <div>{t('deadlinePay')}: <span className="tabular-nums">{row.payDeadline}</span></div>
                    <div>{t('deadlineFile')}: <span className="tabular-nums">{row.fileDeadline}</span></div>
                  </td>
                  <td className="px-4 py-4 text-right text-slate-900 tabular-nums">{row.amount}</td>
                  <td className="px-4 py-4 text-slate-600 font-mono text-xs">{row.ntpn}</td>
                  <td className="px-4 py-4 text-slate-600">{row.bpe}</td>
                  <td className="px-4 py-4 text-slate-600">{t('methodAuto')}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => {
                          if (isRealFilingId(row.id)) {
                            router.push(`/${locale}/filings/${row.id}`);
                          } else if (row.taxTypeRaw && row.periodYm) {
                            setDetailRow(row); // 월신고 상세 (모달)
                          } else if (isRequestRow(row.id)) {
                            toast.info(t('pendingOperatorReview'));
                          } else {
                            toast.info(tc('comingSoon'));
                          }
                        }}
                      >
                        {t('ctaDetail')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={dl === row.id}
                        onClick={() => {
                          if (isRealFilingId(row.id)) {
                            router.push(`/${locale}/filings/${row.id}#docs`);
                          } else if (canDownloadMonthly(row)) {
                            void downloadMonthlyPdf(row);
                          } else if (isRequestRow(row.id)) {
                            toast.info(t('pendingOperatorReview'));
                          } else {
                            toast.info(tc('invoiceComing'));
                          }
                        }}
                      >
                        {dl === row.id ? '…' : t('ctaDownload')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-5 py-4">
        <p className="text-xs text-slate-600 leading-relaxed">{t('footerNote')}</p>
      </div>

      {/* 2026-08-30 — 월신고 상세 모달 */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailRow(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{detailRow.type}</h3>
                <p className="text-sm text-slate-500">{detailRow.period}</p>
              </div>
              <button onClick={() => setDetailRow(null)} className="rounded-md p-1 text-xl leading-none text-gray-400 hover:bg-gray-100">×</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[11px] text-gray-400">{t('columns.status')}</p><div className="mt-0.5">{renderStatus(detailRow.status)}</div></div>
              <div><p className="text-[11px] text-gray-400">{t('columns.amount')}</p><p className="font-semibold tabular-nums text-slate-900">{detailRow.amount}</p></div>
              <div><p className="text-[11px] text-gray-400">NTPN</p><p className="font-mono text-xs text-slate-700">{detailRow.ntpn}</p></div>
              <div><p className="text-[11px] text-gray-400">BPE</p><p className="text-xs text-slate-700">{detailRow.bpe}</p></div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDetailRow(null)}>{tc('close')}</Button>
              {canDownloadMonthly(detailRow) && (
                <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" disabled={dl === detailRow.id}
                  onClick={() => downloadMonthlyPdf(detailRow)}>
                  {dl === detailRow.id ? '…' : t('ctaDownload')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  t,
  k,
  value,
}: {
  t: (key: string) => string;
  k: 'result' | 'complete' | 'inProgress' | 'total';
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{t(`statusCards.${k}.title`)}</p>
      <p className="text-xs text-slate-400 mt-0.5">{t(`statusCards.${k}.sub`)}</p>
      <p className="text-base font-medium text-slate-700 mt-3">{value}</p>
    </div>
  );
}
