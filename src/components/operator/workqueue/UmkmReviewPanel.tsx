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
      else setError('상세 자료를 불러오지 못했습니다.');
    } catch { setError('상세 자료를 불러오지 못했습니다.'); }
  }, [queueId]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (detail?.rows ?? []).filter(r =>
    !statusF || r.paymentStatus === statusF), [detail, statusF]);

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
        <div><h1>{t('umkmTitle')}</h1><p>{detail.period} 귀속분 · 선납법인세 월 납부 검토</p></div>
        <ApprovalActions queueId={queueId} onChanged={load} />
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>{t('umkmRecordCount')}</small><b>{s.recordCount}건</b></div>
          <div className={styles.metric2}><small>{t('umkmTotalDue')}</small><b>{rp(s.totalDue)}</b></div>
          <div className={styles.metric2}><small>{t('umkmTotalPaid')}</small><b>{rp(s.totalPaid)}</b></div>
          <div className={styles.metric2}><small>미완료</small><b>{s.incompleteCount}건</b></div>
        </div>

        <AiPreReviewBox queueId={queueId} taxView="umkm" period={detail.period} summary={s} rows={detail.rows} />

        <div className={styles.toolbar}>
          <div>
            <select value={statusF} onChange={e => setStatusF(e.target.value as '' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'PARTIAL')}>
              <option value="">전체 납부상태</option>
              <option value="UNPAID">미납</option>
              <option value="OVERDUE">연체</option>
              <option value="PARTIAL">부분납</option>
              <option value="PAID">완납</option>
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
  const taxText = row.taxType === 'PPh25' ? 'PPh 25' : 'PPh Final';
  return (
    <RequestChatModal
      toLabel={taxText}
      contextLabel={`선납법인세 · ${row.flags.label}`}
      defaultMessage={`${taxText} 선납분의 ${row.flags.label} 관련 자료를 확인 부탁드립니다.`}
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
