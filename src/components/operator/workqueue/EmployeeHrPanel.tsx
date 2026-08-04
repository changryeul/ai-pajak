'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { EmployeeHrTable } from './EmployeeHrTable';
import { AiPreReviewBox } from './AiPreReviewBox';
import type { EmployeeHrDetail, EmployeeHrRow } from './types';

/**
 * 직원 인사 기록 검토 패널 — 급여(PPh21) 검토의 입력이 되는 직원 마스터의
 * 정합성(PTKP/NPWP/NIK/급여)을 확인한다. worklist 는 PPh21 큐 행을 공유하되,
 * 승인/반려는 개인소득세 뷰에서 하므로 여기엔 ApprovalActions 를 두지 않는다.
 */
export function EmployeeHrPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const [detail, setDetail] = useState<EmployeeHrDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeF, setActiveF] = useState<'' | 'active' | 'inactive' | 'issues'>('');
  const [requestRow, setRequestRow] = useState<EmployeeHrRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/employees`);
      const j = await r.json();
      if (j.success) setDetail(j.data as EmployeeHrDetail);
      else setError('상세 자료를 불러오지 못했습니다.');
    } catch { setError('상세 자료를 불러오지 못했습니다.'); }
  }, [queueId]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (detail?.rows ?? []).filter(r => {
    if (activeF === 'active') return r.isActive;
    if (activeF === 'inactive') return !r.isActive;
    if (activeF === 'issues') return r.flags.level !== 'green';
    return true;
  }), [detail, activeF]);

  if (error) return (
    <div className={styles.card}><div className={styles.body}>
      <div className={styles.blocked}>{error}</div>
      <button className={styles.btn} onClick={() => load()}>다시 시도</button>
    </div></div>
  );
  if (!detail) return <div className={styles.card}><div className={styles.body}>불러오는 중…</div></div>;
  const s = detail.summary;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h1>{t('employeesTitle')}</h1>
          <p>직원 마스터 정합성 검토 — PPh21 급여 계산의 입력 (PTKP · NPWP · NIK · 급여)</p>
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>전체 직원</small><b>{s.employeeCount}명</b></div>
          <div className={styles.metric2}><small>재직</small><b>{s.activeCount}명</b></div>
          <div className={styles.metric2}><small>무-NPWP (가산 대상)</small><b>{s.noNpwpCount}명</b></div>
          <div className={styles.metric2}><small>이슈</small><b>{s.issueCount}건</b></div>
        </div>

        <AiPreReviewBox queueId={queueId} taxView="employees" period={detail.period}
          summary={s} rows={detail.rows} />

        <div className={styles.toolbar}>
          <div>
            <select value={activeF} onChange={e => setActiveF(e.target.value as '' | 'active' | 'inactive' | 'issues')}>
              <option value="">전체 직원</option>
              <option value="active">재직만</option>
              <option value="inactive">퇴사/비활성만</option>
              <option value="issues">이슈만</option>
            </select>
          </div>
        </div>

        <EmployeeHrTable rows={rows} onRequest={setRequestRow} />

        {detail.changeLog.length > 0 && (
          <div className={styles.panel}>
            <h3>최근 인사 변경 이력</h3>
            <div className={styles.req}>
              {detail.changeLog.map(c => (
                <div key={c.id} className={styles.reqi}>
                  <b>{c.employeeName} · {c.section}/{c.field}</b>
                  <span>{c.oldValue ?? '(없음)'} → {c.newValue ?? '(없음)'} · {c.changedAt?.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {requestRow && (
        <RequestModal key={requestRow.id} row={requestRow} queueId={queueId}
          onClose={() => setRequestRow(null)}
          onSent={async () => { setRequestRow(null); await load(); onChanged(); }} />
      )}
    </div>
  );
}

function RequestModal({ row, queueId, onClose, onSent }:
  { row: EmployeeHrRow; queueId: string; onClose: () => void; onSent: () => void }) {
  const [msg, setMsg] = useState(
    `직원 "${row.name}" 인사 기록의 "${row.flags.label}" 항목 확인·보완을 부탁드립니다.`);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const send = async () => {
    setSending(true);
    try {
      await fetch(`/api/operator/workqueue/${queueId}/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: row.id, message: msg }),
      });
      onSent();
    } finally { setSending(false); }
  };
  return (
    <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>고객에게 요청</h2>
        <div className={styles.mb}>
          <label>대상 직원<input readOnly value={row.name} /></label>
          <label>고객에게 보낼 메시지<textarea value={msg} onChange={e => setMsg(e.target.value)} /></label>
        </div>
        <div className={styles.mf}>
          <button className={styles.btn} onClick={onClose}>취소</button>
          <button className={`${styles.btn} ${styles.blue}`} onClick={send} disabled={sending}>고객에게 표시</button>
        </div>
      </div>
    </div>
  );
}
