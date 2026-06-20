'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Plus, Save, ChevronDown, ChevronRight, Users,
  DollarSign, AlertTriangle, CheckCircle, Calculator, Pencil,
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
  employee?: { id: string; employee_name: string; employee_npwp: string; ptkp_category: string; gross_salary: number; employment_status?: string | null };
}

interface Props {
  customerId: string;
}

export function MonthlyPayslipTab({ customerId }: Props) {
  const tp = useTranslations('monthlyPayslip');
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

  useEffect(() => { loadPayslips(); }, [loadPayslips]);

  const generatePayslips = async () => {
    if (!confirm(tp('confirmGenerate', { period }))) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/tax/monthly-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, period }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', data.message);
        loadPayslips();
      } else {
        showMsg('error', data.error);
      }
    } catch { showMsg('error', 'Failed'); }
    finally { setIsSaving(false); }
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">{tp('periodLabel')}</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {payslips.length === 0 && (
          <Button size="sm" onClick={generatePayslips} disabled={isSaving || !customerId}>
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {tp('generateBtn', { period })}
          </Button>
        )}
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
            <p className="text-xs">{tp('emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payslips.map(ps => {
            const isExpanded = expandedId === ps.id;
            return (
              <Card key={ps.id} className="border-0 shadow-sm">
                <CardContent className="p-0">
                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : ps.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-blue-50/40 transition-colors group"
                    title={tp('editHint')}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      <div className="text-left min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-sm truncate">{ps.employee?.employee_name}</p>
                          {ps.employee?.employment_status && (
                            <span
                              className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                ps.employee.employment_status === 'PKWTT' ? 'bg-emerald-100 text-emerald-700' :
                                ps.employee.employment_status === 'PKWT' ? 'bg-amber-100 text-amber-700' :
                                'bg-purple-100 text-purple-700'
                              }`}
                              title={
                                ps.employee.employment_status === 'PKWTT' ? 'Pegawai Tetap (1) — 정직원' :
                                ps.employee.employment_status === 'PKWT' ? 'Pegawai Tidak Tetap (2) — 비정직원' :
                                'Bukan Pegawai (3) — 외부'
                              }
                            >
                              {ps.employee.employment_status}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {ps.employee?.ptkp_category} • {ps.employee?.employee_npwp || tp('noNpwp')}
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

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t p-4 bg-gray-50/50 space-y-4">
                      {/* Edit hint banner */}
                      <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-900 flex items-center gap-2">
                        <Pencil className="h-3.5 w-3.5 shrink-0" />
                        <span>{tp('editBanner')}</span>
                      </div>

                      {/* 근태 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('attendance')}</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('workDays')}</Label>
                            <Input type="number" className="h-8 text-xs" defaultValue={ps.working_days}
                              onBlur={e => updatePayslip(ps.id, { working_days: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('absentDays')}</Label>
                            <Input type="number" className="h-8 text-xs" defaultValue={ps.absent_days}
                              onBlur={e => updatePayslip(ps.id, { absent_days: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('overtime')}</Label>
                            <Input type="number" className="h-8 text-xs" defaultValue={ps.overtime_hours}
                              onBlur={e => updatePayslip(ps.id, { overtime_hours: Number(e.target.value) })} />
                          </div>
                        </div>
                      </div>

                      {/* 기본급 + 수당 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('baseSalary')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('base')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.base_salary}
                              onBlur={e => updatePayslip(ps.id, { base_salary: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('overtimePay')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.overtime_pay}
                              onBlur={e => updatePayslip(ps.id, { overtime_pay: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('mealAllowance')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.meal_allowance}
                              onBlur={e => updatePayslip(ps.id, { meal_allowance: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('transportAllowance')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.transport_allowance}
                              onBlur={e => updatePayslip(ps.id, { transport_allowance: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('positionAllowance')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.position_allowance}
                              onBlur={e => updatePayslip(ps.id, { position_allowance: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('otherAllowance')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.other_allowances}
                              onBlur={e => updatePayslip(ps.id, { other_allowances: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('laptopAllowance')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.laptop_allowance}
                              onBlur={e => updatePayslip(ps.id, { laptop_allowance: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('medicalAllowance')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.medical_allowance}
                              onBlur={e => updatePayslip(ps.id, { medical_allowance: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('taxAllowance')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.tax_allowance}
                              onBlur={e => updatePayslip(ps.id, { tax_allowance: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('annualLeavePay')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.annual_leave_pay}
                              onBlur={e => updatePayslip(ps.id, { annual_leave_pay: Number(e.target.value) })} />
                          </div>
                        </div>
                      </div>

                      {/* 특수 지급 (퇴직/계약직) */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('specialPay')} <span className="text-[10px] text-gray-400 font-normal">({tp('specialPaySub')})</span></h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('severance')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.severance_allowance}
                              onBlur={e => updatePayslip(ps.id, { severance_allowance: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('pkwtCompensation')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.pkwt_compensation}
                              onBlur={e => updatePayslip(ps.id, { pkwt_compensation: Number(e.target.value) })} />
                          </div>
                        </div>
                      </div>

                      {/* 보너스 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('bonusSection')}</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('bonusSection')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.bonus}
                              onBlur={e => updatePayslip(ps.id, { bonus: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('thr')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.thr}
                              onBlur={e => updatePayslip(ps.id, { thr: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('commission')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.commission}
                              onBlur={e => updatePayslip(ps.id, { commission: Number(e.target.value) })} />
                          </div>
                        </div>
                      </div>

                      {/* 공제 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('deductions')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('bpjsHealth')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.bpjs_kesehatan}
                              onBlur={e => updatePayslip(ps.id, { bpjs_kesehatan: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('bpjsEmployment')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.bpjs_ketenagakerjaan}
                              onBlur={e => updatePayslip(ps.id, { bpjs_ketenagakerjaan: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">JHT</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.jht_employee}
                              onBlur={e => updatePayslip(ps.id, { jht_employee: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('pension')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.jp_employee}
                              onBlur={e => updatePayslip(ps.id, { jp_employee: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('loanRepayment')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.loan_deduction}
                              onBlur={e => updatePayslip(ps.id, { loan_deduction: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">{tp('otherDeduction')}</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.other_deductions}
                              onBlur={e => updatePayslip(ps.id, { other_deductions: Number(e.target.value) })} />
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
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
