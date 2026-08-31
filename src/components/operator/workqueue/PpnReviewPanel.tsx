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
import { useRequiredFields } from '@/hooks/useRequiredFields';
import { RequestChatModal } from './RequestChatModal';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const CORETAX_URL = 'https://coretaxdjp.pajak.go.id/';

type TW = (key: string, values?: Record<string, string | number>) => string;

// 수정요청 61(8/23) — 고객 업로드 엑셀 ↔ Coretax 다운로드 엑셀 대조 내용을 상담원에게 노출.
function reconResult(r: PpnRow, tw: TW): { text: string; cls: string } {
  switch (r.reconStatus) {
    case 'MATCH': return { text: tw('reconMatch'), cls: 'green' };
    case 'DIFF': return { text: tw('reconDiff'), cls: 'red' };
    case 'MISSING_CORETAX': return { text: tw('reconMissingCoretax'), cls: 'amber' };
    case 'MISSING_CUSTOMER': return { text: tw('reconMissingCustomer'), cls: 'amber' };
    default: return { text: tw('reconPending'), cls: 'gray' };
  }
}
function ReconCompareCard({ rows }: { rows: PpnRow[] }) {
  const tw = useTranslations('workqueue');
  const hasCoretax = rows.some(r => r.coretaxDpp != null || r.coretaxPpn != null);
  const section = (title: string, list: PpnRow[]) => list.length === 0 ? null : (
    <div className="mb-2">
      <div className="mb-1 text-[11px] font-black text-slate-600">{title}</div>
      <div className={styles.tbl}>
        <table>
          <thead><tr>
            <th>{tw('colDate')}</th><th>FAKTUR</th><th>{tw('colCounterparty')}</th>
            <th className={styles.money}>{tw('colCustomerDpp')}</th><th className={styles.money}>CORETAX DPP</th>
            <th className={styles.money}>{tw('colCustomerPpn')}</th><th className={styles.money}>CORETAX PPN</th><th>{tw('colReconResult')}</th>
          </tr></thead>
          <tbody>
            {list.map(r => { const res = reconResult(r, tw); return (
              <tr key={r.id}>
                <td>{r.fakturDate ?? '—'}</td><td>{r.fakturNumber ?? '—'}</td><td>{r.counterpartyName}</td>
                <td className={styles.money}>{rp(r.dpp)}</td>
                <td className={styles.money}>{r.coretaxDpp != null ? rp(r.coretaxDpp) : '—'}</td>
                <td className={styles.money}>{rp(r.ppn)}</td>
                <td className={styles.money}>{r.coretaxPpn != null ? rp(r.coretaxPpn) : '—'}</td>
                <td><span className={`${styles.badge} ${styles[res.cls]}`}>{res.text}</span></td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
    </div>
  );
  return (
    <div className={styles.card ?? ''} style={{ border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff', padding: 12, marginBottom: 10 }}>
      <div className="mb-2 text-xs font-black text-slate-800">🔎 {tw('reconCompareTitle')}</div>
      {!hasCoretax && (
        <p className="mb-2 text-[11px] text-amber-700">{tw('reconNoCoretaxFile')}</p>
      )}
      {section(tw('salesKeluaran'), rows.filter(r => r.fakturType === 'KELUARAN'))}
      {section(tw('purchaseMasukan'), rows.filter(r => r.fakturType === 'MASUKAN'))}
      {rows.length === 0 && <p className="text-[11px] text-slate-400">{tw('reconNoCustomerData')}</p>}
    </div>
  );
}

// 수정요청 49·52 — 값 + 카피 버튼 칩 (고객 Coretax 자격증명 복사용)
function CopyChip({ label, value }: { label: string; value: string | null }) {
  const tw = useTranslations('workqueue');
  const [copied, setCopied] = useState(false);
  const v = value?.trim();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs">
      <span className="text-gray-400">{label}</span>
      {v
        ? <span className="font-mono font-semibold text-slate-800">{v}</span>
        : <span className="italic text-gray-400">{tw('notRegistered')}</span>}
      {v && (
        <button type="button" title={tw('copy')}
          onClick={async () => { try { await navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard 차단 시 무시 */ } }}
          className="rounded px-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50">
          {copied ? tw('copied') : tw('copy')}
        </button>
      )}
    </span>
  );
}

// 수정요청 48·49 — Coretax 포털 접속 + 자격증명 + 대조 파일 업로드
function CoretaxAccessBar({ coretax, reconBusy, onFile }:
  { coretax?: { id: string | null; hint: string | null }; reconBusy: boolean; onFile: (f: File) => void }) {
  const tw = useTranslations('workqueue');
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
      <a href={CORETAX_URL} target="_blank" rel="noopener noreferrer"
        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
        {tw('coretaxConnect')} ↗
      </a>
      <CopyChip label="ID" value={coretax?.id ?? null} />
      <CopyChip label={tw('pwHint')} value={coretax?.hint ?? null} />
      <span className="mx-1 h-5 w-px bg-blue-200" />
      <label className={`rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-700 ${reconBusy ? 'opacity-50' : 'cursor-pointer hover:bg-blue-50'}`}>
        {reconBusy ? tw('reconInProgress') : tw('uploadReconFile')}
        <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} disabled={reconBusy}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
      </label>
      <span className="text-[11px] text-slate-500">{tw('coretaxAccessHint')}</span>
    </div>
  );
}

// 수정요청 63 — 고객 환급신청 목록 + 처리완료 버튼
function RefundRequestsCard({ requests, onChanged }:
  { requests: NonNullable<PpnDetail['refundRequests']>; onChanged: () => void }) {
  const tw = useTranslations('workqueue');
  const [busy, setBusy] = useState<string | null>(null);
  const mark = async (id: string, status: 'PROCESSED' | 'CANCELLED') => {
    setBusy(id);
    try {
      await fetch('/api/operator/ppn-refund-request', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      onChanged();
    } finally { setBusy(null); }
  };
  const statusLabel: Record<string, string> = { PENDING: tw('refundStatusPending'), PROCESSED: tw('refundStatusProcessed'), CANCELLED: tw('refundStatusCancelled') };
  return (
    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
      <div className="mb-2 text-xs font-black text-emerald-900">💸 {tw('refundTitle', { count: requests.length })}</div>
      <div className="flex flex-col gap-2">
        {requests.map(r => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs">
            <span className="font-bold text-slate-800">{r.taxPeriod}</span>
            <span className="font-mono text-emerald-700">Rp {r.amount.toLocaleString('id-ID')}</span>
            {r.reason && <span className="text-slate-500">· {r.reason}</span>}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : r.status === 'PROCESSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {statusLabel[r.status] ?? r.status}
            </span>
            {r.status === 'PENDING' && (
              <span className="ml-auto flex gap-1">
                <button disabled={busy === r.id} onClick={() => mark(r.id, 'PROCESSED')}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">{tw('markProcessed')}</button>
                <button disabled={busy === r.id} onClick={() => mark(r.id, 'CANCELLED')}
                  className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-gray-50 disabled:opacity-50">{tw('cancel')}</button>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 수정요청 64 — 누적 미환급 부가세 원장 + 이번달 납부액 산출(상담원 수동입력)
interface CarryoverData {
  period: string; salesPpn: number; purchasePpn: number; monthNet: number;
  openingCredit: number; payable: number; closingCredit: number; saved: boolean;
}
function CarryoverCard({ queueId }: { queueId: string }) {
  const tw = useTranslations('workqueue');
  const [data, setData] = useState<CarryoverData | null>(null);
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/ppn-carryover`);
      const j = await r.json();
      if (j.success) { setData(j.data as CarryoverData); setOpening(String(j.data.openingCredit ?? 0)); }
    } catch { /* keep */ }
  }, [queueId]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/ppn-carryover`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingCredit: Number(opening || 0) }),
      });
      const j = await r.json();
      if (j.success) { setData(j.data as CarryoverData); setMsg(tw('saved')); }
      else setMsg(j.error || tw('saveFailed'));
    } catch { setMsg(tw('networkErrorShort')); }
    finally { setBusy(false); }
  };
  if (!data) return null;
  return (
    <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 text-xs">
      <div className="mb-2 text-xs font-black text-indigo-900">📊 {tw('carryoverTitle', { period: data.period })}</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div><p className="text-[10px] text-gray-400">{tw('salesPpn')}</p><p className="font-mono font-semibold">{rp(data.salesPpn)}</p></div>
        <div><p className="text-[10px] text-gray-400">{tw('purchasePpn')}</p><p className="font-mono font-semibold">{rp(data.purchasePpn)}</p></div>
        <div><p className="text-[10px] text-gray-400">{tw('thisMonthNet')}</p><p className={`font-mono font-bold ${data.monthNet >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{rp(data.monthNet)}</p></div>
        <div>
          <label className="text-[10px] text-gray-400">{tw('openingCreditInput')}</label>
          <input type="number" value={opening} onChange={e => setOpening(e.target.value)}
            className="h-8 w-full rounded-md border border-indigo-200 px-2 font-mono text-xs focus:border-indigo-400 focus:outline-none" />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-indigo-100 pt-2">
        <span className="text-[11px]"><b>{tw('thisMonthPayableLabel')}</b>: <b className="font-mono text-red-700">{rp(data.payable)}</b></span>
        <span className="text-[11px]">{tw('closingCreditLabel')}: <b className="font-mono text-emerald-700">{rp(data.closingCredit)}</b></span>
        <span className="ml-auto flex items-center gap-2">
          {msg && <span className="text-[11px] text-slate-500">{msg}</span>}
          <button disabled={busy} onClick={save}
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
            {busy ? tw('saving') : tw('calcAndSave')}
          </button>
        </span>
      </div>
      {data.payable > 0 && (
        <p className="mt-1.5 text-[11px] text-red-700">{tw('payablePrompt', { amount: rp(data.payable) })}</p>
      )}
      {data.payable === 0 && data.monthNet <= 0 && (
        <p className="mt-1.5 text-[11px] text-emerald-700">{tw('creditPrompt')}</p>
      )}
    </div>
  );
}

export function PpnReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const tw = useTranslations('workqueue');
  const { requiredKeys } = useRequiredFields('ppn');
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
      else setError(tw('loadDetailFailed'));
    } catch { setError(tw('loadDetailFailed')); }
  }, [queueId, tw]);
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
      if (coretaxFaktur.length === 0) { setReconMsg(tw('noFakturInFile')); return; }
      const r = await fetch('/api/tax/ppn-reconcile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: detail.customerId, taxPeriod: detail.period, coretaxFaktur }),
      });
      const j = await r.json();
      if (j.success) { setReconMsg(tw('reconDoneCount', { count: coretaxFaktur.length })); await load(); }
      else setReconMsg(j.error || tw('reconFailed'));
    } catch {
      setReconMsg(tw('fileReadFailed'));
    } finally {
      setReconBusy(false);
    }
  }, [detail, load, tw]);

  // 업로드/대조 상태 표시 — 대조된 행 수 기준 (파일 업로드 여부가 한눈에 보이게)
  const reconStateLabel = useMemo(() => {
    if (reconMsg) return reconMsg;
    const done = (detail?.rows ?? []).filter(r => r.reconStatus && r.reconStatus !== 'PENDING').length;
    return done > 0 ? tw('reconciledCount', { count: done }) : tw('notReconciledNoCoretax');
  }, [detail, reconMsg, tw]);

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
        <div><h1>{t('ppnTitle')}</h1><p>{tw('subPpn', { period: detail.period })}</p></div>
        <ApprovalActions queueId={queueId} onChanged={load}
          hasIssues={(detail.rows ?? []).some(r => r.flags.level === 'red')} />
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>{t('ppnFakturCount')}</small><b>{tw('unitCases', { count: s.fakturCount })}</b></div>
          <div className={styles.metric2}><small>{t('ppnTotalDpp')}</small><b>{rp(s.totalDpp)}</b></div>
          <div className={styles.metric2}><small>{t('ppnTotalPpn')}</small><b>{rp(s.totalPpn)}</b></div>
          <div className={styles.metric2}><small>{tw('incomplete')}</small><b>{tw('unitCases', { count: s.incompleteCount })}</b></div>
        </div>

        <AiPreReviewBox queueId={queueId} taxView="ppn" period={detail.period} summary={s} rows={detail.rows} />

        <div className={styles.toolbar}>
          <div>
            <select value={dir} onChange={e => setDir(e.target.value as '' | 'KELUARAN' | 'MASUKAN')}>
              <option value="">{tw('filterAllDirections')}</option>
              <option value="KELUARAN">{tw('salesKeluaran')}</option>
              <option value="MASUKAN">{tw('purchaseMasukan')}</option>
            </select>
            <select value={recon} onChange={e => setRecon(e.target.value as '' | 'MATCH' | 'DIFF' | 'MISSING' | 'PENDING')}>
              <option value="">{tw('filterAllReconStatus')}</option>
              <option value="MATCH">{tw('reconMatch')}</option>
              <option value="DIFF">{tw('reconDiff')}</option>
              <option value="MISSING">{tw('reconMissing')}</option>
              <option value="PENDING">{tw('reconPending')}</option>
            </select>
            <span className={styles.reconState}>{reconStateLabel}</span>
          </div>
        </div>

        {/* 수정요청 48·49 — Coretax 접속(포털 새 탭) + 고객 자격증명(카피) + 대조 파일 업로드 */}
        <CoretaxAccessBar coretax={detail.coretax} reconBusy={reconBusy} onFile={runCoretaxRecon} />

        {/* 수정요청 61(8/23) — 고객 업로드 엑셀 ↔ Coretax 다운로드 엑셀 대조 내용 노출 */}
        <ReconCompareCard rows={rows} />

        {/* 수정요청 63 — 고객 PPN 환급신청(Restitusi) 노출 + 처리 */}
        {(detail.refundRequests ?? []).length > 0 && (
          <RefundRequestsCard requests={detail.refundRequests ?? []} onChanged={load} />
        )}

        {/* 수정요청 64 — 누적 미환급 부가세 + 이번달 납부액 산출 */}
        <CarryoverCard queueId={queueId} />

        <PpnReviewTable rows={rows} onRequest={setRequestRow} onOpenDetail={setDetailRow} />

        {/* 수정요청 22번 — 이슈로 표기된 건만 이슈 내용을 간단히 요약 */}
        {rows.some(r => r.flags.level === 'red') && (
          <div className={styles.issueSummary}>
            <b>{tw('issueSummary')}</b>
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
          key={detailRow.id}
          title={tw('detailFakturTitle', { name: detailRow.fakturNumber ?? detailRow.counterpartyName })}
          subtitle={tw('detailFakturSubtitle', { dir: detailRow.fakturType === 'MASUKAN' ? tw('dirIn') : tw('dirOut') })}
          summary={[
            { label: 'DPP', value: rp(detailRow.dpp) },
            { label: 'PPN', value: rp(detailRow.ppn) },
            { label: tw('lblType'), value: detailRow.fakturType === 'MASUKAN' ? tw('dirIn') : tw('dirOut') },
            { label: tw('colRate'), value: detailRow.isLuxury ? tw('rateLuxury12') : tw('rateNormal11') },
          ]}
          calcNote={{
            heading: tw('calcPpnHeading'),
            formula: tw('calcPpnFormula', { dpp: rp(detailRow.dpp), pct: detailRow.isLuxury ? '12' : '11' }),
            result: rp(detailRow.ppn),
          }}
          basisNote={{
            heading: tw('basisRateYoHeading'),
            body: detailRow.isLuxury
              ? tw('basisLuxuryBody')
              : tw('basisNormalBody'),
            legal: 'UU PPN / PMK 131/2024',
          }}
          rowId={detailRow.id}
          queueId={queueId}
          putUrl="/api/tax/ppn-faktur-monthly"
          fields={buildPpnFields(tw)}
          requiredKeys={requiredKeys}
          values={detailRow as unknown as Record<string, unknown>}
          operatorEdits={detailRow.operatorEdits}
          reviewedAt={detailRow.reviewedAt}
          warn={(draft) => ppnRateWarn(draft, tw)}
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
// 수정요청 61 — 고객 PPN 입력 화면과 동일한 필드/섹션.
const buildPpnFields = (tw: TW): FieldDef[] => {
  const secFaktur = tw('secFakturInfo');
  const secInvoice = tw('secInvoiceDesc');
  const secAmount = tw('secAmount');
  return [
    // Faktur 정보
    { key: 'fakturNumber', label: tw('fFakturNumber'), type: 'text', section: secFaktur },
    { key: 'fakturDate', label: tw('fFakturDate'), type: 'date', section: secFaktur },
    { key: 'counterpartyName', label: tw('fCounterpartyName'), type: 'text', section: secFaktur },
    { key: 'counterpartyNpwp', label: tw('fCounterpartyNpwp'), type: 'text', section: secFaktur },
    { key: 'counterpartyAddress', label: tw('fCounterpartyAddress'), type: 'text', section: secFaktur },
    // 인보이스 · 설명
    { key: 'invoiceNumber', label: tw('fInvoiceNumber'), type: 'text', section: secInvoice },
    { key: 'description', label: tw('fDescription'), type: 'text', section: secInvoice },
    { key: 'notes', label: tw('fNotes'), type: 'text', section: secInvoice },
    // 금액
    // 수정요청 64 — 사치품 여부 항목(11%/12% 결정). is_luxury 로 PUT → PPN 자동 재계산.
    { key: 'isLuxury', label: tw('fIsLuxury'), type: 'select', boolValue: true, section: secAmount,
      options: [{ value: 'false', label: tw('fIsLuxuryNormal') }, { value: 'true', label: tw('fIsLuxuryLuxury') }] },
    { key: 'dpp', label: tw('fDppRecalc'), type: 'number', section: secAmount },
    { key: 'dppNilaiLain', label: 'DPP Nilai Lain', type: 'number', section: secAmount },
    { key: 'ppn', label: tw('fPpnManual'), type: 'number', section: secAmount },
  ];
};

// 수정요청 64 — 상담원이 표준 요율을 벗어난 PPN 을 저장하려 하면 AI 재확인.
// 사치품 여부에 따라 기대 요율(11%/12%) 대비 ±1%p 초과 시 되묻는다.
function ppnRateWarn(draft: Record<string, string>, tw: TW): string | null {
  const dpp = Number(draft.dpp || 0);
  const ppn = Number(draft.ppn || 0);
  if (dpp <= 0 || ppn <= 0) return null;
  const expectedPct = draft.isLuxury === 'true' ? 12 : 11;
  const actualPct = (ppn / dpp) * 100;
  if (Math.abs(actualPct - expectedPct) <= 1) return null;
  return tw('warnPpnRate', {
    ppn: ppn.toLocaleString('id-ID'),
    pct: actualPct.toFixed(1),
    kind: draft.isLuxury === 'true' ? tw('luxuryWord') : tw('normalWord'),
    expected: expectedPct,
  });
}

function RequestModal({ row, queueId, onClose, onSent }:
  { row: PpnRow; queueId: string; onClose: () => void; onSent: () => void }) {
  const tw = useTranslations('workqueue');
  return (
    <RequestChatModal
      toLabel={row.counterpartyName}
      contextLabel={tw('reqCtxPpn', { label: row.flags.label })}
      defaultMessage={tw('reqMsgPpn', { name: row.counterpartyName, label: row.flags.label })}
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
