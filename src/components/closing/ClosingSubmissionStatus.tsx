'use client';

/**
 * 결산 wizard 「제출 후」 상태 카드 — Phase E.
 *
 * Phase B에서 운영팀의 Coretax record-completion이 closing_submission을 자동
 * 갱신하므로, 고객은 wizard를 새로고침하면 신고완료 + BPE + NTPN을 바로 볼 수 있다.
 * 이 컴포넌트는 status에 따라 색상/메시지/노출되는 메타데이터가 자동으로 바뀐다.
 *
 * 모든 사용자 노출 텍스트는 i18n 키(closingSubmission.*) 사용. 5 locales 지원.
 */

import { useTranslations } from 'next-intl';
import { CheckCircle2, Clock, Loader2, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ClosingSubmissionData {
  status: 'SUBMITTED' | 'OPERATOR_REVIEW' | 'PROCESSING' | 'BPE_UPLOADED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | string;
  channel: 'RPA' | 'CORETAX_API' | string;
  submitted_at: string;
  completed_at?: string | null;
  bpe_number?: string | null;
  bpe_uploaded_at?: string | null;
  ntpn?: string | null;
  failure_reason?: string | null;
}

interface PaletteEntry {
  wrap: string;
  badge: string;
  Icon: typeof CheckCircle2;
}

const PALETTE: Record<string, PaletteEntry> = {
  SUBMITTED:       { wrap: 'border-amber-200 bg-amber-50',   badge: 'bg-amber-100 text-amber-800', Icon: Clock },
  OPERATOR_REVIEW: { wrap: 'border-amber-200 bg-amber-50',   badge: 'bg-amber-100 text-amber-800', Icon: Clock },
  PROCESSING:      { wrap: 'border-blue-200 bg-blue-50',     badge: 'bg-blue-100 text-blue-700',   Icon: Loader2 },
  BPE_UPLOADED:    { wrap: 'border-blue-200 bg-blue-50',     badge: 'bg-blue-100 text-blue-700',   Icon: Loader2 },
  COMPLETED:       { wrap: 'border-emerald-300 bg-emerald-50', badge: 'bg-emerald-600 text-white', Icon: CheckCircle2 },
  FAILED:          { wrap: 'border-rose-300 bg-rose-50',     badge: 'bg-rose-600 text-white',      Icon: AlertCircle },
  CANCELLED:       { wrap: 'border-slate-200 bg-slate-50',   badge: 'bg-slate-200 text-slate-700', Icon: X },
};

const FALLBACK: PaletteEntry = {
  wrap: 'border-slate-200 bg-slate-50',
  badge: 'bg-slate-200 text-slate-700',
  Icon: Clock,
};

const KNOWN_STATUSES = ['SUBMITTED', 'OPERATOR_REVIEW', 'PROCESSING', 'BPE_UPLOADED', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
type KnownStatus = typeof KNOWN_STATUSES[number];
const isKnown = (s: string): s is KnownStatus => (KNOWN_STATUSES as readonly string[]).includes(s);

export function ClosingSubmissionStatus({ submission }: { submission: ClosingSubmissionData }) {
  const t = useTranslations('closingSubmission');
  const fmtTs = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString() : '—';

  const known = isKnown(submission.status);
  const p = (known && PALETTE[submission.status]) || FALLBACK;
  const Icon = p.Icon;

  const badgeText = known ? t(`badge.${submission.status}`) : t('badge.UNKNOWN');
  const title = known ? t(`title.${submission.status}`) : t('title.UNKNOWN');
  const hintKey = submission.status === 'SUBMITTED' || submission.status === 'PROCESSING' || submission.status === 'FAILED'
    ? `hint.${submission.status}` : null;
  const hint = hintKey ? t(hintKey) : null;
  const channel = submission.channel === 'CORETAX_API' ? t('channel.api') : t('channel.manual');

  return (
    <div className={cn('rounded-2xl border p-5', p.wrap)}>
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full', p.badge)}>
          <Icon className={cn('h-5 w-5', submission.status === 'PROCESSING' || submission.status === 'BPE_UPLOADED' ? 'animate-spin' : '')} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', p.badge)}>{badgeText}</span>
            <span className="text-[11px] text-slate-500">{t('field.channel')}: {channel}</span>
          </div>
          <p className="mt-1 text-sm font-black text-slate-900">{title}</p>
          {hint && submission.status !== 'FAILED' && <p className="mt-1 text-[12px] text-slate-600">{hint}</p>}
        </div>
      </div>

      {submission.status === 'COMPLETED' && (submission.bpe_number || submission.ntpn) && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {submission.bpe_number && (
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{t('field.bpeNumber')}</p>
              <p className="mt-1 font-mono text-sm font-black text-slate-900">{submission.bpe_number}</p>
              {submission.bpe_uploaded_at && <p className="text-[10px] text-slate-500">{fmtTs(submission.bpe_uploaded_at)}</p>}
            </div>
          )}
          {submission.ntpn && (
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{t('field.ntpn')}</p>
              <p className="mt-1 font-mono text-sm font-black text-slate-900">{submission.ntpn}</p>
            </div>
          )}
        </div>
      )}

      {submission.status === 'FAILED' && submission.failure_reason && (
        <div className="mt-3 rounded-xl bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-700">{t('field.failureReason')}</p>
          <p className="mt-1 text-[12px] text-slate-700 break-all">{hint ? `${hint} ` : ''}{submission.failure_reason}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-1 text-[11px] text-slate-500 sm:grid-cols-3">
        <div>{t('field.submittedAt')}: <span className="font-mono text-slate-700">{fmtTs(submission.submitted_at)}</span></div>
        {submission.bpe_uploaded_at && (
          <div>{t('field.bpeUploadedAt')}: <span className="font-mono text-slate-700">{fmtTs(submission.bpe_uploaded_at)}</span></div>
        )}
        {submission.completed_at && (
          <div>{t('field.completedAt')}: <span className="font-mono text-slate-700">{fmtTs(submission.completed_at)}</span></div>
        )}
      </div>
    </div>
  );
}
