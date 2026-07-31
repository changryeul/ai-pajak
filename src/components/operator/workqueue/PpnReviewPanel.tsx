'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { PpnReviewTable } from './PpnReviewTable';
import { AiPreReviewBox } from './AiPreReviewBox';
import type { PpnDetail, PpnRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

export function PpnReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const [detail, setDetail] = useState<PpnDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dir, setDir] = useState<'' | 'KELUARAN' | 'MASUKAN'>('');
  const [recon, setRecon] = useState<'' | 'MATCH' | 'DIFF' | 'MISSING' | 'PENDING'>('');
  const [requestRow, setRequestRow] = useState<PpnRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/ppn`);
      const j = await r.json();
      if (j.success) setDetail(j.data as PpnDetail);
      else setError('상세 자료를 불러오지 못했습니다.');
    } catch { setError('상세 자료를 불러오지 못했습니다.'); }
  }, [queueId]);
  useEffect(() => { load(); }, [load]);

  const act = async (action: string) => {
    try {
      await fetch('/api/operator/queue', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: queueId, action }),
      });
      await load(); onChanged();
    } catch { setError('상태 변경에 실패했습니다.'); }
  };

  const matchRecon = (status: string | null): boolean => {
    if (!recon) return true;
    if (recon === 'MISSING') return status === 'MISSING_CORETAX' || status === 'MISSING_CUSTOMER';
    if (recon === 'PENDING') return !status || status === 'PENDING';
    return status === recon;
  };
  const rows = useMemo(() => (detail?.rows ?? []).filter(r =>
    (!dir || r.fakturType === dir) && matchRecon(r.reconStatus)), [detail, dir, recon]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <div><h1>{t('ppnTitle')}</h1><p>{detail.period} 귀속분 · 부가세 faktur 검토</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <button className={`${styles.btn} ${styles.purple}`} onClick={() => act('request-approval')}>고객 검토완료</button>
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>{t('ppnFakturCount')}</small><b>{s.fakturCount}건</b></div>
          <div className={styles.metric2}><small>{t('ppnTotalDpp')}</small><b>{rp(s.totalDpp)}</b></div>
          <div className={styles.metric2}><small>{t('ppnTotalPpn')}</small><b>{rp(s.totalPpn)}</b></div>
          <div className={styles.metric2}><small>미완료</small><b>{s.incompleteCount}건</b></div>
        </div>

        <AiPreReviewBox queueId={queueId} taxView="ppn" period={detail.period} summary={s} rows={detail.rows} />

        <div className={styles.toolbar}>
          <div>
            <select value={dir} onChange={e => setDir(e.target.value as '' | 'KELUARAN' | 'MASUKAN')}>
              <option value="">전체 방향</option>
              <option value="KELUARAN">매출 (Keluaran)</option>
              <option value="MASUKAN">매입 (Masukan)</option>
            </select>
            <select value={recon} onChange={e => setRecon(e.target.value as '' | 'MATCH' | 'DIFF' | 'MISSING' | 'PENDING')}>
              <option value="">전체 대조상태</option>
              <option value="MATCH">일치</option>
              <option value="DIFF">불일치</option>
              <option value="MISSING">누락</option>
              <option value="PENDING">미대조</option>
            </select>
          </div>
        </div>

        <PpnReviewTable rows={rows} onRequest={setRequestRow} />
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
  { row: PpnRow; queueId: string; onClose: () => void; onSent: () => void }) {
  const [msg, setMsg] = useState(`${row.counterpartyName} faktur의 ${row.flags.label} 관련 자료를 확인 부탁드립니다.`);
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
          <label>대상 faktur<input readOnly value={row.fakturNumber ?? row.counterpartyName} /></label>
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
