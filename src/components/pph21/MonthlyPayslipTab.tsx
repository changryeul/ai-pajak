'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { useBulkSelect } from '@/hooks/useBulkSelect';
import { useRequiredFields } from '@/hooks/useRequiredFields';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Save, ChevronDown, ChevronRight, Users,
  DollarSign, AlertTriangle, CheckCircle, Calculator, Pencil, X,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Payslip {
  id: string;
  customer_id: string;
  employee_id: string;
  period: string;
  working_days: number;
  absent_days: number;
  overtime_hours: number;
  base_salary: number;
  base_salary_bpjs_kes: number;
  base_salary_bpjs_tk: number;
  overtime_pay: number;
  meal_allowance: number;
  transport_allowance: number;
  position_allowance: number;
  other_allowances: number;
  bonus: number;
  thr: number;
  commission: number;
  bpjs_kesehatan: number;
  bpjs_ketenagakerjaan: number;
  jht_employee: number;
  jp_employee: number;
  loan_deduction: number;
  other_deductions: number;
  // Employer-paid BPJS (read-only, auto-calculated)
  bpjs_kes_company: number;
  jkk_company: number;
  jkm_company: number;
  jht_company: number;
  jp_company: number;
  personal_expense: number;
  // Phase 2: Specific allowances
  laptop_allowance: number;
  medical_allowance: number;
  tax_allowance: number;
  tax_method?: string;  // GROSS | GROSS_UP (2026-08-30)
  annual_leave_pay: number;
  // Phase 3: Special payments
  severance_allowance: number;
  pkwt_compensation: number;
  // Bank transfer info
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  total_gross: number;
  total_deduction: number;
  pph21_tax: number;
  ter_rate: number;
  net_salary: number;
  status: string;
  // 2026-06-21: self-contained 직원 식별 정보 (sync 전엔 마스터 없음)
  employee_name: string | null;
  employee_npwp: string | null;
  ptkp_category: string | null;
  // 2026-08-30 (Model B): 인사 정보를 payslip 이 자체 보유 — 마스터와 독립, 신고별 편집.
  employee_number?: string | null;
  employee_nik?: string | null;
  employment_status?: string | null;
  worker_type?: string | null;
  position?: string | null;
  department?: string | null;
  hire_date?: string | null;
  resign_date?: string | null;
  employee?: {
    id: string;
    gross_salary: number;
    employment_status?: string | null;
    employee_number?: string | null;
    employee_nik?: string | null;
    employee_npwp?: string | null;
    worker_type?: string | null;
    position?: string | null;
    department?: string | null;
    ptkp_category?: string | null;
    hire_date?: string | null;
    resign_date?: string | null;
  } | null;
}

interface Props {
  customerId: string;
  /** 부모가 업로드/sync 완료 시 ++ 해 주면 payslip 재조회 트리거 */
  reloadTrigger?: number;
}

