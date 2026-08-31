'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { RequestChatModal } from './RequestChatModal';

interface ApprovalState {
  status: string;
  rejectedReason: string | null;
  approvedAt: string | null;
  canApprove: boolean;
  requestNote?: string | null;
}

// hasIssues (수정요청 30·33·36): 리스트에 이슈(red) 행이 있으면 승인요청을 막는다.
export function ApprovalActions({ queueId, hasIssues = false, onChanged }:
  { queueId: string; hasIssues?: boolean; onChanged: () => void }) {
  const tw = useTranslations('workqueue');
  const [state, setState] = useState<ApprovalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [requesting, setRequesting] = useState(false); // 승인요청 코멘트 모달 (요청 9·17)
  const [excepting, setExcepting] = useState(false);    // 예외 발행 사유 모달 (요청 26)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/approval`);
      const j = await r.json();
      if (j.success) setState(j.data as ApprovalState);
    } catch { /* keep previous state */ }
  }, [queueId]);
  useEffect(() => { load(); }, [load]);

  // 실패를 조용히 삼키지 않는다 — 상태기계 400 등을 상담원에게 그대로 보인다.
  const call = async (action: string, extra?: Record<string, unknown>): Promise<boolean> => {
    const r = await fetch('/api/operator/queue', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: queueId, action, ...extra }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      setError((j as { error?: string }).error || tw('requestFailedStatus', { status: r.status }));
      return false;
    }
    return true;
  };

  const act = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      // 자동 큐 생성 항목은 PENDING(또는 자료요청 후 PENDING_DOCS) 에서 시작 —
      // 검토완료 요청 전에 검토 시작(review) 전이를 선행한다.
      if (action === 'request-approval' && (state?.status === 'PENDING' || state?.status === 'PENDING_DOCS')) {
        if (!(await call('review'))) { await load(); return; }
      }
      await call(action, extra);
      await load();
      onChanged();
    } catch {
      setError(tw('networkError'));
    } finally { setBusy(false); }
  };

  // 수정요청 26 — 승인 없이 예외 발행. 워크큐 큐 = OPERATOR_QUEUE, sourceId = queueId.
  const doExceptionIssue = async (reason: string) => {
    setExcepting(false);
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/id-billing/issue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKind: 'OPERATOR_QUEUE', sourceId: queueId, exception: true, exceptionReason: reason }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        setError((j as { error?: string }).error || tw('exceptionIssueFailedStatus', { status: r.status }));
        return;
      }
      await load();
      onChanged();
    } catch {
      setError(tw('networkError'));
    } finally { setBusy(false); }
  };

  if (!state) return null;
  const { status, rejectedReason, canApprove, requestNote } = state;
  // 아직 발행되지 않은(승인 전/승인대기) 상태에서만 예외 발행 노출.
  const canException = ['PENDING', 'PENDING_DOCS', 'DATA_REVIEW', 'PENDING_APPROVAL'].includes(status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {rejectedReason && (
        <div className={styles.blocked} style={{ maxWidth: 360 }}>{tw('rejectReasonPrefix', { reason: rejectedReason })}</div>
      )}
      {error && (
        <div className={styles.blocked} style={{ maxWidth: 360 }}>{error}</div>
      )}

      {/* 수퍼바이저에게 남긴 승인요청 코멘트 — 승인 판단 컨텍스트 (요청 9) */}
      {status === 'PENDING_APPROVAL' && requestNote && (
        <div className={styles.requestNote}>{tw('counselorRequestPrefix', { note: requestNote })}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {status === 'APPROVED' && <span className={`${styles.badge} ${styles.green}`}>✅ {tw('approvedBadge')}</span>}

        {status === 'PENDING_APPROVAL' && canApprove && (
          <>
            <button className={`${styles.btn} ${styles.green}`} disabled={busy} onClick={() => act('approve')}>{tw('approve')}</button>
            <button className={`${styles.btn} ${styles.red}`} disabled={busy} onClick={() => setRejecting(true)}>{tw('reject')}</button>
          </>
        )}

        {status === 'PENDING_APPROVAL' && !canApprove && (
          <span className={`${styles.badge} ${styles.amber}`}>{tw('awaitingApproval')}</span>
        )}

        {(status === 'PENDING' || status === 'DATA_REVIEW' || status === 'PENDING_DOCS') && (
          hasIssues
            ? <span className={`${styles.badge} ${styles.red}`} title={tw('requestApprovalAfterIssuesTitle')}>⚠️ {tw('requestApprovalAfterIssues')}</span>
            : <button className={`${styles.btn} ${styles.purple}`} disabled={busy} onClick={() => setRequesting(true)}>{tw('requestApproval')}</button>
        )}

        {canApprove && status !== 'APPROVED' && (
          <button className={styles.btn} disabled={busy} onClick={() => setReassigning(true)}>{tw('reassign')}</button>
        )}

        {/* 수정요청 26 — 승인 없이 예외 발행 (사유 필수 + 감사 + 수퍼바이저 통지) */}
        {canException && (
          <button className={`${styles.btn} ${styles.amber}`} disabled={busy}
            onClick={() => setExcepting(true)} title={tw('exceptionIssueTitle')}>{tw('exceptionIssue')}</button>
        )}
      </div>

      {/* 수정요청 29·32·35 — 승인요청도 고객요청과 동일한 WhatsApp 스타일 모달 */}
      {requesting && (
        <RequestChatModal
          toLabel={tw('supervisor')}
          subtitle={tw('approvalRequestSubtitle')}
          contextLabel={tw('approvalRequestContext')}
          defaultMessage={tw('approvalRequestDefault')}
          onClose={() => setRequesting(false)}
          onSend={async (note) => {
            setRequesting(false);
            await act('request-approval', note ? { notes: note } : undefined);
          }}
        />
      )}

      {rejecting && (
        <RejectModal
          onClose={() => setRejecting(false)}
          onSubmit={async (reason) => { setRejecting(false); await act('reject', { rejectedReason: reason }); }}
        />
      )}

      {excepting && (
        <ExceptionIssueModal
          onClose={() => setExcepting(false)}
          onSubmit={doExceptionIssue}
        />
      )}

      {reassigning && (
        <ReassignModal
          onClose={() => setReassigning(false)}
          onSubmit={async (targetOperatorId, reassignmentReason) => {
            setReassigning(false);
            await act('reassign', { targetOperatorId, reassignmentReason });
          }}
        />
      )}
    </div>
  );
}

function ReassignModal({ onClose, onSubmit }:
  { onClose: () => void; onSubmit: (targetOperatorId: string, reason: string) => void }) {
  const tw = useTranslations('workqueue');
  const [operators, setOperators] = useState<Array<{ id: string; name: string }>>([]);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/operator/workqueue/operators');
        const j = await r.json();
        if (j.success) setOperators(j.data.operators as Array<{ id: string; name: string }>);
      } catch { /* dropdown just stays empty */ }
    })();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>{tw('reassignTitle')}</h2>
        <div className={styles.mb}>
          <label>{tw('reassignTargetLabel')}
            <select value={target} onChange={e => setTarget(e.target.value)}>
              <option value="">{tw('selectCounselor')}</option>
              {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label>{tw('reassignReasonLabel')}<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={tw('reassignReasonPlaceholder')} /></label>
        </div>
        <div className={styles.mf}>
          <button className={styles.btn} onClick={onClose}>{tw('cancel')}</button>
          <button className={`${styles.btn} ${styles.blue}`} disabled={!target || !reason.trim()}
            onClick={() => onSubmit(target, reason.trim())}>{tw('reassign')}</button>
        </div>
      </div>
    </div>
  );
}

