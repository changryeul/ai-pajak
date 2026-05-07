'use client';

/**
 * 결산 wizard 「제출 후」 상태 카드 — Phase E.
 *
 * Phase B에서 운영팀의 Coretax record-completion이 closing_submission을 자동
 * 갱신하므로, 고객은 wizard를 새로고침하면 신고완료 + BPE + NTPN을 바로 볼 수 있다.
 * 이 컴포넌트는 status에 따라 색상/메시지/노출되는 메타데이터가 자동으로 바뀐다.
 *
 * status 매핑:
 *   SUBMITTED        → 🟡 운영팀 검증 대기 (channel='RPA' 기본)
 *   OPERATOR_REVIEW  → 🟡 운영팀 검토 중
 *   PROCESSING       → 🔵 Coretax 처리 중 (운영팀이 ID Billing 발행 중)
 *   BPE_UPLOADED     → 🔵 BPE 업로드 완료 (NTPN 확인 대기)
 *   COMPLETED        → 🟢 신고완료 + BPE 번호 + NTPN 강조 표시
 *   FAILED           → 🔴 제출 실패 + failure_reason
 *   CANCELLED        → ⚪ 취소됨
 */

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
  badgeText: string;
  Icon: typeof CheckCircle2;
  title: string;
  hint?: string;
}

const PALETTE: Record<string, PaletteEntry> = {
  SUBMITTED: {
    wrap: 'border-amber-200 bg-amber-50',
    badge: 'bg-amber-100 text-amber-800',
    badgeText: '운영팀 대기',
    Icon: Clock,
    title: '제출 완료 — 운영팀 검증 대기',
    hint: '운영팀이 Coretax 처리를 시작하면 자동으로 다음 단계로 넘어갑니다.',
  },
  OPERATOR_REVIEW: {
    wrap: 'border-amber-200 bg-amber-50',
    badge: 'bg-amber-100 text-amber-800',
    badgeText: '운영팀 검토',
    Icon: Clock,
    title: '운영팀 검토 중',
  },
  PROCESSING: {
    wrap: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    badgeText: 'Coretax 처리',
    Icon: Loader2,
    title: 'Coretax에서 ID Billing 발행 중',
    hint: '운영팀이 DJP Coretax에서 처리 중입니다. 완료되면 BPE/NTPN이 자동으로 채워집니다.',
  },
  BPE_UPLOADED: {
    wrap: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    badgeText: 'BPE 업로드',
    Icon: Loader2,
    title: 'BPE 업로드 완료 — NTPN 확인 대기',
  },
  COMPLETED: {
    wrap: 'border-emerald-300 bg-emerald-50',
    badge: 'bg-emerald-600 text-white',
    badgeText: '신고완료',
    Icon: CheckCircle2,
    title: 'SPT 신고가 정상 접수되었습니다',
  },
  FAILED: {
    wrap: 'border-rose-300 bg-rose-50',
    badge: 'bg-rose-600 text-white',
    badgeText: '제출 실패',
    Icon: AlertCircle,
    title: '제출 처리 중 오류가 발생했습니다',
    hint: '운영팀이 곧 연락드립니다. 오류 정보:',
  },
  CANCELLED: {
    wrap: 'border-slate-200 bg-slate-50',
    badge: 'bg-slate-200 text-slate-700',
    badgeText: '취소됨',
    Icon: X,
    title: '제출이 취소되었습니다',
  },
};

const fallback: PaletteEntry = {
  wrap: 'border-slate-200 bg-slate-50',
  badge: 'bg-slate-200 text-slate-700',
  badgeText: '상태 미정',
  Icon: Clock,
  title: '상태 정보 없음',
};

const fmtTs = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function ClosingSubmissionStatus({ submission }: { submission: ClosingSubmissionData }) {
  const p = PALETTE[submission.status] ?? fallback;
  const Icon = p.Icon;
  const channel = submission.channel === 'CORETAX_API' ? 'Coretax API 자동' : 'RPA / 수동';

  return (
    <div className={cn('rounded-2xl border p-5', p.wrap)}>
      {/* 헤더 */}
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full', p.badge)}>
          <Icon className={cn('h-5 w-5', submission.status === 'PROCESSING' || submission.status === 'BPE_UPLOADED' ? 'animate-spin' : '')} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', p.badge)}>{p.badgeText}</span>
            <span className="text-[11px] text-slate-500">채널: {channel}</span>
          </div>
          <p className="mt-1 text-sm font-black text-slate-900">{p.title}</p>
          {p.hint && submission.status !== 'FAILED' && (
            <p className="mt-1 text-[12px] text-slate-600">{p.hint}</p>
          )}
        </div>
      </div>

      {/* 신고완료 시 강조 박스 — BPE/NTPN */}
      {submission.status === 'COMPLETED' && (submission.bpe_number || submission.ntpn) && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {submission.bpe_number && (
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">BPE 번호</p>
              <p className="mt-1 font-mono text-sm font-black text-slate-900">{submission.bpe_number}</p>
              {submission.bpe_uploaded_at && (
                <p className="text-[10px] text-slate-500">{fmtTs(submission.bpe_uploaded_at)}</p>
              )}
            </div>
          )}
          {submission.ntpn && (
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">NTPN (납부번호)</p>
              <p className="mt-1 font-mono text-sm font-black text-slate-900">{submission.ntpn}</p>
            </div>
          )}
        </div>
      )}

      {/* 실패 시 — 사유 표시 */}
      {submission.status === 'FAILED' && submission.failure_reason && (
        <div className="mt-3 rounded-xl bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-700">실패 사유</p>
          <p className="mt-1 text-[12px] text-slate-700 break-all">{submission.failure_reason}</p>
        </div>
      )}

      {/* 타임라인 */}
      <div className="mt-4 grid grid-cols-1 gap-1 text-[11px] text-slate-500 sm:grid-cols-3">
        <div>제출 시각: <span className="font-mono text-slate-700">{fmtTs(submission.submitted_at)}</span></div>
        {submission.bpe_uploaded_at && (
          <div>BPE 업로드: <span className="font-mono text-slate-700">{fmtTs(submission.bpe_uploaded_at)}</span></div>
        )}
        {submission.completed_at && (
          <div>완료 시각: <span className="font-mono text-slate-700">{fmtTs(submission.completed_at)}</span></div>
        )}
      </div>
    </div>
  );
}
