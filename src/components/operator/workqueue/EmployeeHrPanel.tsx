'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { RequestChatModal } from './RequestChatModal';
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
  const tw = useTranslations('workqueue');
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
      else setError(tw('loadDetailFailed'));
    } catch { setError(tw('loadDetailFailed')); }
  }, [queueId, tw]);
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
      <button className={styles.btn} onClick={() => load()}>{tw('retry')}</button>
    </div></div>
  );
  if (!detail) return <div className={styles.card}><div className={styles.body}>{tw('loading')}</div></div>;
  const s = detail.summary;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h1>{t('employeesTitle')}</h1>
          <p>{tw('empHrSubtitle')}</p>
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>{tw('metricTotalEmployees')}</small><b>{tw('unitPeople', { count: s.employeeCount })}</b></div>
          <div className={styles.metric2}><small>{tw('active')}</small><b>{tw('unitPeople', { count: s.activeCount })}</b></div>
          <div className={styles.metric2}><small>{tw('metricNoNpwp')}</small><b>{tw('unitPeople', { count: s.noNpwpCount })}</b></div>
          <div className={styles.metric2}><small>{tw('metricIssues')}</small><b>{tw('unitCases', { count: s.issueCount })}</b></div>
        </div>

        <AiPreReviewBox queueId={queueId} taxView="employees" period={detail.period}
          summary={s} rows={detail.rows} />

        <div className={styles.toolbar}>
          <div>
            <select value={activeF} onChange={e => setActiveF(e.target.value as '' | 'active' | 'inactive' | 'issues')}>
              <option value="">{tw('filterAllEmployees')}</option>
              <option value="active">{tw('filterActiveOnly')}</option>
              <option value="inactive">{tw('filterInactiveOnly')}</option>
              <option value="issues">{tw('filterIssuesOnly')}</option>
            </select>
          </div>
        </div>

        <EmployeeHrTable rows={rows} onRequest={setRequestRow} />

        {detail.changeLog.length > 0 && (
          <div className={styles.panel}>
            <h3>{tw('recentHrChanges')}</h3>
            <div className={styles.req}>
              {detail.changeLog.map(c => (
                <div key={c.id} className={styles.reqi}>
                  <b>{c.employeeName} · {c.section}/{c.field}</b>
                  <span>{c.oldValue ?? tw('noneParen')} → {c.newValue ?? tw('noneParen')} · {c.changedAt?.slice(0, 10)}</span>
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
  const tw = useTranslations('workqueue');
  return (
    <RequestChatModal
      toLabel={row.name}
      contextLabel={tw('reqCtxEmployee', { label: row.flags.label })}
      defaultMessage={tw('reqMsgEmployee', { name: row.name, label: row.flags.label })}
      onSend={async (message) => {
        await fetch(`/api/operator/workqueue/${queueId}/request`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: row.id, message }),
        });
        onSent();
      }}
      onClose={onClose}
    />
  );
}