// 수정요청 26 — 예외 발행 사유 모달. 사유는 감사기록·수퍼바이저 통지에 각인.
function ExceptionIssueModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string) => void }) {
  const tw = useTranslations('workqueue');
  const [reason, setReason] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-[min(460px,94vw)] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 — amber 경고 톤 */}
        <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-amber-700">⚠️</span>
          <div>
            <h2 className="text-base font-black text-amber-900">{tw('exceptionModalTitle')}</h2>
            <p className="text-[11px] text-amber-700">{tw('exceptionModalSubtitle')}</p>
          </div>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
            {tw('exceptionModalNote')}
          </p>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{tw('exceptionReasonLabel')} <span className="text-red-500">*</span> <span className="font-normal text-slate-400">{tw('minChars5')}</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              placeholder={tw('exceptionReasonPlaceholder')} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-gray-50">{tw('cancel')}</button>
          <button disabled={reason.trim().length < 5} onClick={() => onSubmit(reason.trim())}
            className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40">
            {tw('exceptionIssue')}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string) => void }) {
  const tw = useTranslations('workqueue');
  const [reason, setReason] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>{tw('rejectTitle')}</h2>
        <div className={styles.mb}>
          <label>{tw('rejectReasonLabel')}<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={tw('rejectReasonPlaceholder')} /></label>
        </div>
        <div className={styles.mf}>
          <button className={styles.btn} onClick={onClose}>{tw('cancel')}</button>
          <button className={`${styles.btn} ${styles.red}`} disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>{tw('reject')}</button>
        </div>
      </div>
    </div>
  );
}
