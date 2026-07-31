'use client';
import { useCallback, useEffect, useState } from 'react';
import styles from './workqueue.module.css';

interface ApprovalState {
  status: string;
  rejectedReason: string | null;
  approvedAt: string | null;
  canApprove: boolean;
}

export function ApprovalActions({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const [state, setState] = useState<ApprovalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/approval`);
      const j = await r.json();
      if (j.success) setState(j.data as ApprovalState);
    } catch { /* keep previous state */ }
  }, [queueId]);
  useEffect(() => { load(); }, [load]);

  const act = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    try {
      await fetch('/api/operator/queue', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: queueId, action, ...extra }),
      });
      await load();
      onChanged();
    } finally { setBusy(false); }
  };

  if (!state) return null;
  const { status, rejectedReason, canApprove } = state;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {rejectedReason && (
        <div className={styles.blocked} style={{ maxWidth: 360 }}>반려 사유: {rejectedReason}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {status === 'APPROVED' && <span className={`${styles.badge} ${styles.green}`}>✅ 승인 완료</span>}

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
          <button className={`${styles.btn} ${styles.purple}`} disabled={busy} onClick={() => act('request-approval')}>고객 검토완료</button>
        )}
      </div>

      {rejecting && (
        <RejectModal
          onClose={() => setRejecting(false)}
          onSubmit={async (reason) => { setRejecting(false); await act('reject', { rejectedReason: reason }); }}
        />
      )}
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
