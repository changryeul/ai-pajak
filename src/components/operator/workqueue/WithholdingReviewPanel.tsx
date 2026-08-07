'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { WithholdingReviewTable } from './WithholdingReviewTable';
import { AiPreReviewBox } from './AiPreReviewBox';
import { ApprovalActions } from './ApprovalActions';
import type { WithholdingDetail, WithholdingRow } from './types';
import { RowDetailModal, type FieldDef } from './RowDetailModal';
import { RequestChatModal } from './RequestChatModal';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

export function WithholdingReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const [detail, setDetail] = useState<WithholdingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regime, setRegime] = useState<'' | 'PPH23' | 'PPH4_2'>('');
  const [statusF, setStatusF] = useState<'' | 'red' | 'green'>('');
  const [requestRow, setRequestRow] = useState<WithholdingRow | null>(null);
  const [detailRow, setDetailRow] = useState<WithholdingRow | null>(null); // 더블클릭 상세 (요청 15)
  const [photo, setPhoto] = useState<{ url: string; isPdf: boolean } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/withholding`);
      const j = await r.json();
      if (j.success) setDetail(j.data as WithholdingDetail);
      else setError('상세 자료를 불러오지 못했습니다.');
    } catch { setError('상세 자료를 불러오지 못했습니다.'); }
  }, [queueId]);
  useEffect(() => { load(); }, [load]);

  const viewPhoto = async (row: WithholdingRow) => {
    try {
      const r = await fetch(`/api/tax/pph23-transactions/${row.id}/invoice-photo`);
      const j = await r.json();
      const url = j?.data?.signedUrl ?? null;
      if (url) setPhoto({ url, isPdf: String(j?.data?.mimeType ?? '').includes('pdf') });
    } catch { /* ignore — modal just won't open */ }
  };

  const rows = useMemo(() => (detail?.rows ?? []).filter(r =>
    (!regime || r.regime === regime) && (!statusF || r.flags.level === statusF)), [detail, regime, statusF]);

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
        <div><h1>{t('whTitle')}</h1><p>{detail.period} 귀속분 · 원천세 거래 검토</p></div>
        <ApprovalActions queueId={queueId} onChanged={load}
          hasIssues={(detail.rows ?? []).some(r => r.flags.level === 'red')} />
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>{t('whTxnCount')}</small><b>{s.txnCount}건</b></div>
          <div className={styles.metric2}><small>{t('whTotalGross')}</small><b>{rp(s.totalGross)}</b></div>
          <div className={styles.metric2}><small>{t('whTotalTax')}</small><b>{rp(s.totalTax)}</b></div>
          <div className={styles.metric2}><small>미완료</small><b>{s.incompleteCount}건</b></div>
        </div>

        <AiPreReviewBox queueId={queueId} taxView="withholding" period={detail.period} summary={s} rows={detail.rows} />

        <div className={styles.toolbar}>
          <div>
            <select value={regime} onChange={e => setRegime(e.target.value as '' | 'PPH23' | 'PPH4_2')}>
              <option value="">전체 세목</option>
              <option value="PPH23">PPh 23</option>
              <option value="PPH4_2">PPh 4(2)</option>
            </select>
            <select value={statusF} onChange={e => setStatusF(e.target.value as '' | 'red' | 'green')}>
              <option value="">전체 상태</option>
              <option value="red">요청 필요</option>
              <option value="green">확인 완료</option>
            </select>
          </div>
        </div>

        <WithholdingReviewTable rows={rows} onRequest={setRequestRow} onViewPhoto={viewPhoto} onOpenDetail={setDetailRow} />
      </div>

      {detailRow && (
        <RowDetailModal
          title={`원천세 거래 상세: ${detailRow.counterpartyName}`}
          subtitle={`${detailRow.regime === 'PPH4_2' ? 'PPh 4(2)' : 'PPh 23'} · 세율 ${(detailRow.taxRate * 100).toFixed(1)}% · 세액 자동 재계산`}
          rowId={detailRow.id}
          queueId={queueId}
          putUrl="/api/tax/pph23-transactions"
          putExtra={{ serviceType: detailRow.serviceType ?? undefined, counterpartyNpwp: detailRow.counterpartyNpwp ?? undefined }}
          fields={WHT_FIELDS}
          values={detailRow as unknown as Record<string, unknown>}
          operatorEdits={detailRow.operatorEdits}
          reviewedAt={detailRow.reviewedAt}
          aiNote={{ label: detailRow.flags.label, issues: detailRow.flags.issues }}
          onClose={() => setDetailRow(null)}
          onSaved={async () => { setDetailRow(null); await load(); onChanged(); }}
        />
      )}

      {requestRow && (
        <RequestModal key={requestRow.id} row={requestRow} queueId={queueId}
          onClose={() => setRequestRow(null)}
          onSent={async () => { setRequestRow(null); await load(); onChanged(); }} />
      )}
      {photo && (
        <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={() => setPhoto(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>증빙 미리보기</h2>
            <div className={styles.mb}>
              {photo.isPdf
                ? <iframe src={photo.url} title="증빙" style={{ width: '100%', height: 480, border: 0, borderRadius: 8 }} />
                // eslint-disable-next-line @next/next/no-img-element -- 5분 서명 URL, next/image 부적합
                : <img src={photo.url} alt="증빙" style={{ maxWidth: '100%', borderRadius: 8 }} />}
            </div>
            <div className={styles.mf}><button className={styles.btn} onClick={() => setPhoto(null)}>닫기</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// 팝업 편집 필드 (요청 15) — PUT /api/tax/pph23-transactions (camelCase, 세액 재계산 포함)
const WHT_FIELDS: FieldDef[] = [
  { key: 'counterpartyName', label: '거래처명', type: 'text' },
  { key: 'counterpartyNpwp', label: '거래처 NPWP', type: 'text' },
  { key: 'description', label: '거래 내용', type: 'text' },
  { key: 'invoiceNumber', label: '인보이스 번호', type: 'text' },
  { key: 'transactionDate', label: '거래일', type: 'date' },
  { key: 'grossAmount', label: '총 지급액 (세액 자동 재계산)', type: 'number' },
  { key: 'taxAmount', label: '세액 (자동계산)', type: 'number', readOnly: true },
];

function RequestModal({ row, queueId, onClose, onSent }:
  { row: WithholdingRow; queueId: string; onClose: () => void; onSent: () => void }) {
  return (
    <RequestChatModal
      toLabel={row.counterpartyName}
      contextLabel={`원천세 (${row.regime === 'PPH4_2' ? 'PPh 4(2)' : 'PPh 23'}) · ${row.flags.label}`}
      defaultMessage={`${row.counterpartyName} 거래의 ${row.flags.label} 관련 자료를 확인 부탁드립니다.`}
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