export function MonthlyPayslipTab({ customerId, reloadTrigger }: Props) {
  const tp = useTranslations('monthlyPayslip');
  // 2026-08-30 — MASTER 지정 필수항목 별표. config snake_case ↔ 라벨 key 정규화 매칭.
  const { requiredKeys, fields: reqFields } = useRequiredFields('payslip');
  const reqSet = new Set((requiredKeys ?? []).map(k => k.toLowerCase().replace(/_/g, '')));
  const reqStar = (k: string) => reqSet.has(k.toLowerCase().replace(/_/g, ''))
    ? <span className="text-red-500 font-bold"> *</span> : null;
  // 2026-08-30 — 급여 행별 필수항목 누락 판정 (제출 차단 + 리스트 표시 공용)
  const payslipMissing = (ps: Payslip): string[] => {
    const norm = (k: string) => k.toLowerCase().replace(/_/g, '');
    const valOf = (k: string): unknown => {
      switch (norm(k)) {
        case 'employeename': return ps.employee_name;
        case 'employeenpwp': return ps.employee_npwp || ps.employee?.employee_npwp;
        case 'ptkp': return ps.ptkp_category || ps.employee?.ptkp_category;
        case 'basesalary': return ps.base_salary;
        case 'nik': return ps.employee?.employee_nik;
        default: return undefined;
      }
    };
    const labelOf = (k: string) => reqFields.find(f => norm(f.fieldKey) === norm(k))?.label ?? k;
    const bad: string[] = [];
    for (const k of (requiredKeys ?? [])) {
      const v = valOf(k);
      if (v === undefined) continue;
      if (v == null || v === '' || (typeof v === 'number' && v === 0)) bad.push(labelOf(k));
    }
    return bad;
  };
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [period, setPeriod] = useState(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [summary, setSummary] = useState({ totalEmployees: 0, totalGross: 0, totalDeduction: 0, totalPph21: 0, totalNet: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Per-row "just saved" indicator (id → timestamp). Used to flash a green ✓
  // next to the row for ~1.5s after a successful field edit, so the user sees
  // their onBlur edit was persisted.
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});

  // 2026-06-24: 일괄 선택 — SUBMITTED 행은 제외 (수정 불가)
  const tBulk = useTranslations('bulk');
  const selectableIds = payslips.filter(p => p.status !== 'SUBMITTED').map(p => p.id);
  const sel = useBulkSelect(selectableIds);
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkDelete = async () => {
    if (sel.selectedCount === 0) return;
    if (!confirm(tBulk('bulkDeleteConfirm', { count: sel.selectedCount }))) return;
    setBulkBusy(true);
    const ids = Array.from(sel.selectedIds);
    const results = await Promise.allSettled(
      ids.map(id => fetch(`/api/tax/monthly-payslip?id=${id}`, { method: 'DELETE' })),
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    showMsg(fail === 0 ? 'success' : 'error',
      fail === 0
        ? tBulk('bulkDeleteDone', { count: ok })
        : tBulk('bulkDeletePartial', { ok, fail }));
    sel.clear();
    setBulkBusy(false);
    loadPayslips();
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadPayslips = useCallback(async () => {
    if (!customerId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tax/monthly-payslip?customerId=${customerId}&period=${period}`);
      const data = await res.json();
      if (data.success) {
        setPayslips(data.data || []);
        setSummary(data.summary || { totalEmployees: 0, totalGross: 0, totalDeduction: 0, totalPph21: 0, totalNet: 0 });
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [customerId, period]);

  useEffect(() => { loadPayslips(); }, [loadPayslips, reloadTrigger]);

  // 2026-06-21: "전체 직원 급여명세 생성" 흐름 제거. 대신 "최종 제출" (DRAFT → SUBMITTED).
  const submitPayslips = async () => {
    const draftCount = payslips.filter(p => p.status === 'DRAFT').length;
    if (draftCount === 0) return;

    // 2026-08-30 — MASTER 지정 필수항목 미입력이면 제출 차단.
    const bad: string[] = [];
    for (const ps of payslips.filter(p => p.status === 'DRAFT')) {
      for (const lbl of payslipMissing(ps)) bad.push(`${ps.employee_name || tp('noNpwp')} · ${lbl}`);
    }
    if (bad.length > 0) {
      showMsg('error', `${tp('requiredMissingBlock')} — ${bad.slice(0, 6).join(', ')}${bad.length > 6 ? ` 외 ${bad.length - 6}건` : ''}`);
      return;
    }

    if (!confirm(tp('submitConfirm', { period, count: draftCount }))) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/tax/monthly-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, period, action: 'submit' }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', tp('submittedToast', { count: data.submitted }));
        loadPayslips();
      } else {
        showMsg('error', data.error || tp('saveFailed'));
      }
    } catch { showMsg('error', tp('saveFailed')); }
    finally { setIsSaving(false); }
  };

  const deletePayslip = async (id: string) => {
    if (!confirm(tp('confirmDelete'))) return;
    try {
      const res = await fetch(`/api/tax/monthly-payslip?id=${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setExpandedId(null);
        showMsg('success', tp('deletedToast'));
        loadPayslips();
      } else {
        showMsg('error', data.error || tp('saveFailed'));
      }
    } catch {
      showMsg('error', tp('saveFailed'));
    }
  };

  // 2026-08-30 (Model B): 급여 상세의 직원 정보는 payslip(신고 데이터) 자체 필드다.
  // 직원목록(마스터)과 완전 분리 — 여기서의 편집은 payslip PUT 으로만 저장되고
  // 마스터에는 전혀 영향을 주지 않는다. (인사정보는 계산에 미사용, 신고별 스냅샷)
  const commitEmployeeField = (ps: Payslip, field: keyof Payslip, value: string) => {
    // 직원정보는 정보성(금액 무관)이라 제출(SUBMITTED) 후에도 편집 허용 —
    // 급여/수당 등 금액 필드와 동일하게 항상 편집 가능.
    const current = (ps[field] ?? '') as string;
    if (value === current) return;
    updatePayslip(ps.id, { [field]: value || null } as Partial<Payslip>);
  };

  const updatePayslip = async (id: string, updates: Partial<Payslip>) => {
    try {
      const res = await fetch('/api/tax/monthly-payslip', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        // Update locally
        setPayslips(prev => prev.map(p => p.id === id ? data.data : p));
        // Mark this row as just-saved (UI flashes ✓ for ~1.5s)
        setSavedAt(prev => ({ ...prev, [id]: Date.now() }));
        setTimeout(() => {
          setSavedAt(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 1500);
        showMsg('success', tp('savedToast'));
        // Refresh summary
        loadPayslips();
      } else {
        showMsg('error', data.error || tp('saveFailed'));
      }
    } catch {
      showMsg('error', tp('saveFailed'));
    }
  };

  // Month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">{tp('periodLabel')}</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* 2026-06-24: 일괄 선택 헤더 체크박스 + 삭제 */}
          {selectableIds.length > 0 && (
            <>
              <label className="flex items-center gap-1 ml-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={sel.isAllSelected}
                  ref={el => { if (el) el.indeterminate = sel.isPartiallySelected; }}
                  onChange={sel.toggleAll}
                />
                <span className="text-gray-600">{tp('selectAll')}</span>
              </label>
              {sel.selectedCount > 0 && (
                <>
                  <span className="text-xs text-gray-600">{tBulk('bulkSelectedN', { count: sel.selectedCount })}</span>
                  <Button size="sm" variant="ghost" className="text-red-600 text-xs h-7" disabled={bulkBusy} onClick={bulkDelete}>
                    {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
                    {tBulk('bulkDelete')}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
        {(() => {
          const draftCount = payslips.filter(p => p.status === 'DRAFT').length;
          const submittedCount = payslips.filter(p => p.status === 'SUBMITTED').length;
          if (payslips.length === 0) return null;
          if (draftCount === 0) {
            return (
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                ✓ {tp('allSubmittedBadge')} ({submittedCount})
              </span>
            );
          }
          return (
            <Button size="sm" onClick={submitPayslips} disabled={isSaving || !customerId}>
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {tp('submitButton')} ({draftCount})
            </Button>
          );
        })()}
      </div>

      {/* Message */}
      {message && (
        <div className={cn(
          'p-3 rounded-xl text-sm flex items-center gap-2',
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        )}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Summary */}
      {payslips.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 flex items-center gap-1"><Users className="h-3 w-3" />{tp('employeeCount')}</p>
              <p className="font-bold text-lg">{summary.totalEmployees}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 flex items-center gap-1"><DollarSign className="h-3 w-3" />{tp('totalPay')}</p>
              <p className="font-bold text-sm">{fmtRp(summary.totalGross)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
            <CardContent className="p-3">
              <p className="text-xs text-blue-600">{tp('pph21Total')}</p>
              <p className="font-bold text-sm text-blue-700">{fmtRp(summary.totalPph21)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm border-l-4 border-l-green-500">
            <CardContent className="p-3">
              <p className="text-xs text-green-600">{tp('netPayTotal')}</p>
              <p className="font-bold text-sm text-green-700">{fmtRp(summary.totalNet)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>
      ) : payslips.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-gray-400">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-1">{tp('emptyTitle', { period })}</p>
            <p className="text-xs">{tp('emptyHintNew')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payslips.map(ps => {
            const isExpanded = expandedId === ps.id;
            return (
              <Card key={ps.id} className={`border-0 shadow-sm ${sel.isSelected(ps.id) ? 'ring-2 ring-red-200' : ''}`}>
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    {/* 2026-06-24: 체크박스 (SUBMITTED 행은 disabled) */}
                    <div className="flex items-center px-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={sel.isSelected(ps.id)}
                        disabled={ps.status === 'SUBMITTED'}
                        onChange={() => sel.toggle(ps.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    {/* Summary row */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : ps.id)}
                      className="flex-1 p-4 flex items-center justify-between hover:bg-blue-50/40 transition-colors group"
                      title={tp('editHint')}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      <div className="text-left min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-sm truncate">{ps.employee_name || tp('noNpwp')}{reqStar('employee_name')}</p>
                          {ps.status === 'SUBMITTED' ? (
                            <span className="inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700">
                              ✓ {tp('submittedBadge')}
                            </span>
                          ) : (
                            <span className="inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700">
                              {tp('draftBadge')}
                            </span>
                          )}
                          {/* 2026-08-30 — 필수항목 누락 표시 */}
                          {(() => { const m = payslipMissing(ps); return m.length > 0 ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700" title={`${tp('requiredMissingBlock')}: ${m.join(', ')}`}>
                              <span className="font-bold">*</span>{tp('requiredMissingBadge')} {m.length}
                            </span>
                          ) : null; })()}
                          {(() => {
                            const es = ps.employment_status ?? ps.employee?.employment_status;
                            return es ? (
                            <span
                              className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                es === 'PKWTT' ? 'bg-emerald-100 text-emerald-700' :
                                es === 'PKWT' ? 'bg-amber-100 text-amber-700' :
                                'bg-purple-100 text-purple-700'
                              }`}
                              title={
                                es === 'PKWTT' ? 'Pegawai Tetap (1)' :
                                es === 'PKWT' ? 'Pegawai Tidak Tetap (2)' :
                                'Bukan Pegawai (3)'
                              }
                            >
                              {es}
                            </span>
                            ) : null;
                          })()}
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {ps.ptkp_category} • {ps.employee_npwp || tp('noNpwp')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs flex-shrink-0">
                      <div className="text-right">
                        <p className="text-gray-400 text-[10px]">{tp('totalPay')}</p>
                        <p className="font-mono">{fmtRp(ps.total_gross)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-500 text-[10px]">PPh 21</p>
                        <p className="font-mono text-blue-600 font-medium">{fmtRp(ps.pph21_tax)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-500 text-[10px]">{tp('netPay')}</p>
                        <p className="font-mono text-green-600 font-bold">{fmtRp(ps.net_salary)}</p>
                      </div>
                      {/* Edit affordance: just-saved ✓ or pencil hint */}
                      {savedAt[ps.id] ? (
                        <span className="flex items-center gap-1 text-green-600 text-[11px] font-medium animate-pulse">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {tp('savedToast')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400 group-hover:text-blue-600 text-[11px] transition-colors">
                          <Pencil className="h-3 w-3" />
                          {tp('editHint')}
                        </span>
                      )}
                    </div>
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t p-4 bg-gray-50/50 space-y-4">
                      {/* Edit hint banner */}
                      <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-900 flex items-center gap-2">
                        <Pencil className="h-3.5 w-3.5 shrink-0" />
                        <span>{tp('editBanner')}</span>
                      </div>

                      {/* 2026-06-26: 직원 마스터 식별/HR 정보 — 양식에서 수집했지만
                          상세에 안 보여서 사용자가 어느 직원인지 즉시 못 알아보던 정보.
                          payslip 자체에서 우선, 없으면 employee join 에서 fallback. */}
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="mb-2">
                          <h4 className="text-xs font-bold text-gray-600">{tp('secEmployeeInfo')}</h4>
                          <p className="text-[10px] text-gray-400 mt-0.5">{tp('secEmployeeInfoHint')}</p>
                        </div>
                        {(() => {
                          // 금액 필드와 마찬가지로 제출 후에도 직원정보는 편집 가능 (정보성).
                          const disabled = false;
                          // Model B: 모든 편집은 payslip(신고 데이터) 컬럼에 직접 저장.
                          const commit = (field: keyof Payslip, value: string) => {
                            commitEmployeeField(ps, field, value);
                          };
                          // payslip 값 우선, 없으면 legacy 마스터 join 표시용 fallback.
                          const num = ps.employee_number ?? ps.employee?.employee_number ?? '';
                          const nik = ps.employee_nik ?? ps.employee?.employee_nik ?? '';
                          const pos = ps.position ?? ps.employee?.position ?? '';
                          const dept = ps.department ?? ps.employee?.department ?? '';
                          const hire = ps.hire_date ?? ps.employee?.hire_date ?? '';
                          const resign = ps.resign_date ?? ps.employee?.resign_date ?? '';
                          const empStatus = ps.employment_status ?? ps.employee?.employment_status ?? '';
                          const wtype = ps.worker_type ?? ps.employee?.worker_type ?? 'REGULAR';
                          const cellCls = 'h-8 text-xs';
                          return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <p className="text-[10px] text-gray-400">{tp('fieldEmployeeNo')}</p>
                            <Input className={cellCls + ' font-mono'} defaultValue={num} disabled={disabled}
                              onBlur={e => commit('employee_number', e.target.value.trim())} />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">NPWP{reqStar('employee_npwp')}</p>
                            <Input className={cellCls + ' font-mono'} defaultValue={ps.employee_npwp || ''} disabled={disabled}
                              onBlur={e => commit('employee_npwp', e.target.value.trim())} />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">NIK{reqStar('NIK')}</p>
                            <Input className={cellCls + ' font-mono'} defaultValue={nik} disabled={disabled}
                              onBlur={e => commit('employee_nik', e.target.value.trim())} />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">PTKP{reqStar('ptkp')}</p>
                            <select className="h-8 w-full rounded border border-gray-300 px-1 text-xs bg-white font-mono"
                              value={ps.ptkp_category || 'TK0'} disabled={disabled}
                              onChange={e => commit('ptkp_category', e.target.value)}>
                              {['TK0','TK1','TK2','TK3','K0','K1','K2','K3','KI0','KI1','KI2','KI3'].map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">{tp('fieldEmploymentStatus')}{reqStar('employment_status')}</p>
                            <select className="h-8 w-full rounded border border-gray-300 px-1 text-xs bg-white"
                              value={empStatus} disabled={disabled}
                              onChange={e => commit('employment_status', e.target.value)}>
                              <option value="">—</option>
                              <option value="PKWTT">Pegawai Tetap (1)</option>
                              <option value="PKWT">Pegawai Tidak Tetap (2)</option>
                              <option value="Consultant">Bukan Pegawai (3)</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">{tp('fieldWorkerType')}</p>
                            <select className="h-8 w-full rounded border border-gray-300 px-1 text-xs bg-white"
                              value={wtype} disabled={disabled}
                              onChange={e => commit('worker_type', e.target.value)}>
                              {['REGULAR','CONTRACT','DAILY','FREELANCER','COMMISSIONER'].map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">{tp('fieldPosition')}</p>
                            <Input className={cellCls} defaultValue={pos} disabled={disabled}
                              onBlur={e => commit('position', e.target.value.trim())} />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">{tp('fieldDepartment')}</p>
                            <Input className={cellCls} defaultValue={dept} disabled={disabled}
                              onBlur={e => commit('department', e.target.value.trim())} />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">{tp('fieldHireDate')}</p>
                            <Input type="date" className={cellCls + ' font-mono'} defaultValue={hire} disabled={disabled}
                              onBlur={e => commit('hire_date', e.target.value)} />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">{tp('fieldResignDate')}</p>
                            <Input type="date" className={cellCls + ' font-mono'} defaultValue={resign} disabled={disabled}
                              onBlur={e => commit('resign_date', e.target.value)} />
                          </div>
                        </div>
                          );
                        })()}
                      </div>

                      {/* 2026-08-30 — 세금 방식(Gross/Gross-up) 결정. 필수. */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('taxMethodLabel')}{reqStar('tax_method')}</h4>
                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            className="h-8 w-56 rounded border border-gray-300 px-2 text-xs bg-white"
                            value={(ps.tax_method || 'GROSS').toUpperCase()}
                            onChange={e => updatePayslip(ps.id, { tax_method: e.target.value })}
                          >
                            <option value="GROSS">{tp('taxMethodGross')}</option>
                            <option value="GROSS_UP">{tp('taxMethodGrossUp')}</option>
                          </select>
                          <span className="text-[10px] text-gray-400">
                            {(ps.tax_method || 'GROSS').toUpperCase() === 'GROSS_UP' ? tp('taxMethodGrossUpHint') : tp('taxMethodGrossHint')}
                          </span>
                        </div>
                      </div>

                      {/* 근태 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('attendance')}</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('workDays')}</Label>
                            <NumberInput className="h-8 text-xs" value={ps.working_days}
                              onCommit={n => updatePayslip(ps.id, { working_days: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('absentDays')}</Label>
                            <NumberInput className="h-8 text-xs" value={ps.absent_days}
                              onCommit={n => updatePayslip(ps.id, { absent_days: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('overtime')}</Label>
                            <NumberInput className="h-8 text-xs" value={ps.overtime_hours}
                              onCommit={n => updatePayslip(ps.id, { overtime_hours: n })} />
                          </div>
                        </div>
                      </div>

                      {/* 기본급 + 수당 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('baseSalary')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('base')}{reqStar('base_salary')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.base_salary}
                              onCommit={n => updatePayslip(ps.id, { base_salary: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('overtimePay')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.overtime_pay}
                              onCommit={n => updatePayslip(ps.id, { overtime_pay: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('mealAllowance')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.meal_allowance}
                              onCommit={n => updatePayslip(ps.id, { meal_allowance: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('transportAllowance')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.transport_allowance}
                              onCommit={n => updatePayslip(ps.id, { transport_allowance: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('positionAllowance')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.position_allowance}
                              onCommit={n => updatePayslip(ps.id, { position_allowance: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('otherAllowance')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.other_allowances}
                              onCommit={n => updatePayslip(ps.id, { other_allowances: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('laptopAllowance')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.laptop_allowance}
                              onCommit={n => updatePayslip(ps.id, { laptop_allowance: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('medicalAllowance')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.medical_allowance}
                              onCommit={n => updatePayslip(ps.id, { medical_allowance: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('taxAllowance')}{(ps.tax_method || 'GROSS').toUpperCase() === 'GROSS_UP' && <span className="ml-1 text-[9px] text-indigo-500">(자동)</span>}</Label>
                            {(ps.tax_method || 'GROSS').toUpperCase() === 'GROSS_UP' ? (
                              <div className="flex h-8 items-center rounded border border-indigo-200 bg-indigo-50/40 px-2 text-xs font-mono text-indigo-700">
                                {fmtRp(ps.tax_allowance)}
                              </div>
                            ) : (
                              <NumberInput className="h-8 text-xs font-mono" value={ps.tax_allowance}
                                onCommit={n => updatePayslip(ps.id, { tax_allowance: n })} />
                            )}
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('annualLeavePay')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.annual_leave_pay}
                              onCommit={n => updatePayslip(ps.id, { annual_leave_pay: n })} />
                          </div>
                        </div>
                      </div>

                      {/* 특수 지급 (퇴직/계약직) */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('specialPay')} <span className="text-[10px] text-gray-400 font-normal">({tp('specialPaySub')})</span></h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('severance')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.severance_allowance}
                              onCommit={n => updatePayslip(ps.id, { severance_allowance: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('pkwtCompensation')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.pkwt_compensation}
                              onCommit={n => updatePayslip(ps.id, { pkwt_compensation: n })} />
                          </div>
                        </div>
                      </div>

                      {/* 보너스 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('bonusSection')}</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('bonusSection')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.bonus}
                              onCommit={n => updatePayslip(ps.id, { bonus: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('thr')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.thr}
                              onCommit={n => updatePayslip(ps.id, { thr: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('commission')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.commission}
                              onCommit={n => updatePayslip(ps.id, { commission: n })} />
                          </div>
                        </div>
                      </div>

                      {/* 공제 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('deductions')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('bpjsHealth')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.bpjs_kesehatan}
                              onCommit={n => updatePayslip(ps.id, { bpjs_kesehatan: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('bpjsEmployment')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.bpjs_ketenagakerjaan}
                              onCommit={n => updatePayslip(ps.id, { bpjs_ketenagakerjaan: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">JHT</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.jht_employee}
                              onCommit={n => updatePayslip(ps.id, { jht_employee: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('pension')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.jp_employee}
                              onCommit={n => updatePayslip(ps.id, { jp_employee: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('loanRepayment')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.loan_deduction}
                              onCommit={n => updatePayslip(ps.id, { loan_deduction: n })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('otherDeduction')}</Label>
                            <NumberInput className="h-8 text-xs font-mono" value={ps.other_deductions}
                              onCommit={n => updatePayslip(ps.id, { other_deductions: n })} />
                          </div>
                        </div>
                      </div>

                      {/* 회사 부담 BPJS ({tp('companyBpjsSub')}) */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('companyBpjs')} <span className="text-[10px] text-gray-400 font-normal">({tp('companyBpjsSub')})</span></h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                          <div className="bg-white rounded p-2">
                            <p className="text-[10px] text-gray-400">BPJS KES 4%</p>
                            <p className="font-mono">{fmtRp(ps.bpjs_kes_company)}</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-[10px] text-gray-400">JKK 0.24%</p>
                            <p className="font-mono">{fmtRp(ps.jkk_company)}</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-[10px] text-gray-400">JKM 0.30%</p>
                            <p className="font-mono">{fmtRp(ps.jkm_company)}</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-[10px] text-gray-400">JHT 3.70%</p>
                            <p className="font-mono">{fmtRp(ps.jht_company)}</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-[10px] text-gray-400">JP 2.00%</p>
                            <p className="font-mono">{fmtRp(ps.jp_company)}</p>
                          </div>
                        </div>
                      </div>

                      {/* 비아야 자바탄 + 은행 정보 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('biayaJabatan')}</h4>
                          <div className="bg-white rounded p-2 text-xs">
                            <p className="text-[10px] text-gray-400">{tp('biayaJabatanDesc')}</p>
                            <p className="font-mono font-bold">{fmtRp(ps.personal_expense)}</p>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('bankInfo')}</h4>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px] text-gray-400">{tp('bank')}</Label>
                              <Input className="h-8 text-xs" defaultValue={ps.bank_name || ''}
                                onBlur={e => updatePayslip(ps.id, { bank_name: e.target.value || null } as Partial<Payslip>)} />
                            </div>
                            <div>
                              <Label className="text-[10px] text-gray-400">{tp('accountNo')}</Label>
                              <Input className="h-8 text-xs font-mono" defaultValue={ps.bank_account_no || ''}
                                onBlur={e => updatePayslip(ps.id, { bank_account_no: e.target.value || null } as Partial<Payslip>)} />
                            </div>
                            <div>
                              <Label className="text-[10px] text-gray-400">{tp('accountName')}</Label>
                              <Input className="h-8 text-xs" defaultValue={ps.bank_account_name || ''}
                                onBlur={e => updatePayslip(ps.id, { bank_account_name: e.target.value || null } as Partial<Payslip>)} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 계산 결과 */}
                      <div className="bg-blue-50 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-gray-500">{tp('totalPay')}</p>
                          <p className="font-bold text-sm">{fmtRp(ps.total_gross)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{tp('totalDeduction')}</p>
                          <p className="font-bold text-sm">{fmtRp(ps.total_deduction)}</p>
                        </div>
                        <div>
                          <p className="text-blue-600 flex items-center gap-1"><Calculator className="h-3 w-3" />PPh 21 (TER {(ps.ter_rate * 100).toFixed(1)}%)</p>
                          <p className="font-bold text-sm text-blue-700">{fmtRp(ps.pph21_tax)}</p>
                        </div>
                        <div>
                          <p className="text-green-600">{tp('netPayAmount')}</p>
                          <p className="font-bold text-sm text-green-700">{fmtRp(ps.net_salary)}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 mt-2">
                        <Button size="sm" variant="ghost" className="text-red-500 text-xs" onClick={() => deletePayslip(ps.id)}>
                          <X className="h-3 w-3 mr-1" />{tp('deleteButton')}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {/* 2026-06-24: 리스트 마지막에도 최종 제출 버튼 — 길어진 리스트에서
              사용자가 위로 스크롤하지 않아도 되도록 */}
          {(() => {
            const draftCount = payslips.filter(p => p.status === 'DRAFT').length;
            const submittedCount = payslips.filter(p => p.status === 'SUBMITTED').length;
            if (draftCount === 0) {
              return (
                <div className="mt-4 flex justify-end">
                  <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                    ✓ {tp('allSubmittedBadge')} ({submittedCount})
                  </span>
                </div>
              );
            }
            return (
              <div className="mt-4 flex justify-end">
                <Button onClick={submitPayslips} disabled={isSaving || !customerId}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  {tp('submitButton')} ({draftCount})
                </Button>
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
