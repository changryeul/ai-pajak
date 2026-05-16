'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

type SessionStatus =
  | 'DRAFT' | 'UPLOADING' | 'PARSING' | 'REVIEWING'
  | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';

interface SessionRow {
  id: string;
  customer_id: string;
  consultant_id: string;
  supervisor_id: string | null;
  filing_kind: 'MONTHLY' | 'ANNUAL';
  tax_period: string;
  current_step: number;
  status: SessionStatus;
  total_estimated_tax: number | null;
}

interface DocumentRow {
  id: string;
  slot: string;
  original_filename: string;
  version: number;
  parse_status: string;
  uploaded_at: string;
}

interface ApprovalRow {
  id: string;
  action: string;
  actor_role: string;
  comment: string | null;
  created_at: string;
}

interface CoretaxRow {
  id_billing: string | null;
  ntpn: string | null;
  bpe_file_path: string | null;
  recorded_at: string | null;
}

const SLOTS: { key: string; label: string; required: boolean }[] = [
  { key: 'PAYROLL', label: '급여자료', required: true },
  { key: 'WITHHOLDING_INVOICE', label: '원천세 관련 수신 인보이스', required: true },
  { key: 'CORP_TAX_INPUT', label: '법인세 계산 검증', required: true },
  { key: 'VAT_IN_OUT', label: '부가세 In/Out 자료', required: true },
  { key: 'OTHER_REFERENCE', label: '기타 별도 수신자료', required: false },
  { key: 'BANK_STATEMENT', label: '법인통장 거래내역', required: true },
];

const STEPS = ['고객선택', '자료업로드', '파싱검토/자동계산', '수퍼바이저 승인대기', 'Coretax기록'];

