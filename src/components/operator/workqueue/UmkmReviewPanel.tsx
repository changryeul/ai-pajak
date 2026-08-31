'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { RequestChatModal } from './RequestChatModal';
import { UmkmReviewTable } from './UmkmReviewTable';
import { AiPreReviewBox } from './AiPreReviewBox';
import { ApprovalActions } from './ApprovalActions';
import type { UmkmDetail, UmkmRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

export function UmkmReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const tw = useTranslations('workqueue');
  const [detail, setDetail] = useState<UmkmDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusF, setStatusF] = useState<'' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'PARTIAL'>('');
  const [requestRow, setRequestRow] = useState<UmkmRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/umkm`);
      const j = await r.json();
      if (j.success) setDetail(j.data as UmkmDetail);
      else setError(tw('loadDetailFailed'));
    } catch { setError(tw('loadDetailFailed')); }
  }, [queueId, tw]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (detail?.rows ?? []).filter(r =>
    !statusF || r.paymentStatus === statusF), [detail, statusF]);

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
        <div><h1>{t('umkmTitle')}</h1><p>{tw('subUmkm', { period: detail.period })}</p></div>
        <ApprovalActions queueId={queueId} onChanged={load} />
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>{t('umkmRecordCount')}</small><b>{tw('unitCases', { count: s.recordCount })}</b></div>
          <div className={styles.metric2}><small>{t('umkmTotalDue')}</small><b>{rp(s.totalDue)}</b></div>
          <div className={styles.metric2}><small>{t('umkmTotalPaid')}</small><b>{rp(s.totalPaid)}</b></div>
          <div className={styles.metric2}><small>{tw('incomplete')}</small><b>{tw('unitCases', { count: s.incompleteCount })}</b></div>
        </div>

        <AiPreReviewBox queueId={queueId} taxView="umkm" period={detail.period} summary={s} rows={detail.rows} />

        <div className={styles.toolbar}>
          <div>
            <select value={statusF} onChange={e => setStatusF(e.target.value as '' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'PARTIAL')}>
              <option value="">{tw('filterAllPaymentStatus')}</option>
              <option value="UNPAID">{tw('unpaid')}</option>
              <option value="OVERDUE">{tw('overdue')}</option>
              <option value="PARTIAL">{tw('partial')}</option>
              <option value="PAID">{tw('paid')}</option>
            </select>
          </div>
        </div>

        <UmkmReviewTable rows={rows} onRequest={setRequestRow} />
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
  { row: UmkmRow; queueId: string; onClose: () => void; onSent: () => void }) {
  const tw = useTranslations('workqueue');
  const taxText = row.taxType === 'PPh25' ? 'PPh 25' : 'PPh Final';
  return (
    <RequestChatModal
      toLabel={taxText}
      contextLabel={tw('reqCtxUmkm', { label: row.flags.label })}
      defaultMessage={tw('reqMsgUmkm', { taxText, label: row.flags.label })}
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
