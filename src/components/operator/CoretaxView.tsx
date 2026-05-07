'use client';

/**
 * Coretax 처리 화면 — PDF 「백오피스_상담원」 p.9-11.
 *
 * 좌측 「내 고객」 + 메인 컬럼.
 *   1. 메타 4 카드 (고객/서비스/예상 납부액/Coretax 방식)
 *   2. 처리 순서 4단계 카드 — 단계별 상태 (진행가능/대기/완료)
 *   3. 1. Coretax 접속  (새 탭 / 현재 탭 / 주소 복사 + 가이드)
 *   4. 2. ID Billing 발행 결과  (발행상태/ID/금액/방식 + 발행완료 기록 버튼)
 *   5. 3. 고객 NTPN 확인  (고객 제출값 + 상담원 수정값 + 확인 버튼)
 *   6. 4. 신고완료 / BPE 반영
 *   7. Coretax 작업 체크리스트 5항목 + 빠른 액션 (접근권한/납부증빙 요청)
 *   8. 수동 처리 로그 (자유 입력)
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ExternalLink, Copy, ArrowRight } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { cn } from '@/lib/utils';

interface MyCase {
  id: string;
  case_code: string | null;
  service_label: string | null;
  status: string;
  priority: string | null;
  customer_name: string;
}

interface ManualLog { id: string; at: string; actor: string | null; note: string }

interface CoretaxData {
  case: { id: string; case_code: string | null; status: string; priority: string | null; due_date: string | null; service_label: string | null };
  customer: { id: string; full_name: string; company_name: string | null; npwp: string | null; customer_type: string } | null;
  service: { label: string; taxType: string; period: { month: number; year: number }; expectedAmount: number; coretaxMode: string };
  stepStates: { access: { state: string }; billing: { state: string }; ntpn: { state: string }; complete: { state: string } };
  billing: { state: string; billingId: string | null; amount: number; method: string };
  submitted: { ntpn: string | null; buktiFile: string | null; submittedAt: string | null };
  complete: { ntpnConfirmed: boolean; submitted: boolean; bpeReflected: boolean; bpeNumber: string | null; bpeDate: string | null };
  checklist: Record<string, '대기' | '진행' | '완료' | '미완'>;
  manualLogs: ManualLog[];
  myCases: MyCase[];
  coretaxUrl: string;
  canRecordBilling: boolean;
  closingSessionId: string | null;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING:            { text: '대기',       cls: 'bg-slate-100 text-slate-600' },
  PENDING_DOCS:       { text: '자료요청',   cls: 'bg-amber-100 text-amber-700' },
  DATA_REVIEW:        { text: '검토중',     cls: 'bg-indigo-100 text-indigo-700' },
  PENDING_APPROVAL:   { text: '승인요청',   cls: 'bg-violet-100 text-violet-700' },
  APPROVED:           { text: '승인완료',   cls: 'bg-emerald-100 text-emerald-700' },
  EBILLING_GENERATED: { text: 'ID Billing', cls: 'bg-blue-100 text-blue-700' },
  PAYMENT_PENDING:    { text: '납부대기',   cls: 'bg-amber-100 text-amber-700' },
  PAYMENT_UPLOADED:   { text: '납부확인중', cls: 'bg-blue-100 text-blue-700' },
  PAYMENT_VERIFIED:   { text: '납부완료',   cls: 'bg-emerald-100 text-emerald-700' },
  DJP_SUBMITTED:      { text: 'DJP 제출',   cls: 'bg-blue-100 text-blue-700' },
  BPE_UPLOADED:       { text: 'BPE 등록',   cls: 'bg-cyan-100 text-cyan-700' },
  COMPLETED:          { text: '신고완료',   cls: 'bg-emerald-100 text-emerald-700' },
};

const CHECKLIST_ITEMS: Array<{ key: string; title: string; desc: string }> = [
  { key: 'coretax-login',       title: 'Coretax 로그인 / 권한 확인',          desc: '고객 Coretax 접근정보 또는 위임권한 확인' },
  { key: 'id-billing-issue',    title: 'Coretax에서 ID Billing 발행',         desc: 'Supervisor 승인 후 금액/세목/Tax Code 기준 발행' },
  { key: 'reflect-billing-info', title: 'AI Pajak 고객 화면에 Billing 정보 반영', desc: 'Billing ID/금액/기한 기록' },
  { key: 'verify-ntpn-bukti',   title: '고객 NTPN / 납부증빙 확인',           desc: '고객이 제출한 NTPN과 Billing 정보 대조' },
  { key: 'submit-spt-masa',     title: 'Coretax에서 SPT Masa 신고 제출',       desc: '납부 확인 후 신고 제출' },
  { key: 'upload-bpe',          title: 'BPE / 신고완료 증빙 업로드',           desc: '신고완료 증빙을 AI Pajak 고객 화면에 반영' },
];

const fmtRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const fmtTs = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

export function CoretaxView({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [d, setD] = useState<CoretaxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [billingId, setBillingId] = useState('');
  const [ntpn, setNtpn] = useState('');
  const [bpeNumber, setBpeNumber] = useState('');
  const [manualNote, setManualNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/operator/cases/${caseId}/coretax`);
      const j = await r.json();
      if (j.success) {
        const data = j.data as CoretaxData;
        setD(data);
        setNtpn(data.submitted.ntpn ?? '');
        setBillingId(data.billing.billingId ?? '');
        setBpeNumber(data.complete.bpeNumber ?? '');
      }
    } finally { setLoading(false); }
  }, [caseId]);
  useEffect(() => { load(); }, [load]);

  // lastCase 갱신.
  useEffect(() => {
    if (!d) return;
    try {
      window.localStorage.setItem('aip.operator.lastCase', JSON.stringify({
        id: d.case.id, case_code: d.case.case_code,
        customer_name: d.customer?.company_name || d.customer?.full_name || '—',
        status: d.case.status,
      }));
    } catch { /* ignore */ }
  }, [d]);

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const r = await fetch(`/api/operator/cases/${caseId}/coretax`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const j = await r.json();
      if (!j.success) {
        alert(j.error ?? '실패');
        return false;
      }
      await load();
      return true;
    } finally { setBusy(null); }
  };

  const switchCase = (c: MyCase) => {
    try {
      window.localStorage.setItem('aip.operator.lastCase', JSON.stringify({
        id: c.id, case_code: c.case_code, customer_name: c.customer_name, status: c.status,
      }));
    } catch { /* ignore */ }
    router.push(`/${locale}/operator/coretax/${c.id}`);
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!d) return <div className="py-20 text-center text-sm text-slate-400">케이스를 불러올 수 없습니다.</div>;

  const customerName = d.customer?.company_name || d.customer?.full_name || '—';
  const sBadge = STATUS_LABEL[d.case.status] ?? { text: d.case.status, cls: 'bg-slate-100 text-slate-600' };

  return (
    <div>
      <PageTitle title={`Coretax 처리 · ${customerName}`} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
        {/* 좌측: 내 고객 */}
        <aside className="rounded-2xl bg-white p-3 shadow-sm">
          <h2 className="px-2 py-2 text-sm font-black text-slate-900">내 고객</h2>
          <ul className="space-y-1.5">
            {d.myCases.length === 0 ? (
              <li className="px-2 py-2 text-xs text-slate-400">배정된 케이스가 없습니다.</li>
            ) : d.myCases.map(c => {
              const sel = c.id === d.case.id;
              const s = STATUS_LABEL[c.status] ?? { text: c.status, cls: 'bg-slate-100 text-slate-600' };
              return (
                <li key={c.id}>
                  <button
                    onClick={() => switchCase(c)}
                    className={cn(
                      'w-full rounded-xl border px-3 py-2.5 text-left transition',
                      sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-white hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm font-black', sel ? 'text-white' : 'text-slate-900')}>{c.customer_name}</span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', sel ? 'bg-white/20 text-white' : s.cls)}>{s.text}</span>
                    </div>
                    <p className={cn('mt-0.5 text-[10px]', sel ? 'text-white/70' : 'text-slate-500')}>{c.case_code ?? '—'} · {c.service_label}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* 메인 */}
        <main className="space-y-3">
          {/* 헤더 + 메타 4카드 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Coretax 처리</h2>
                <p className="text-xs text-slate-500">Supervisor 승인 후 상담원이 Coretax에 접속해 ID Billing 발행, NTPN 확인, 신고완료/BPE 반영을 처리합니다.</p>
              </div>
              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', sBadge.cls)}>{sBadge.text}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Meta label="고객"          value={customerName} />
              <Meta label="서비스"        value={d.service.label} />
              <Meta label="예상 납부액"   value={fmtRupiah(d.service.expectedAmount)} highlight />
              <Meta label="Coretax 방식"  value={d.service.coretaxMode} />
            </div>
            {d.closingSessionId && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">결산 wizard 연동</span>
                <p className="text-[11px] text-blue-900">
                  이 케이스는 고객 결산 wizard(SPT Tahunan)에서 자동 생성되었습니다.
                  「4. 신고완료 / BPE 반영」을 기록하면 결산 wizard 화면에 BPE/NTPN이 즉시 반영됩니다.
                </p>
              </div>
            )}
          </section>

          {/* 처리 순서 4단계 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">처리 순서</h3>
            <div className="grid grid-cols-4 gap-2">
              <StepCard n="1" title="Coretax 접속" subtitle="공식 Coretax 사이트를 새 탭으로 엽니다." state={d.stepStates.access.state} />
              <StepCard n="2" title="ID Billing 발행" subtitle="Coretax에서 발행 후 결과를 기록합니다." state={d.stepStates.billing.state} />
              <StepCard n="3" title="NTPN 확인" subtitle="고객 제출 NTPN을 불러와 대조합니다." state={d.stepStates.ntpn.state} />
              <StepCard n="4" title="신고완료/BPE" subtitle="Coretax 신고 완료 후 BPE를 반영합니다." state={d.stepStates.complete.state} />
            </div>
          </section>

          {/* 1. Coretax 접속 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">1. Coretax 접속</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">접속 후 고객 NPWP/NIK 또는 위임권한으로 해당 신고 메뉴에서 작업합니다.</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => { window.open(d.coretaxUrl, '_blank'); act('open-coretax'); }}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
                >
                  <ExternalLink className="h-3 w-3" /> Coretax 새 탭 열기
                </button>
                <button
                  onClick={() => { window.location.href = d.coretaxUrl; }}
                  className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
                >
                  <ArrowRight className="h-3 w-3" /> 현재 탭 이동
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(d.coretaxUrl).then(() => alert('주소 복사 완료'))}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                <Copy className="h-3 w-3" /> 주소 복사
              </button>
              <span className="text-[11px] text-slate-500">접속 주소: <code className="font-mono">{d.coretaxUrl}</code></span>
            </div>
            {!d.canRecordBilling && (
              <p className="mt-2 text-[11px] text-amber-700">아직 Supervisor 승인 전입니다. 사이트 접속은 가능하지만 ID Billing 발행 기록은 승인완료 후 진행합니다.</p>
            )}
          </section>

          {/* 2. ID Billing + 3. NTPN 확인 */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">2. ID Billing 발행 결과</h3>
              <Row label="발행 상태" value={d.billing.state} />
              <Row label="Billing ID" value={d.billing.billingId ?? '—'} mono />
              <Row label="금액" value={fmtRupiah(d.billing.amount)} />
              <Row label="발행방식" value={d.billing.method} />
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={billingId} onChange={e => setBillingId(e.target.value)}
                  placeholder="Coretax에서 받은 Billing ID"
                  disabled={!d.canRecordBilling}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono"
                />
                <button
                  disabled={!d.canRecordBilling || !billingId.trim() || busy === 'record-billing'}
                  onClick={() => act('record-billing', { billingId, method: 'Coretax 수동' })}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold',
                    !d.canRecordBilling || !billingId.trim() ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700',
                  )}
                >
                  ID Billing 발행완료 기록
                </button>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">3. 고객 NTPN 확인</h3>
              <p className="text-[11px] text-slate-500">고객이 AI Pajak에서 제출한 값</p>
              <p className="mt-1 text-base font-black text-slate-900">{d.submitted.ntpn ?? '—'}</p>
              {d.submitted.buktiFile && (
                <p className="text-[10px] text-slate-400">증빙파일: {d.submitted.buktiFile}</p>
              )}
              <p className="mt-3 text-[11px] font-bold text-slate-500">상담원 확인 / 수정값</p>
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={ntpn} onChange={e => setNtpn(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                />
                <button
                  disabled={!ntpn.trim() || busy === 'confirm-ntpn'}
                  onClick={() => act('confirm-ntpn', { ntpn })}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold',
                    !ntpn.trim() ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-orange-500 text-white hover:bg-orange-600',
                  )}
                >확인</button>
              </div>
            </section>
          </div>

          {/* 4. 신고완료/BPE + 체크리스트 */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">4. 신고완료 / BPE 반영</h3>
              <Row label="NTPN 확인"    value={d.complete.ntpnConfirmed ? '완료' : '대기'} />
              <Row label="신고완료"     value={d.complete.submitted ? '완료' : '미완료'} />
              <Row label="BPE 반영"     value={d.complete.bpeReflected ? '완료' : '대기'} />
              <Row label="BPE 번호"     value={d.complete.bpeNumber ?? '—'} mono />
              <Row label="BPE 일자"     value={d.complete.bpeDate ?? '—'} />
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={bpeNumber} onChange={e => setBpeNumber(e.target.value)}
                  placeholder="Coretax 신고 BPE 번호"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                />
                <button
                  disabled={!bpeNumber.trim() || busy === 'record-completion'}
                  onClick={() => act('record-completion', { bpeNumber })}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold',
                    !bpeNumber.trim() ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-violet-600 text-white hover:bg-violet-700',
                  )}
                >Coretax 신고완료 / BPE 반영</button>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">Coretax 작업 체크리스트</h3>
              <ul className="space-y-2">
                {CHECKLIST_ITEMS.map(it => (
                  <li key={it.key} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-slate-700">{it.title}</p>
                      <p className="text-[10px] text-slate-500">{it.desc}</p>
                    </div>
                    <select
                      value={d.checklist[it.key] ?? '대기'}
                      onChange={e => act('set-checklist', { key: it.key, state: e.target.value })}
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold"
                    >
                      <option value="대기">대기</option>
                      <option value="진행">진행</option>
                      <option value="완료">완료</option>
                      <option value="미완">미완</option>
                    </select>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => act('request-access')}
                  className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-200"
                >접근권한 요청</button>
                <button
                  onClick={() => act('request-bukti')}
                  className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-200"
                >납부증빙 요청</button>
              </div>
            </section>
          </div>

          {/* 수동 처리 로그 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">수동 처리 로그</h3>
            {d.manualLogs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[11px] text-slate-400">아직 Coretax 처리 로그가 없습니다.</p>
            ) : (
              <ul className="mb-3 space-y-1.5 max-h-[200px] overflow-y-auto">
                {d.manualLogs.map(l => (
                  <li key={l.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-700">{l.actor ?? 'system'}</span>
                      <span className="text-[10px] text-slate-400">{fmtTs(l.at)}</span>
                    </div>
                    <p className="text-[11px] text-slate-700">{l.note}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <input
                value={manualNote} onChange={e => setManualNote(e.target.value)}
                placeholder="예: Coretax에서 ID Billing 발행 완료, 금액 대조 완료"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
              />
              <button
                disabled={!manualNote.trim() || busy === 'log-manual'}
                onClick={async () => { const ok = await act('log-manual', { note: manualNote }); if (ok) setManualNote(''); }}
                className={cn(
                  'rounded-lg px-3 py-2 text-[11px] font-bold',
                  !manualNote.trim() ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800',
                )}
              >로그 추가</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Meta({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={cn('mt-0.5 truncate text-sm font-black', highlight ? 'text-blue-600' : 'text-slate-800')}>{value}</p>
    </div>
  );
}

const STEP_STATE_CLS: Record<string, string> = {
  '진행가능': 'border-blue-200 bg-blue-50 text-blue-700',
  '완료':     'border-emerald-200 bg-emerald-50 text-emerald-700',
  '대기':     'border-slate-200 bg-slate-50 text-slate-500',
  'BPE 대기': 'border-slate-200 bg-slate-50 text-slate-500',
};

function StepCard({ n, title, subtitle, state }: { n: string; title: string; subtitle: string; state: string }) {
  const cls = STEP_STATE_CLS[state] ?? 'border-slate-200 bg-slate-50 text-slate-500';
  return (
    <div className={cn('rounded-xl border p-3', cls)}>
      <div className="mb-1 flex items-center justify-between">
        <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-slate-700">{n}</span>
        <span className="text-[10px] font-bold">{state}</span>
      </div>
      <p className="text-[12px] font-black">{title}</p>
      <p className="mt-0.5 text-[10px] opacity-75">{subtitle}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 text-[11px] last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={cn('font-bold text-slate-800', mono && 'font-mono')}>{value}</span>
    </div>
  );
}
