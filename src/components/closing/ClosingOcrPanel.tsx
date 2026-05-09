'use client';

import { useTranslations } from 'next-intl';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import type { ClosingDocument } from '@/hooks/useClosingSession';

const CATEGORY_KO: Record<string, string> = {
  SALES_LIST: '매출 리스트',
  PURCHASE_LIST: '매입 비용 리스트',
  BANK_STATEMENT: '은행 거래내역',
  FINANCIAL_STATEMENT: '재무제표',
  PAYROLL: '급여 대장',
  INVENTORY: '재고 명세',
  OTHER: '기타',
};

function fmtIDR(n: number | null | undefined): string {
  if (n == null) return '—';
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function fmtPct(p: number | null | undefined): string {
  if (p == null) return '—';
  return `${Math.round(p * 100)}%`;
}

export function ClosingOcrPanel({
  doc,
  busy,
  onTrigger,
}: {
  doc: ClosingDocument;
  busy: boolean;
  onTrigger: () => void;
}) {
  const tc = useTranslations('common');

  const status = doc.ocr_status ?? 'NONE';
  const ext = doc.ocr_extracted ?? null;

  // 진행 중 (서버가 PROCESSING으로 마킹했거나 클라이언트가 호출 중)
  const inProgress = busy || status === 'PROCESSING';

  if (status === 'COMPLETED' && ext) {
    const categoryLabel = CATEGORY_KO[ext.category] ?? ext.category;
    const confidence = doc.ocr_confidence ?? null;
    const confColor =
      confidence == null
        ? 'bg-slate-100 text-slate-700'
        : confidence >= 0.8
          ? 'bg-emerald-50 text-emerald-700'
          : confidence >= 0.5
            ? 'bg-amber-50 text-amber-700'
            : 'bg-rose-50 text-rose-700';
    return (
      <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/40 p-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 border">
            <Sparkles className="h-3 w-3 mr-1 text-emerald-600" />
            AI 분석
          </span>
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            {categoryLabel}
          </span>
          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${confColor}`}>
            신뢰도 {fmtPct(confidence)}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-500">합계: </span>
            <span className="font-mono text-slate-800">{fmtIDR(ext.totalAmount)}</span>
          </div>
          <div>
            <span className="text-slate-500">행 수: </span>
            <span className="font-mono text-slate-800">{ext.rowCount ?? '—'}</span>
          </div>
        </div>
        {ext.summary && (
          <p className="mt-1 text-[11px] text-slate-700 leading-relaxed">{ext.summary}</p>
        )}
        <button
          type="button"
          className="mt-1 text-[10px] text-blue-700 hover:underline disabled:opacity-50"
          disabled={inProgress}
          onClick={onTrigger}
        >
          {inProgress ? '재분석 중…' : '다시 분석'}
        </button>
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <div className="mt-2 rounded-md border border-rose-100 bg-rose-50/60 p-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-rose-700">
          <AlertCircle className="h-3 w-3" />
          <span className="font-semibold">AI 분석 실패</span>
        </div>
        {doc.ocr_error && (
          <p className="text-[11px] text-rose-700 mt-1">{doc.ocr_error}</p>
        )}
        <button
          type="button"
          className="mt-1 text-[10px] text-blue-700 hover:underline disabled:opacity-50"
          disabled={inProgress}
          onClick={onTrigger}
        >
          {inProgress ? '재시도 중…' : '다시 시도'}
        </button>
      </div>
    );
  }

  // status === 'NONE' or 'PROCESSING' 또는 미정
  return (
    <button
      type="button"
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      disabled={inProgress}
      onClick={onTrigger}
      aria-label={tc('analyze') ?? 'AI 분석'}
    >
      {inProgress ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="h-3 w-3 text-emerald-600" />
      )}
      {inProgress ? '분석 중…' : 'AI 분석'}
    </button>
  );
}