export function ErpWorkflow({ isSupervisor }: { isSupervisor: boolean }) {
  const params = useSearchParams();
  const customerId = params.get('customerId');
  const sessionIdParam = params.get('sessionId');

  const [sessionId, setSessionId] = useState<string | null>(sessionIdParam);
  const [filingKind, setFilingKind] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [taxPeriod, setTaxPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [session, setSession] = useState<SessionRow | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [coretax, setCoretax] = useState<CoretaxRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${id}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error ?? 'load failed');
      setSession(j.data.session);
      setDocuments(j.data.documents ?? []);
      setApprovals(j.data.approvals ?? []);
      setCoretax(j.data.coretax ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionId) void loadSession(sessionId);
  }, [sessionId, loadSession]);

  const startSession = async () => {
    if (!customerId) {
      setError('customerId 가 URL 에 없습니다. Dashboard 에서 고객을 선택하세요.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/consultant-erp/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, filingKind, taxPeriod }),
      });
      const j = await r.json();
      if (!r.ok) {
        if (r.status === 409) {
          // Already exists — fetch it.
          const list = await fetch(`/api/consultant-erp/sessions?customerId=${customerId}`).then((x) => x.json());
          const found = (list.data ?? []).find(
            (s: SessionRow) => s.filing_kind === filingKind && s.tax_period.startsWith(taxPeriod),
          );
          if (found) setSessionId(found.id);
          else throw new Error(j.error ?? 'conflict');
        } else throw new Error(j.error ?? 'create failed');
      } else {
        setSessionId(j.data.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const uploadDoc = async (slot: string) => {
    if (!sessionId) return;
    const filename = window.prompt(`'${slot}' 슬롯에 등록할 파일명 (P1 mvp: 메타데이터만 기록)`);
    if (!filename) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot,
          storagePath: `consultant-erp/${sessionId}/${slot}/${Date.now()}-${filename}`,
          originalFilename: filename,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'upload failed');
      await loadSession(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const submitApproval = async (action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'WITHDRAW') => {
    if (!sessionId) return;
    const comment =
      action === 'REJECT' || action === 'WITHDRAW'
        ? window.prompt(`${action} 코멘트 (필수는 아님)`) ?? undefined
        : undefined;
    setBusy(true);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `${action} failed`);
      await loadSession(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const [crIdBilling, setCrIdBilling] = useState('');
  const [crNtpn, setCrNtpn] = useState('');
  const [crBpe, setCrBpe] = useState('');

  const submitCoretax = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/coretax-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idBilling: crIdBilling,
          ntpn: crNtpn,
          bpeFilePath: crBpe || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'coretax record failed');
      await loadSession(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const currentStep = session?.current_step ?? 1;
  const docsBySlot = useMemo(() => {
    const m = new Map<string, DocumentRow>();
    documents.forEach((d) => m.set(d.slot, d));
    return m;
  }, [documents]);
  const requiredFilled = SLOTS.filter((s) => s.required && docsBySlot.has(s.key)).length;
  const requiredTotal = SLOTS.filter((s) => s.required).length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      )}

      {!session && (
        <Card className="border-dashed">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-sm font-bold text-slate-700">업무 시작</p>
              <p className="mt-1 text-xs text-slate-500">
                Dashboard 에서 &lsquo;고객 열기&rsquo; 로 진입하면 customerId 가 URL 에 들어옵니다.
                현재 customerId: <code className="rounded bg-slate-100 px-1.5 py-0.5">{customerId ?? '없음'}</code>
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <p className="mb-1 text-xs font-bold text-slate-600">신고구분</p>
                <div className="flex gap-1 rounded-full bg-slate-100 p-1">
                  {(['MONTHLY', 'ANNUAL'] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setFilingKind(k)}
                      className={`rounded-full px-4 py-1.5 text-xs font-black transition ${
                        filingKind === k ? 'bg-slate-950 text-white' : 'text-slate-600'
                      }`}
                    >
                      {k === 'MONTHLY' ? '월신고' : '연신고'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold text-slate-600">과세월</p>
                <Input
                  type="month"
                  value={taxPeriod}
                  onChange={(e) => setTaxPeriod(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button onClick={startSession} disabled={busy || !customerId}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '월신고 자료업로드 시작'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {session && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                  {session.filing_kind === 'ANNUAL' ? '연신고' : '월신고'} · {session.tax_period.slice(0, 7)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  현재 상태:{' '}
                  <span className="font-black text-slate-950">{session.status}</span>
                </p>
              </div>
              {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
            </div>
            <div className="flex flex-wrap gap-2">
              {STEPS.map((label, i) => {
                const stepNum = i + 1;
                const on = currentStep === stepNum;
                const done = currentStep > stepNum;
                return (
                  <span
                    key={label}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
                      on
                        ? 'bg-slate-950 text-white'
                        : done
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {done && <CheckCircle2 className="h-3 w-3" />}
                    {stepNum}. {label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Step 2: 자료 업로드 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-black text-slate-950">2단계: 자료 업로드</p>
                  <p className="text-xs text-slate-500">필수자료 {requiredFilled}/{requiredTotal}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  P1 mvp: 메타데이터만 기록
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {SLOTS.map((slot) => {
                  const doc = docsBySlot.get(slot.key);
                  return (
                    <div
                      key={slot.key}
                      className={`rounded-xl border p-4 ${doc ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-black text-slate-950">{slot.label}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            slot.required ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {slot.required ? '필수' : '참고'}
                        </span>
                      </div>
                      {doc ? (
                        <p className="text-xs text-slate-600">
                          <FileText className="mr-1 inline h-3 w-3" />
                          {doc.original_filename} · v{doc.version}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">아직 업로드 없음</p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() => uploadDoc(slot.key)}
                        disabled={busy}
                      >
                        {doc ? '수정본 업로드' : '업로드'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Step 4: 결재 */}
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-black text-slate-950 mb-3">4단계: 수퍼바이저 결재</p>
              <p className="text-xs text-slate-500 mb-4">
                상태: <span className="font-bold text-slate-950">{session.status}</span>
                {session.supervisor_id && ` · 담당 supervisor: ${session.supervisor_id.slice(0, 8)}…`}
              </p>
              <div className="flex flex-wrap gap-2">
                {session.status !== 'PENDING_APPROVAL' && session.status !== 'APPROVED' && session.status !== 'COMPLETED' && (
                  <Button onClick={() => submitApproval('SUBMIT')} disabled={busy}>
                    상신 (SUBMIT)
                  </Button>
                )}
                {session.status === 'PENDING_APPROVAL' && (
                  <Button variant="outline" onClick={() => submitApproval('WITHDRAW')} disabled={busy}>
                    상신 회수
                  </Button>
                )}
                {isSupervisor && session.status === 'PENDING_APPROVAL' && (
                  <>
                    <Button onClick={() => submitApproval('APPROVE')} disabled={busy}>
                      승인
                    </Button>
                    <Button variant="destructive" onClick={() => submitApproval('REJECT')} disabled={busy}>
                      반려
                    </Button>
                  </>
                )}
              </div>

              {approvals.length > 0 && (
                <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                    결재 이력
                  </p>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {approvals.slice(0, 5).map((a) => (
                      <li key={a.id}>
                        <span className="font-bold">{a.action}</span> · {a.actor_role} ·{' '}
                        {new Date(a.created_at).toLocaleString('ko-KR')}
                        {a.comment && <span className="text-slate-500"> — {a.comment}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 5: Coretax 수기 기록 */}
          {(session.status === 'APPROVED' || session.status === 'COMPLETED') && (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-black text-slate-950 mb-1">5단계: Coretax 직접 처리 결과 기록</p>
                <p className="text-xs text-slate-500 mb-4">
                  Coretax 외부 페이지에서 ID Billing 발행 + 납부 + 신고 처리 후, 그 결과만 여기에
                  기록합니다.
                </p>
                {coretax?.recorded_at ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <CheckCircle2 className="mr-1 inline h-4 w-4" />
                    기록 완료: ID Billing {coretax.id_billing} · NTPN {coretax.ntpn}
                    {coretax.bpe_file_path && <div className="mt-1 text-xs">BPE: {coretax.bpe_file_path}</div>}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      placeholder="ID BILLING"
                      value={crIdBilling}
                      onChange={(e) => setCrIdBilling(e.target.value)}
                    />
                    <Input
                      placeholder="NTPN"
                      value={crNtpn}
                      onChange={(e) => setCrNtpn(e.target.value)}
                    />
                    <Input
                      placeholder="BPE 파일명 (옵션)"
                      value={crBpe}
                      onChange={(e) => setCrBpe(e.target.value)}
                    />
                    <div className="col-span-full">
                      <Button onClick={submitCoretax} disabled={busy || !crIdBilling || !crNtpn}>
                        결과 저장 / 업무 완료
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
