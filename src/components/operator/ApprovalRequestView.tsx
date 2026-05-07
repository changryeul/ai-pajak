'use client';

/**
 * 승인요청 (Final Review) 화면 — PDF p.5-7.
 *
 * 좌측 「내 고객」 + 메인 컬럼.
 * 메인:
 *   1. 4 KPI(고객/서비스/검토필요/자료요청중)
 *   2. 승인요청 전 체크 (미완료 시 빨간 경고)
 *   3. 가이드 3카드
 *   4. 「최종 원천세 적용값」 편집 테이블 (Vendor / 최종 세목 select / 최종 Tax Code input / DPP)
 *      합계는 우상단 표시. 각 행 변경 → PUT /final-review.
 *   5. 제출자료/파싱상태 + 상담원 수정/처리 이력 (case_audit_log 기반)
 *   6. 「최종 검토 완료」 체크박스 → 「Supervisor 승인요청 보내기」 버튼 활성
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle, Send } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { cn } from '@/lib/utils';

interface FinalItem {
  invoice: string;
  vendor: string;
  aiTaxKind: string;
  aiTaxCode: string;
  finalTaxKind: string;
  finalTaxCode: string;
  dpp: number;
  tax: number;
  state: string;
  isReviewed: boolean;
}

interface MyCase {
  id: string;
  case_code: string | null;
  service_label: string | null;
  status: string;
  priority: string | null;
  customer_name: string;
  review_required: number;
}

interface EditEvent {
  id: string;
  event: string;
  actor: string | null;
  payload: Record<string, unknown> | null;
  at: string;
}

interface FinalReview {
  case: { id: string; case_code: string | null; status: string; priority: string | null; due_date: string | null };
  customer: { id: string; full_name: string; company_name: string | null; npwp: string | null; customer_type: string } | null;
  service: { label: string; taxType: string; period: { month: number; year: number }; totalTax: number };
  kpi: { customer: string; serviceLabel: string; reviewRequired: number; dataRequestCount: number };
  finalItems: FinalItem[];
  taxKindOptions: string[];
  documents: Array<{ type: string; name: string; parsedFields: number; status: string }>;
  editHistory: EditEvent[];
  myCases: MyCase[];
  operator: { employee_id: string; name: string } | null;
  supervisor: { employee_id: string; name: string } | null;
  canSubmit: boolean;
  finalReviewedAt: string | null;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING:            { text: '대기',       cls: 'bg-slate-100 text-slate-600' },
  PENDING_DOCS:       { text: '자료요청',   cls: 'bg-amber-100 text-amber-700' },
  DATA_REVIEW:        { text: '검토중',     cls: 'bg-indigo-100 text-indigo-700' },
  PENDING_APPROVAL:   { text: '승인요청',   cls: 'bg-violet-100 text-violet-700' },
  APPROVED:           { text: '승인완료',   cls: 'bg-emerald-100 text-emerald-700' },
  EBILLING_GENERATED: { text: 'ID Billing', cls: 'bg-blue-100 text-blue-700' },
  COMPLETED:          { text: '신고완료',   cls: 'bg-emerald-100 text-emerald-700' },
};

const fmtRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const fmtTs = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

const EVENT_LABEL: Record<string, string> = {
  CASE_CREATED: '케이스 생성',
  ASSIGNED: '배정',
  REASSIGNED: '재배정',
  RECALLED: '환수',
  TRANSFERRED_TO_SV: 'SV 이관',
  BULK_TRANSFERRED: 'Bulk 이관',
  APPROVED: '승인',
  REJECTED: '반려',
  INSTRUCTED: '편집/지시',
};

export function ApprovalRequestView({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [d, setD] = useState<FinalReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyInvoice, setBusyInvoice] = useState<string | null>(null);
  const [reviewedChecked, setReviewedChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/operator/cases/${caseId}/final-review`);
      const j = await r.json();
      if (j.success) setD(j.data as FinalReview);
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

  const totalFinalTax = useMemo(() => (d?.finalItems ?? []).reduce((s, i) => s + (i.tax ?? 0), 0), [d]);

  const updateRow = async (
    invoice: string,
    patch: Partial<{ finalTaxKind: string; finalTaxCode: string; finalTax: number; finalDpp: number; vendorOverride: string }>,
  ) => {
    setBusyInvoice(invoice);
    try {
      const r = await fetch(`/api/operator/cases/${caseId}/final-review`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice, ...patch }),
      });
      const j = await r.json();
      if (!j.success) {
        alert(j.error ?? '실패');
        return;
      }
      await load();
    } finally { setBusyInvoice(null); }
  };

  const submit = async () => {
    if (!d) return;
    if (!d.canSubmit) {
      alert('미완료 항목이 있어 승인요청을 보낼 수 없습니다.');
      return;
    }
    if (!reviewedChecked) {
      alert('「최종 검토 완료」 체크박스를 먼저 체크해주세요.');
      return;
    }
    if (!confirm('Supervisor 승인을 요청하시겠습니까?')) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/operator/cases/${caseId}/request-approval`, { method: 'PUT' });
      const j = await r.json();
      if (!j.success) {
        alert(j.error ?? '실패');
        return;
      }
      // 승인요청 후 my-work로 이동 (검토필요 0건 + status PENDING_APPROVAL 으로 보일 것).
      router.push(`/${locale}/operator/my-work`);
    } finally { setSubmitting(false); }
  };

  const switchCase = (c: MyCase) => {
    try {
      window.localStorage.setItem('aip.operator.lastCase', JSON.stringify({
        id: c.id, case_code: c.case_code, customer_name: c.customer_name, status: c.status,
      }));
    } catch { /* ignore */ }
    router.push(`/${locale}/operator/approval-request/${c.id}`);
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!d) return <div className="py-20 text-center text-sm text-slate-400">케이스를 불러올 수 없습니다.</div>;

  const customerName = d.customer?.company_name || d.customer?.full_name || '—';
  const statusBadge = STATUS_LABEL[d.case.status] ?? { text: d.case.status, cls: 'bg-slate-100 text-slate-600' };
  const blocked = d.kpi.reviewRequired > 0;

  return (
    <div>
      <PageTitle title={`승인요청 · ${customerName}`} />
      <h1 className="mb-1 text-2xl font-black text-slate-900">Supervisor 승인요청</h1>
      <p className="mb-6 text-sm text-slate-500">자료와 세금 검토가 끝난 케이스를 Supervisor에게 상신합니다.</p>

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
                    <p className={cn('mt-1 text-[10px]', sel ? 'text-white/70' : 'text-slate-400')}>
                      담당 {d.operator?.employee_id ?? '—'} · {c.priority === 'URGENT' ? 'Urgent' : c.priority === 'HIGH' ? 'High' : 'Normal'} · 검토필요 {c.review_required}건
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* 메인 */}
        <main className="space-y-3">
          {/* 헤더 + 4 KPI */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Supervisor 승인요청</h2>
                <p className="text-xs text-slate-500">자료와 세금 검토가 끝난 케이스를 Supervisor에게 상신합니다.</p>
              </div>
              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', statusBadge.cls)}>{statusBadge.text}</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Kpi label="고객"        value={d.kpi.customer} />
              <Kpi label="서비스"      value={d.kpi.serviceLabel} />
              <Kpi label="검토필요"    value={`${d.kpi.reviewRequired}건`} highlight={d.kpi.reviewRequired > 0} />
              <Kpi label="자료요청중"   value={`${d.kpi.dataRequestCount}건`} />
            </div>
          </section>

          {/* 승인요청 전 체크 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">승인요청 전 체크</h3>
            {blocked ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-black text-rose-900">아직 승인요청 전 확인이 필요합니다</p>
                <p className="mt-1 text-[12px] text-rose-700">⚠️ 검토필요 원천세 항목 {d.kpi.reviewRequired}건 미완료</p>
                <p className="mt-1 text-[11px] text-rose-600">먼저 ② 검토 화면에서 확인완료 또는 자료요청 처리를 끝내야 합니다.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-black text-emerald-900">검토 완료 — Supervisor 상신 가능합니다</p>
                <p className="mt-1 text-[11px] text-emerald-700">아래 「최종 원천세 적용값」 테이블의 값이 그대로 Supervisor 승인 화면으로 전달됩니다.</p>
              </div>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Step n="1" title="고객 자료 확인" desc="업로드 자료와 파싱값 검토" />
              <Step n="2" title="세금/결산 검토" desc="원천세 코드, 세율, 결산 항목 확인" />
              <Step n="3" title="Supervisor 상신" desc="승인 후 Coretax 처리 가능" />
            </div>
          </section>

          {/* 최종 원천세 적용값 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">최종 원천세 적용값</h3>
                <p className="text-[11px] text-slate-500">여기서 수정한 값은 즉시 최종 승인요청 자료와 이력에 반영됩니다.</p>
              </div>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black text-white">합계 {fmtRupiah(totalFinalTax)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500">
                    <th className="px-2 py-2">Invoice</th>
                    <th className="px-2 py-2">Vendor</th>
                    <th className="px-2 py-2">AI 판단</th>
                    <th className="px-2 py-2">최종 세목</th>
                    <th className="px-2 py-2">최종 Tax Code</th>
                    <th className="px-2 py-2 text-right">DPP</th>
                    <th className="px-2 py-2 text-right">세액</th>
                  </tr>
                </thead>
                <tbody>
                  {d.finalItems.map(it => {
                    const isBusy = busyInvoice === it.invoice;
                    return (
                      <tr key={it.invoice} className="border-t border-slate-100 align-top">
                        <td className="px-2 py-2 font-mono text-[11px] font-bold text-slate-700">{it.invoice}</td>
                        <td className="px-2 py-2">
                          <input
                            defaultValue={it.vendor}
                            onBlur={e => { if (e.target.value !== it.vendor) updateRow(it.invoice, { vendorOverride: e.target.value }); }}
                            disabled={isBusy}
                            className="w-32 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]"
                          />
                        </td>
                        <td className="px-2 py-2 text-[11px] text-slate-500">{it.aiTaxKind} / {it.aiTaxCode}</td>
                        <td className="px-2 py-2">
                          <select
                            value={it.finalTaxKind}
                            onChange={e => updateRow(it.invoice, { finalTaxKind: e.target.value })}
                            disabled={isBusy}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]"
                          >
                            {d.taxKindOptions.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            defaultValue={it.finalTaxCode}
                            onBlur={e => { if (e.target.value !== it.finalTaxCode) updateRow(it.invoice, { finalTaxCode: e.target.value }); }}
                            disabled={isBusy}
                            className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px]"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number" defaultValue={it.dpp}
                            onBlur={e => { const v = Number(e.target.value); if (v !== it.dpp) updateRow(it.invoice, { finalDpp: v }); }}
                            disabled={isBusy}
                            className="w-32 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-[11px]"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number" defaultValue={it.tax}
                            onBlur={e => { const v = Number(e.target.value); if (v !== it.tax) updateRow(it.invoice, { finalTax: v }); }}
                            disabled={isBusy}
                            className="w-32 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-[11px]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {d.finalItems.length === 0 && (
                    <tr><td colSpan={7} className="px-2 py-8 text-center text-[11px] text-slate-400">검토 항목이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* 제출자료 + 처리 이력 */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">제출자료 / 파싱상태</h3>
              <ul className="space-y-2">
                {d.documents.map(doc => (
                  <li key={doc.type} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{doc.type}</span>
                      <span className="text-[10px] font-bold text-emerald-700">{doc.status}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-700">{doc.name}</p>
                    <p className="text-[10px] text-slate-400">파싱필드 {doc.parsedFields}개</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">상담원 수정 / 처리 이력</h3>
              {d.editHistory.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-400">수정/검토 이력이 없습니다.</p>
              ) : (
                <ul className="max-h-[260px] space-y-1.5 overflow-y-auto">
                  {d.editHistory.map(e => (
                    <li key={e.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-700">{EVENT_LABEL[e.event] ?? e.event}</span>
                        <span className="text-[10px] text-slate-400">{fmtTs(e.at)}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{e.actor ?? 'system'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* 최종 검토 완료 + 상신 버튼 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <label className={cn('flex items-start gap-3 rounded-xl border p-4', blocked ? 'border-slate-100 bg-slate-50 opacity-50' : 'border-slate-200 bg-white cursor-pointer')}>
              <input
                type="checkbox" checked={reviewedChecked}
                disabled={blocked}
                onChange={e => setReviewedChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <div>
                <p className="text-sm font-black text-slate-900">최종 검토 완료</p>
                <p className="mt-0.5 text-[11px] text-slate-500">위의 최종 적용값, 수정 이력, 고객 제출자료, 세액 계산 결과를 확인했습니다. 이 내용이 Supervisor 승인 화면으로 전달됩니다.</p>
              </div>
            </label>

            <button
              onClick={submit} disabled={blocked || !reviewedChecked || submitting || !d.canSubmit}
              className={cn(
                'mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition',
                (blocked || !reviewedChecked || !d.canSubmit) ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800',
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Supervisor 승인요청 보내기
            </button>
            {(blocked || !d.canSubmit) && (
              <div className="mt-2 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 text-rose-500" />
                <p className="text-[10px] text-rose-500">미완료 항목이 있으면 승인요청은 진행되지 않습니다.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={cn('mt-0.5 truncate text-sm font-black', highlight ? 'text-rose-600' : 'text-slate-800')}>{value}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-black text-slate-700">{n}. {title}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{desc}</p>
    </div>
  );
}
