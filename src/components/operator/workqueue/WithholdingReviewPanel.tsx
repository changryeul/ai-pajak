'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { WithholdingReviewTable } from './WithholdingReviewTable';
import { AiPreReviewBox } from './AiPreReviewBox';
import { ApprovalActions } from './ApprovalActions';
import type { WithholdingDetail, WithholdingRow } from './types';
import { RowDetailModal, type FieldDef } from './RowDetailModal';
import { useRequiredFields } from '@/hooks/useRequiredFields';
import { RequestChatModal } from './RequestChatModal';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

export function WithholdingReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const tw = useTranslations('workqueue');
  const { requiredKeys } = useRequiredFields('pph23');
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
      else setError(tw('loadDetailFailed'));
    } catch { setError(tw('loadDetailFailed')); }
  }, [queueId, tw]);
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
      <button className={styles.btn} onClick={() => load()}>{tw('retry')}</button>
    </div></div>
  );
  if (!detail) return <div className={styles.card}><div className={styles.body}>{tw('loading')}</div></div>;
  const s = detail.summary;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div><h1>{t('whTitle')}</h1><p>{tw('subWithholding', { period: detail.period })}</p></div>
        <ApprovalActions queueId={queueId} onChanged={load}
          hasIssues={(detail.rows ?? []).some(r => r.flags.level === 'red')} />
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>{t('whTxnCount')}</small><b>{tw('unitCases', { count: s.txnCount })}</b></div>
          <div className={styles.metric2}><small>{t('whTotalGross')}</small><b>{rp(s.totalGross)}</b></div>
          <div className={styles.metric2}><small>{t('whTotalTax')}</small><b>{rp(s.totalTax)}</b></div>
          <div className={styles.metric2}><small>{tw('incomplete')}</small><b>{tw('unitCases', { count: s.incompleteCount })}</b></div>
        </div>

        <AiPreReviewBox queueId={queueId} taxView="withholding" period={detail.period} summary={s} rows={detail.rows} />

        <div className={styles.toolbar}>
          <div>
            <select value={regime} onChange={e => setRegime(e.target.value as '' | 'PPH23' | 'PPH4_2')}>
              <option value="">{tw('filterAllTaxTypes')}</option>
              <option value="PPH23">PPh 23</option>
              <option value="PPH4_2">PPh 4(2)</option>
            </select>
            <select value={statusF} onChange={e => setStatusF(e.target.value as '' | 'red' | 'green')}>
              <option value="">{tw('filterAll')}</option>
              <option value="red">{tw('needsRequest')}</option>
              <option value="green">{tw('confirmed')}</option>
            </select>
          </div>
        </div>

        <WithholdingReviewTable rows={rows} onRequest={setRequestRow} onViewPhoto={viewPhoto} onOpenDetail={setDetailRow} />
      </div>

      {detailRow && (
        <RowDetailModal
          key={detailRow.id}
          title={tw('detailWhTitle', { name: detailRow.counterpartyName })}
          subtitle={tw('detailWhSubtitle', { regime: detailRow.regime === 'PPH4_2' ? 'PPh 4(2)' : 'PPh 23' })}
          summary={[
            { label: 'Regime', value: detailRow.regime === 'PPH4_2' ? 'PPh 4(2)' : 'PPh 23' },
            { label: 'Income', value: detailRow.incomeType || detailRow.serviceType || '—' },
            { label: tw('colTaxRate'), value: `${(detailRow.taxRate * 100).toFixed(1)}%` },
            { label: tw('lblPphAmount'), value: rp(detailRow.taxAmount) },
            { label: tw('lblEbupotNumber'), value: detailRow.buktiPotongNumber || '—' },
            { label: tw('lblEbupotDate'), value: detailRow.buktiPotongDate || '—' },
          ]}
          calcNote={{
            heading: tw('calcTaxHeading'),
            formula: tw('calcTaxFormula', { gross: rp(detailRow.grossAmount), pct: (detailRow.taxRate * 100).toFixed(1) }),
            result: rp(detailRow.taxAmount),
          }}
          basisNote={{
            heading: tw('basisRateHeading'),
            body: tw('basisWhBody', {
              type: detailRow.serviceType ?? (detailRow.regime === 'PPH4_2' ? 'PPh 4(2)' : 'PPh 23'),
              kind: detailRow.counterpartyNpwp ? tw('basisStandard') : tw('noNpwp'),
              pct: (detailRow.taxRate * 100).toFixed(1),
              surcharge: detailRow.counterpartyNpwp ? '' : tw('surchargePph23'),
            }),
            legal: detailRow.regime === 'PPH4_2'
              ? tw('legalPph42')
              : 'Pasal 23 UU PPh / PMK 141/PMK.03/2015',
          }}
          rowId={detailRow.id}
          queueId={queueId}
          putUrl="/api/tax/pph23-transactions"
          putExtra={{ serviceType: detailRow.serviceType ?? undefined, counterpartyNpwp: detailRow.counterpartyNpwp ?? undefined }}
          fields={buildWhtFields(tw)}
          requiredKeys={requiredKeys}
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
            <h2>{tw('evidencePreview')}</h2>
            <div className={styles.mb}>
              {photo.isPdf
                ? <iframe src={photo.url} title={tw('evidence')} style={{ width: '100%', height: 480, border: 0, borderRadius: 8 }} />
                // eslint-disable-next-line @next/next/no-img-element -- 5분 서명 URL, next/image 부적합
                : <img src={photo.url} alt={tw('evidence')} style={{ maxWidth: '100%', borderRadius: 8 }} />}
            </div>
            <div className={styles.mf}><button className={styles.btn} onClick={() => setPhoto(null)}>{tw('close')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// 팝업 편집 필드 (요청 15) — PUT /api/tax/pph23-transactions (camelCase, 세액 재계산 포함)
// 수정요청 59 — 고객 PPh23 입력 화면과 동일한 필드/섹션.
type TW = (key: string, values?: Record<string, string | number>) => string;
const buildWhtFields = (tw: TW): FieldDef[] => {
  const secTxn = tw('secTxnInfo');
  const secInv = tw('secInvoicePayment');
  const secBukti = tw('secBuktiPotong');
  const secAmount = tw('secAmount');
  return [
    // 거래 정보
    { key: 'transactionDate', label: tw('fTxnDate'), type: 'date', section: secTxn },
    { key: 'counterpartyName', label: tw('fCounterpartyName'), type: 'text', section: secTxn },
    { key: 'counterpartyNpwp', label: tw('fCounterpartyNpwp'), type: 'text', section: secTxn },
    { key: 'serviceType', label: tw('fServiceType'), type: 'text', section: secTxn },
    { key: 'counterpartyAddress', label: tw('fCounterpartyAddress'), type: 'text', section: secTxn },
    // 인보이스 / 지급
    { key: 'invoiceNumber', label: tw('fInvoiceNumber'), type: 'text', section: secInv },
    { key: 'invoiceDate', label: tw('fInvoiceDate'), type: 'date', section: secInv },
    { key: 'paymentDate', label: tw('fPaymentDate'), type: 'date', section: secInv },
    { key: 'description', label: tw('fDescription'), type: 'text', section: secInv },
    { key: 'notes', label: tw('fNotes'), type: 'text', section: secInv },
    // 증빙 (Bukti Potong)
    { key: 'buktiPotongNumber', label: tw('fBuktiPotongNumber'), type: 'text', section: secBukti },
    { key: 'buktiPotongDate', label: tw('fBuktiPotongDate'), type: 'date', section: secBukti },
    // 금액
    { key: 'grossAmount', label: tw('fGrossAmountRecalc'), type: 'number', section: secAmount },
    { key: 'taxAmount', label: tw('fTaxAmountAuto'), type: 'number', readOnly: true, section: secAmount },
  ];
};

function RequestModal({ row, queueId, onClose, onSent }:
  { row: WithholdingRow; queueId: string; onClose: () => void; onSent: () => void }) {
  const tw = useTranslations('workqueue');
  return (
    <RequestChatModal
      toLabel={row.counterpartyName}
      contextLabel={tw('reqCtxWithholding', { regime: row.regime === 'PPH4_2' ? 'PPh 4(2)' : 'PPh 23', label: row.flags.label })}
      defaultMessage={tw('reqMsgWithholding', { name: row.counterpartyName, label: row.flags.label })}
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
