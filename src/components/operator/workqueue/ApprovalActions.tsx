'use client';
import { useCallback, useEffect, useState } from 'react';
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
      setError((j as { error?: string }).error || `요청 실패 (${r.status})`);
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
      setError('네트워크 오류 — 다시 시도해주세요.');
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
        setError((j as { error?: string }).error || `예외 발행 실패 (${r.status})`);
        return;
      }
      await load();
      onChanged();
    } catch {
      setError('네트워크 오류 — 다시 시도해주세요.');
    } finally { setBusy(false); }
  };

  if (!state) return null;
  const { status, rejectedReason, canApprove, requestNote } = state;
  // 아직 발행되지 않은(승인 전/승인대기) 상태에서만 예외 발행 노출.
  const canException = ['PENDING', 'PENDING_DOCS', 'DATA_REVIEW', 'PENDING_APPROVAL'].includes(status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {rejectedReason && (
        <div className={styles.blocked} style={{ maxWidth: 360 }}>반려 사유: {rejectedReason}</div>
      )}
      {error && (
        <div className={styles.blocked} style={{ maxWidth: 360 }}>{error}</div>
      )}

      {/* 수퍼바이저에게 남긴 승인요청 코멘트 — 승인 판단 컨텍스트 (요청 9) */}
      {status === 'PENDING_APPROVAL' && requestNote && (
        <div className={styles.requestNote}>상담원 요청: {requestNote}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {status === 'APPROVED' && <span className={`${styles.badge} ${styles.green}`}>✅ 승인완료</span>}

        {status === 'PENDING_APPROVAL' && canApprove && (
          <>
            <button className={`${styles.btn} ${styles.green}`} disabled={busy} onClick={() => act('approve')}>승인</button>
            <button className={`${styles.btn} ${styles.red}`} disabled={busy} onClick={() => setRejecting(true)}>반려</button>
          </>
        )}

        {status === 'PENDING_APPROVAL' && !canApprove && (
          <span className={`${styles.badge} ${styles.amber}`}>승인 대기 중</span>
        )}

        {(status === 'PENDING' || status === 'DATA_REVIEW' || status === 'PENDING_DOCS') && (
          hasIssues
            ? <span className={`${styles.badge} ${styles.red}`} title="이슈 항목을 먼저 처리한 뒤 승인요청할 수 있습니다">⚠️ 이슈 처리 후 승인요청</span>
            : <button className={`${styles.btn} ${styles.purple}`} disabled={busy} onClick={() => setRequesting(true)}>승인요청</button>
        )}

        {canApprove && status !== 'APPROVED' && (
          <button className={styles.btn} disabled={busy} onClick={() => setReassigning(true)}>재배정</button>
        )}

        {/* 수정요청 26 — 승인 없이 예외 발행 (사유 필수 + 감사 + 수퍼바이저 통지) */}
        {canException && (
          <button className={`${styles.btn} ${styles.amber}`} disabled={busy}
            onClick={() => setExcepting(true)} title="수퍼바이저 승인 없이 발행 (사유 기록·통지)">예외 발행</button>
        )}
      </div>

      {/* 수정요청 29·32·35 — 승인요청도 고객요청과 동일한 WhatsApp 스타일 모달 */}
      {requesting && (
        <RequestChatModal
          toLabel="수퍼바이저"
          subtitle="승인요청 메시지가 수퍼바이저 승인 화면에 표시됩니다"
          contextLabel="수퍼바이저에게 승인요청"
          defaultMessage="검토를 완료했습니다. 승인 부탁드립니다."
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
        <h2>담당 상담원 재배정</h2>
        <div className={styles.mb}>
          <label>재배정 대상 상담원
            <select value={target} onChange={e => setTarget(e.target.value)}>
              <option value="">상담원 선택</option>
              {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label>재배정 사유<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 담당자 휴가로 재배정" /></label>
        </div>
        <div className={styles.mf}>
          <button className={styles.btn} onClick={onClose}>취소</button>
          <button className={`${styles.btn} ${styles.blue}`} disabled={!target || !reason.trim()}
            onClick={() => onSubmit(target, reason.trim())}>재배정</button>
        </div>
      </div>
    </div>
  );
}

// 수정요청 26 — 예외 발행 사유 모달. 사유는 감사기록·수퍼바이저 통지에 각인.
function ExceptionIssueModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>승인 없이 예외 발행</h2>
        <div className={styles.blocked} style={{ marginBottom: 10 }}>
          수퍼바이저 승인 없이 ID Billing 을 발행합니다. 사유가 기록되고 수퍼바이저에게 통지됩니다.
        </div>
        <div className={styles.mb}>
          <label>예외 발행 사유 (필수, 5자 이상)
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="예: 고객 마감 임박 요청 — 담당 수퍼바이저 부재로 선발행 후 사후 보고." />
          </label>
        </div>
        <div className={styles.mf}>
          <button className={styles.btn} onClick={onClose}>취소</button>
          <button className={`${styles.btn} ${styles.amber}`} disabled={reason.trim().length < 5}
            onClick={() => onSubmit(reason.trim())}>예외 발행</button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>반려 사유</h2>
        <div className={styles.mb}>
          <label>상담원에게 전달할 반려 사유<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="예: PPh23 증빙이 누락되었습니다. 보완 후 재요청 부탁드립니다." /></label>
        </div>
        <div className={styles.mf}>
          <button className={styles.btn} onClick={onClose}>취소</button>
          <button className={`${styles.btn} ${styles.red}`} disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>반려</button>
        </div>
      </div>
    </div>
  );
}
