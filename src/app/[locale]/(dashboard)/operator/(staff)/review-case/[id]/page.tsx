'use client';

/**
 * 검토 화면 — 3-pane (PDF 「백오피스_상담원」 p.3-4).
 *
 *   좌(280px): 내 고객 리스트 — 현재 선택은 하이라이트
 *   중앙(flex): 케이스 헤더 + 「확인할 항목」 카드 + 메신저 + 자료 Preview
 *   우(320px, sticky): 「다음 작업」 패널 4 액션 + NTPN 입력 + 검토필요 알림
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle, ExternalLink, CheckCircle2, FileText, ArrowRight, Send, Upload, Sparkles } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { cn } from '@/lib/utils';

interface ReviewItem {
  invoice?: string;
  vendor?: string;
  taxKind?: string;
  taxCode?: string;
  tax?: number;
  dpp?: number;
  state?: string;
  reason?: string;
  checkedAt?: string;
  requestedAt?: string;
  note?: string | null;
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

interface Detail {
  case: { id: string; case_code: string | null; status: string; priority: string | null; due_date: string | null; notes: string | null };
  customer: { id: string; full_name: string; company_name: string | null; npwp: string | null; customer_type: string } | null;
  service: { label: string; taxType: string; period: { month: number; year: number }; totalTax: number };
  approval: { state: '미요청' | '요청중' | '승인됨' | '반려'; supervisor: { employee_id: string; name: string } | null };
  operator: { employee_id: string; name: string } | null;
  reviewItems: ReviewItem[];
  reviewRequired: number;
  submitted: { ntpn: string | null; buktiFile: string | null; submittedAt: string | null };
  documents: Array<{ type: string; name: string; parsedFields: number; status: string }>;
  myCases: MyCase[];
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

const ITEM_STATE_CLS: Record<string, string> = {
  '자동확인':     'border-emerald-200 bg-emerald-50',
  '불확실 높음': 'border-rose-200 bg-rose-50',
  '정보부족':    'border-rose-200 bg-rose-50',
  '자료요청':    'border-amber-200 bg-amber-50',
};

export default function ReviewCasePage() {
  const router = useRouter();
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyInvoice, setBusyInvoice] = useState<string | null>(null);
  const [ntpnInput, setNtpnInput] = useState('');
  const [previewItem, setPreviewItem] = useState<ReviewItem | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrLastResult, setOcrLastResult] = useState<{ taxKind: string; taxCode: string; confidence: number; reason: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/operator/cases/${id}/review-detail`);
      const j = await r.json();
      if (j.success) {
        setD(j.data as Detail);
        setNtpnInput((j.data as Detail).submitted.ntpn ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // 라우트 진입 시 lastCase 갱신.
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

  const switchCase = (c: MyCase) => {
    try {
      window.localStorage.setItem('aip.operator.lastCase', JSON.stringify({
        id: c.id, case_code: c.case_code, customer_name: c.customer_name, status: c.status,
      }));
    } catch { /* ignore */ }
    router.push(`/${locale}/operator/review-case/${c.id}`);
  };

  const itemAction = async (invoice: string, action: 'mark-checked' | 'request-docs') => {
    setBusyInvoice(invoice);
    try {
      const r = await fetch(`/api/operator/cases/${id}/review-item`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice, action, note: action === 'request-docs' ? '추가 자료 요청' : undefined }),
      });
      const j = await r.json();
      if (!j.success) {
        alert(j.error ?? '실패');
        return;
      }
      await load();
    } finally {
      setBusyInvoice(null);
    }
  };

  const handleOcrFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('10MB 이하 파일만 업로드 가능합니다.');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      alert('JPG / PNG / WebP / GIF 만 지원합니다. (PDF는 추후 지원 예정)');
      return;
    }
    // base64 변환.
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result as string;
        // dataURL prefix(`data:image/png;base64,`) 제거.
        resolve(r.split(',')[1] ?? r);
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsDataURL(file);
    });

    setOcrBusy(true);
    setOcrLastResult(null);
    try {
      const r = await fetch(`/api/operator/cases/${id}/invoices/ocr`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, mimeType: file.type }),
      });
      const j = await r.json();
      if (!j.success) {
        alert(j.error ?? 'OCR 실패');
        return;
      }
      setOcrLastResult({
        taxKind: j.data.item.taxKind,
        taxCode: j.data.item.taxCode,
        confidence: j.data.classification.confidence,
        reason: j.data.classification.resolution.reason,
      });
      await load();
    } finally {
      setOcrBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const requestApproval = async () => {
    if (!d) return;
    if (d.reviewRequired > 0) {
      alert(`검토필요 항목 ${d.reviewRequired}건이 미완료 상태입니다.`);
      return;
    }
    if (!confirm('Supervisor 승인을 요청하시겠습니까?')) return;
    const r = await fetch(`/api/operator/cases/${id}/request-approval`, { method: 'PUT' });
    const j = await r.json();
    if (!j.success) {
      alert(j.error ?? '실패');
      return;
    }
    router.push(`/${locale}/operator/approval-request`);
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!d) return <div className="py-20 text-center text-sm text-slate-400">케이스를 불러올 수 없습니다.</div>;

  const statusBadge = STATUS_LABEL[d.case.status] ?? { text: d.case.status, cls: 'bg-slate-100 text-slate-600' };
  const customerName = d.customer?.company_name || d.customer?.full_name || '—';
  const canRequestApproval = d.reviewRequired === 0 && ['PENDING', 'PENDING_DOCS', 'DATA_REVIEW'].includes(d.case.status);
  const canCoretax = ['APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED', 'DJP_SUBMITTED'].includes(d.case.status);

  return (
    <div>
      <PageTitle title={`검토 · ${customerName}`} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr_320px]">
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

        {/* 중앙: 검토 본문 */}
        <main className="space-y-3">
          {/* 헤더 */}
          <section className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">고객 AI Pajak 화면과 비슷한 상담 화면</p>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="text-xl font-black">{customerName}</h2>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', statusBadge.cls)}>{statusBadge.text}</span>
            </div>
            <p className="mt-1 text-sm text-white/80">{d.service.label}</p>
          </section>

          {/* 메타 4 카드 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-3">
              <Meta label="서비스" value={d.service.label.includes('Tahunan') ? '연 신고 결산' : '월신고 원천세'} />
              <Meta label="원천세 합계" value={fmtRupiah(d.service.totalTax)} highlight />
              <Meta label="Supervisor 승인" value={d.approval.state} highlight={d.approval.state === '승인됨'} />
            </div>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
              <p className="text-[13px] font-bold text-amber-900">상담원이 확인해야 할 항목이 있습니다</p>
              <p className="text-[11px] text-amber-700">아래 항목을 확인하거나 고객에게 부족자료를 요청하세요.</p>
            </div>
          </section>

          {/* 확인할 항목 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-900">확인할 항목</h3>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrFile(f); }}
                />
                <button
                  disabled={ocrBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition',
                    ocrBusy ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-violet-600 text-white hover:bg-violet-700',
                  )}
                >
                  {ocrBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3" /><Sparkles className="h-3 w-3" /></>}
                  Invoice OCR 추가
                </button>
              </div>
            </div>
            {ocrLastResult && (
              <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5">
                <p className="text-[11px] font-black text-violet-900">
                  AI 분류: {ocrLastResult.taxKind} · Tax Code {ocrLastResult.taxCode} · 신뢰도 {Math.round(ocrLastResult.confidence * 100)}%
                </p>
                <p className="text-[10px] text-violet-700">{ocrLastResult.reason}</p>
              </div>
            )}
            {d.reviewItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-400">검토할 항목이 없습니다.</p>
            ) : (
              <ul className="space-y-2.5">
                {d.reviewItems.map(it => {
                  const wrapCls = ITEM_STATE_CLS[it.state ?? ''] ?? 'border-slate-200 bg-white';
                  const checked = it.state === '자동확인';
                  const requested = it.state === '자료요청';
                  return (
                    <li key={it.invoice} className={cn('rounded-xl border p-3', wrapCls)}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-900">
                            {it.invoice} · <span className="font-bold">{it.vendor}</span>
                          </p>
                          <p className="text-[11px] text-slate-600">
                            {it.taxKind} · Tax Code {it.taxCode} · DPP {fmtRupiah(it.dpp ?? 0)}
                          </p>
                          {it.reason && <p className="mt-1 text-[11px] font-bold text-rose-600">{it.reason}</p>}
                          {it.note && <p className="mt-1 text-[11px] text-amber-700">📨 {it.note}</p>}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            onClick={() => setPreviewItem(it)}
                            className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
                          >자료보기</button>
                          <button
                            disabled={checked || busyInvoice === it.invoice}
                            onClick={() => itemAction(it.invoice!, 'mark-checked')}
                            className={cn(
                              'rounded-lg px-2.5 py-1.5 text-[11px] font-bold',
                              checked ? 'bg-emerald-200 text-emerald-800' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
                              busyInvoice === it.invoice && 'opacity-50',
                            )}
                          >{checked ? '확인완료 ✓' : '확인완료'}</button>
                          <button
                            disabled={requested || busyInvoice === it.invoice}
                            onClick={() => itemAction(it.invoice!, 'request-docs')}
                            className={cn(
                              'rounded-lg px-2.5 py-1.5 text-[11px] font-bold',
                              requested ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-700 hover:bg-amber-200',
                              busyInvoice === it.invoice && 'opacity-50',
                            )}
                          >{requested ? '자료요청됨' : '자료요청'}</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 자료 Preview */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">자료 Preview</h3>
            {previewItem ? (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-black text-slate-900">{previewItem.invoice} · {previewItem.vendor}</p>
                <p className="text-[11px] text-slate-500">{previewItem.taxKind} · Tax Code {previewItem.taxCode}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">DPP: <span className="font-bold">{fmtRupiah(previewItem.dpp ?? 0)}</span></div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">세액: <span className="font-bold">{fmtRupiah(previewItem.tax ?? 0)}</span></div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">실제 Invoice/Contract/Bank PDF는 Phase 7+에서 연동됩니다.</p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-400">
                위에서 「자료보기」 버튼을 누르면 이곳에 Invoice / Contract / Bank 자료가 열립니다.
              </p>
            )}
          </section>
        </main>

        {/* 우: Sticky 다음 작업 */}
        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">다음 작업</h3>
            <p className="mb-3 text-[11px] text-slate-500">지금 필요한 버튼만 위에서부터 누르면 됩니다.</p>
            <div className="space-y-2">
              <ActionButton
                color="emerald" disabled={!canRequestApproval} onClick={requestApproval}
                icon={<Send className="h-3.5 w-3.5" />}
                label="1. Supervisor 승인요청"
              />
              <ActionButton
                color="blue" disabled={!canCoretax} onClick={() => router.push(`/${locale}/operator/coretax`)}
                icon={<ExternalLink className="h-3.5 w-3.5" />}
                label="2. Coretax 새 탭 열기"
              />
              <ActionButton
                color="slate" disabled={!canCoretax} onClick={() => router.push(`/${locale}/operator/coretax`)}
                icon={<ArrowRight className="h-3.5 w-3.5" />}
                label="Coretax 현재 탭 이동"
              />
              <ActionButton
                color="slate" disabled={d.case.status !== 'EBILLING_GENERATED' && d.case.status !== 'PAYMENT_PENDING'}
                onClick={() => router.push(`/${locale}/operator/coretax`)}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="3. ID Billing 발행완료 기록"
              />
              <ActionButton
                color="violet" disabled={!['PAYMENT_VERIFIED', 'DJP_SUBMITTED', 'BPE_UPLOADED'].includes(d.case.status)}
                onClick={() => router.push(`/${locale}/operator/coretax`)}
                icon={<FileText className="h-3.5 w-3.5" />}
                label="4. 신고완료 / BPE 반영"
              />
            </div>
          </section>

          {/* 고객 NTPN */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold text-slate-500">고객이 AI Pajak 화면에서 제출한 NTPN</p>
            <p className="mt-1 text-base font-black text-slate-900">{d.submitted.ntpn ?? '—'}</p>
            {d.submitted.buktiFile && (
              <p className="mt-0.5 text-[10px] text-slate-400">
                증빙파일: {d.submitted.buktiFile} · 제출일: {d.submitted.submittedAt ? new Date(d.submitted.submittedAt).toLocaleString('ko-KR') : '—'}
              </p>
            )}

            <p className="mt-3 text-[11px] font-bold text-slate-500">상담원 확인 / 수정값</p>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={ntpnInput} onChange={e => setNtpnInput(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono"
              />
              <button className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600">확인</button>
            </div>
          </section>

          {/* 검토필요 알림 */}
          {d.reviewRequired > 0 && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                <p className="text-[12px] font-bold text-rose-900">⚠️ 검토필요 원천세 항목 {d.reviewRequired}건 미완료</p>
              </div>
            </section>
          )}

          {/* Coretax 안내 */}
          {!canCoretax && (
            <section className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[11px] text-slate-600">
                Coretax 접속은 항상 가능하지만, ID Billing 발행 기록은 <strong>Supervisor 승인완료</strong> 후 가능합니다.
              </p>
            </section>
          )}
        </aside>
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

type ActionColor = 'emerald' | 'blue' | 'slate' | 'violet';
const COLOR_CLS: Record<ActionColor, string> = {
  emerald: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  blue:    'bg-blue-600 hover:bg-blue-700 text-white',
  slate:   'bg-slate-900 hover:bg-slate-800 text-white',
  violet:  'bg-violet-600 hover:bg-violet-700 text-white',
};

function ActionButton({ color, disabled, onClick, icon, label }: { color: ActionColor; disabled?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      disabled={disabled} onClick={onClick}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition',
        disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : COLOR_CLS[color],
      )}
    >
      {icon}{label}
    </button>
  );
}
