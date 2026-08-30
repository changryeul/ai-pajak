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

// 수정요청 61(8/23) — 고객 업로드 엑셀 ↔ Coretax 다운로드 엑셀 대조 내용을 상담원에게 노출.
function reconResult(r: PpnRow): { text: string; cls: string } {
  switch (r.reconStatus) {
    case 'MATCH': return { text: '일치', cls: 'green' };
    case 'DIFF': return { text: '불일치', cls: 'red' };
    case 'MISSING_CORETAX': return { text: 'Coretax 누락', cls: 'amber' };
    case 'MISSING_CUSTOMER': return { text: '고객자료 누락', cls: 'amber' };
    default: return { text: '미대조', cls: 'gray' };
  }
}
function ReconCompareCard({ rows }: { rows: PpnRow[] }) {
  const hasCoretax = rows.some(r => r.coretaxDpp != null || r.coretaxPpn != null);
  const section = (title: string, list: PpnRow[]) => list.length === 0 ? null : (
    <div className="mb-2">
      <div className="mb-1 text-[11px] font-black text-slate-600">{title}</div>
      <div className={styles.tbl}>
        <table>
          <thead><tr>
            <th>일자</th><th>FAKTUR</th><th>거래처</th>
            <th className={styles.money}>고객 DPP</th><th className={styles.money}>CORETAX DPP</th>
            <th className={styles.money}>고객 PPN</th><th className={styles.money}>CORETAX PPN</th><th>대조결과</th>
          </tr></thead>
          <tbody>
            {list.map(r => { const res = reconResult(r); return (
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
      <div className="mb-2 text-xs font-black text-slate-800">🔎 고객 엑셀 ↔ Coretax 엑셀 대조</div>
      {!hasCoretax && (
        <p className="mb-2 text-[11px] text-amber-700">아직 Coretax 대조 파일이 업로드되지 않았습니다. 위 &quot;대조 파일 업로드&quot;로 Coretax 다운로드 엑셀을 올리면 CORETAX 값이 채워집니다. (아래는 고객 업로드 엑셀 값)</p>
      )}
      {section('매출 (Keluaran)', rows.filter(r => r.fakturType === 'KELUARAN'))}
      {section('매입 (Masukan)', rows.filter(r => r.fakturType === 'MASUKAN'))}
      {rows.length === 0 && <p className="text-[11px] text-slate-400">고객이 업로드한 부가세 자료가 없습니다.</p>}
    </div>
  );
}

// 수정요청 49·52 — 값 + 카피 버튼 칩 (고객 Coretax 자격증명 복사용)
function CopyChip({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);
  const v = value?.trim();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs">
      <span className="text-gray-400">{label}</span>
      {v
        ? <span className="font-mono font-semibold text-slate-800">{v}</span>
        : <span className="italic text-gray-400">미등록</span>}
      {v && (
        <button type="button" title="복사"
          onClick={async () => { try { await navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard 차단 시 무시 */ } }}
          className="rounded px-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50">
          {copied ? '복사됨' : '복사'}
        </button>
      )}
    </span>
  );
}

// 수정요청 48·49 — Coretax 포털 접속 + 자격증명 + 대조 파일 업로드
function CoretaxAccessBar({ coretax, reconBusy, onFile }:
  { coretax?: { id: string | null; hint: string | null }; reconBusy: boolean; onFile: (f: File) => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
      <a href={CORETAX_URL} target="_blank" rel="noopener noreferrer"
        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
        Coretax 접속 ↗
      </a>
      <CopyChip label="ID" value={coretax?.id ?? null} />
      <CopyChip label="PW 힌트" value={coretax?.hint ?? null} />
      <span className="mx-1 h-5 w-px bg-blue-200" />
      <label className={`rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-700 ${reconBusy ? 'opacity-50' : 'cursor-pointer hover:bg-blue-50'}`}>
        {reconBusy ? '대조 중…' : '대조 파일 업로드'}
        <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} disabled={reconBusy}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
      </label>
      <span className="text-[11px] text-slate-500">Coretax 접속 → 부가세 자료 다운로드 → 파일 업로드로 대조</span>
    </div>
  );
}

// 수정요청 63 — 고객 환급신청 목록 + 처리완료 버튼
function RefundRequestsCard({ requests, onChanged }:
  { requests: NonNullable<PpnDetail['refundRequests']>; onChanged: () => void }) {
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
  const statusLabel: Record<string, string> = { PENDING: '신청됨', PROCESSED: '처리완료', CANCELLED: '취소' };
  return (
    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
      <div className="mb-2 text-xs font-black text-emerald-900">💸 고객 PPN 환급신청 (Restitusi) — {requests.length}건</div>
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
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">처리완료</button>
                <button disabled={busy === r.id} onClick={() => mark(r.id, 'CANCELLED')}
                  className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-gray-50 disabled:opacity-50">취소</button>
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
      if (j.success) { setData(j.data as CarryoverData); setMsg('저장됨'); }
      else setMsg(j.error || '저장 실패');
    } catch { setMsg('네트워크 오류'); }
    finally { setBusy(false); }
  };
  if (!data) return null;
  return (
    <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 text-xs">
      <div className="mb-2 text-xs font-black text-indigo-900">📊 누적 미환급 부가세 · 이번달 납부액 ({data.period})</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div><p className="text-[10px] text-gray-400">매출 PPN</p><p className="font-mono font-semibold">{rp(data.salesPpn)}</p></div>
        <div><p className="text-[10px] text-gray-400">매입 PPN</p><p className="font-mono font-semibold">{rp(data.purchasePpn)}</p></div>
        <div><p className="text-[10px] text-gray-400">이번달 (매출−매입)</p><p className={`font-mono font-bold ${data.monthNet >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{rp(data.monthNet)}</p></div>
        <div>
          <label className="text-[10px] text-gray-400">이월 누적 미환급액 (Coretax 입력)</label>
          <input type="number" value={opening} onChange={e => setOpening(e.target.value)}
            className="h-8 w-full rounded-md border border-indigo-200 px-2 font-mono text-xs focus:border-indigo-400 focus:outline-none" />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-indigo-100 pt-2">
        <span className="text-[11px]">이번달 <b>납부액(ID Billing 대상)</b>: <b className="font-mono text-red-700">{rp(data.payable)}</b></span>
        <span className="text-[11px]">이월 후 잔여 미환급: <b className="font-mono text-emerald-700">{rp(data.closingCredit)}</b></span>
        <span className="ml-auto flex items-center gap-2">
          {msg && <span className="text-[11px] text-slate-500">{msg}</span>}
          <button disabled={busy} onClick={save}
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
            {busy ? '저장 중…' : '계산·저장'}
          </button>
        </span>
      </div>
      {data.payable > 0 && (
        <p className="mt-1.5 text-[11px] text-red-700">→ 납부액 {rp(data.payable)} 을 ID Billing 발행 보드에서 발행하세요.</p>
      )}
      {data.payable === 0 && data.monthNet <= 0 && (
        <p className="mt-1.5 text-[11px] text-emerald-700">→ 이번달 환급(크레딧). 누적 미환급액에 합산됨.</p>
      )}
    </div>
  );
}

export function PpnReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
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
        <ApprovalActions queueId={queueId} onChanged={load}
          hasIssues={(detail.rows ?? []).some(r => r.flags.level === 'red')} />
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
          key={detailRow.id}
          title={`faktur 상세: ${detailRow.fakturNumber ?? detailRow.counterpartyName}`}
          subtitle={`${detailRow.fakturType === 'MASUKAN' ? '매입' : '매출'} · DPP 수정 시 PPN 자동 재계산`}
          summary={[
            { label: 'DPP', value: rp(detailRow.dpp) },
            { label: 'PPN', value: rp(detailRow.ppn) },
            { label: '구분', value: detailRow.fakturType === 'MASUKAN' ? '매입' : '매출' },
            { label: '요율', value: detailRow.isLuxury ? '사치품 12%' : '일반 11%' },
          ]}
          calcNote={{
            heading: 'PPN 산출근거',
            formula: `DPP ${rp(detailRow.dpp)} × ${detailRow.isLuxury ? '12' : '11'}%`,
            result: rp(detailRow.ppn),
          }}
          basisNote={{
            heading: '요율 결정 근거',
            body: detailRow.isLuxury
              ? '사치품(barang mewah) — PPN 12%'
              : '일반 재화·용역 — PPN 11%',
            legal: 'UU PPN / PMK 131/2024',
          }}
          rowId={detailRow.id}
          queueId={queueId}
          putUrl="/api/tax/ppn-faktur-monthly"
          fields={PPN_FIELDS}
          requiredKeys={requiredKeys}
          values={detailRow as unknown as Record<string, unknown>}
          operatorEdits={detailRow.operatorEdits}
          reviewedAt={detailRow.reviewedAt}
          warn={ppnRateWarn}
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
const PPN_FIELDS: FieldDef[] = [
  // Faktur 정보
  { key: 'fakturNumber', label: 'faktur 번호', type: 'text', section: 'Faktur 정보' },
  { key: 'fakturDate', label: 'faktur 일자', type: 'date', section: 'Faktur 정보' },
  { key: 'counterpartyName', label: '거래처명', type: 'text', section: 'Faktur 정보' },
  { key: 'counterpartyNpwp', label: '거래처 NPWP', type: 'text', section: 'Faktur 정보' },
  { key: 'counterpartyAddress', label: '거래처 주소', type: 'text', section: 'Faktur 정보' },
  // 인보이스 · 설명
  { key: 'invoiceNumber', label: '인보이스 번호', type: 'text', section: '인보이스 · 설명' },
  { key: 'description', label: '설명', type: 'text', section: '인보이스 · 설명' },
  { key: 'notes', label: '메모', type: 'text', section: '인보이스 · 설명' },
  // 금액
  // 수정요청 64 — 사치품 여부 항목(11%/12% 결정). is_luxury 로 PUT → PPN 자동 재계산.
  { key: 'isLuxury', label: '사치품 여부', type: 'select', boolValue: true, section: '금액',
    options: [{ value: 'false', label: '일반 (11%)' }, { value: 'true', label: '사치품 (12%)' }] },
  { key: 'dpp', label: 'DPP (PPN 자동 재계산)', type: 'number', section: '금액' },
  { key: 'dppNilaiLain', label: 'DPP Nilai Lain', type: 'number', section: '금액' },
  { key: 'ppn', label: 'PPN (직접 수정 시 우선)', type: 'number', section: '금액' },
];

// 수정요청 64 — 상담원이 표준 요율을 벗어난 PPN 을 저장하려 하면 AI 재확인.
// 사치품 여부에 따라 기대 요율(11%/12%) 대비 ±1%p 초과 시 되묻는다.
function ppnRateWarn(draft: Record<string, string>): string | null {
  const dpp = Number(draft.dpp || 0);
  const ppn = Number(draft.ppn || 0);
  if (dpp <= 0 || ppn <= 0) return null;
  const expectedPct = draft.isLuxury === 'true' ? 12 : 11;
  const actualPct = (ppn / dpp) * 100;
  if (Math.abs(actualPct - expectedPct) <= 1) return null;
  return `⚠️ AI 확인: 입력한 PPN(Rp ${ppn.toLocaleString('id-ID')})은 DPP 대비 약 ${actualPct.toFixed(1)}% 로, `
    + `${draft.isLuxury === 'true' ? '사치품' : '일반'} 표준 요율 ${expectedPct}% 와 다릅니다.\n`
    + `요율/사치품 여부를 잘못 입력했을 수 있습니다. 이대로 저장할까요?`;
}

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
