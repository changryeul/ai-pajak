'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { PpnReviewTable } from './PpnReviewTable';
import { AiPreReviewBox } from './AiPreReviewBox';
import { ApprovalActions } from './ApprovalActions';
import type { PpnDetail, PpnRow } from './types';
import { parseCoretaxFakturFile } from '@/lib/tax/coretax-faktur-parse';
import { RowDetailModal, type FieldDef } from './RowDetailModal';
import { RequestChatModal } from './RequestChatModal';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

export function PpnReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const [detail, setDetail] = useState<PpnDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dir, setDir] = useState<'' | 'KELUARAN' | 'MASUKAN'>('');
  const [recon, setRecon] = useState<'' | 'MATCH' | 'DIFF' | 'MISSING' | 'PENDING'>('');
  const [requestRow, setRequestRow] = useState<PpnRow | null>(null);
  const [detailRow, setDetailRow] = useState<PpnRow | null>(null); // 더블클릭 상세 (요청 24)
  // 수정요청 21번 — Coretax xlsx 업로드→대조 (고객 PPN 페이지와 동일 파서/API 재사용)
  const [reconBusy, setReconBusy] = useState(false);
  const [reconMsg, setReconMsg] = useState<string | null>(null);

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

  const rows = useMemo(() => {
    const matchRecon = (status: string | null): boolean => {
      if (!recon) return true;
      if (recon === 'MISSING') return status === 'MISSING_CORETAX' || status === 'MISSING_CUSTOMER';
      if (recon === 'PENDING') return !status || status === 'PENDING';
      return status === recon;
    };
    return (detail?.rows ?? []).filter(r => (!dir || r.fakturType === dir) && matchRecon(r.reconStatus));
  }, [detail, dir, recon]);

  const runCoretaxRecon = useCallback(async (file: File) => {
    if (!detail) return;
    setReconBusy(true);
    setReconMsg(null);
    try {
      const coretaxFaktur = await parseCoretaxFakturFile(file);
      if (coretaxFaktur.length === 0) { setReconMsg('파일에서 faktur 를 찾지 못했습니다.'); return; }
      const r = await fetch('/api/tax/ppn-reconcile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: detail.customerId, taxPeriod: detail.period, coretaxFaktur }),
      });
      const j = await r.json();
      if (j.success) { setReconMsg(`대조 완료 — Coretax ${coretaxFaktur.length}건 반영`); await load(); }
      else setReconMsg(j.error || '대조에 실패했습니다.');
    } catch {
      setReconMsg('파일을 읽지 못했습니다 (.xlsx 형식 확인).');
    } finally {
      setReconBusy(false);
    }
  }, [detail, load]);

  // 업로드/대조 상태 표시 — 대조된 행 수 기준 (파일 업로드 여부가 한눈에 보이게)
  const reconStateLabel = useMemo(() => {
    if (reconMsg) return reconMsg;
    const done = (detail?.rows ?? []).filter(r => r.reconStatus && r.reconStatus !== 'PENDING').length;
    return done > 0 ? `대조됨 ${done}건` : '미대조 (Coretax 자료 없음)';
  }, [detail, reconMsg]);

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
        <ApprovalActions queueId={queueId} onChanged={load} />
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
            {/* 수정요청 21번: 상담원이 Coretax 출력 xlsx 를 여기서 직접 올려 대조 */}
            <label className={`${styles.btn} ${styles.blue} ${reconBusy ? styles.disabled : ''}`}>
              {reconBusy ? '대조 중…' : 'Coretax에서 부가세 자료 가져오기'}
              <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} disabled={reconBusy}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) runCoretaxRecon(f); }} />
            </label>
            <span className={styles.reconState}>{reconStateLabel}</span>
          </div>
        </div>

        <PpnReviewTable rows={rows} onRequest={setRequestRow} onOpenDetail={setDetailRow} />

        {/* 수정요청 22번 — 이슈로 표기된 건만 이슈 내용을 간단히 요약 */}
        {rows.some(r => r.flags.level === 'red') && (
          <div className={styles.issueSummary}>
            <b>이슈 요약</b>
            <ul>
              {rows.filter(r => r.flags.level === 'red').map(r => (
                <li key={r.id}>
                  <span className={styles.issueWho}>{r.fakturNumber ?? r.counterpartyName}</span>
                  {r.flags.issues.join(' · ')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {detailRow && (
        <RowDetailModal
          title={`faktur 상세: ${detailRow.fakturNumber ?? detailRow.counterpartyName}`}
          subtitle={`${detailRow.fakturType === 'MASUKAN' ? '매입' : '매출'} · ${detailRow.isLuxury ? '사치품 12%' : '일반 11%'} · DPP 수정 시 PPN 자동 재계산`}
          rowId={detailRow.id}
          queueId={queueId}
          putUrl="/api/tax/ppn-faktur-monthly"
          fields={PPN_FIELDS}
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
    </div>
  );
}

// 팝업 편집 필드 (요청 24) — PUT /api/tax/ppn-faktur-monthly (camelCase, PPN 재계산)
const PPN_FIELDS: FieldDef[] = [
  { key: 'fakturNumber', label: 'faktur 번호', type: 'text' },
  { key: 'fakturDate', label: 'faktur 일자', type: 'date' },
  { key: 'counterpartyName', label: '거래처명', type: 'text' },
  { key: 'counterpartyNpwp', label: '거래처 NPWP', type: 'text' },
  { key: 'dpp', label: 'DPP (PPN 자동 재계산)', type: 'number' },
  { key: 'ppn', label: 'PPN (직접 수정 시 우선)', type: 'number' },
];

function RequestModal({ row, queueId, onClose, onSent }:
  { row: PpnRow; queueId: string; onClose: () => void; onSent: () => void }) {
  return (
    <RequestChatModal
      toLabel={row.counterpartyName}
      contextLabel={`부가세 (PPN) · ${row.flags.label}`}
      defaultMessage={`${row.counterpartyName} faktur의 ${row.flags.label} 관련 자료를 확인 부탁드립니다.`}
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
