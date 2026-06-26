'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/hooks/useSession';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';
import {
  Users, Plus, Loader2, CheckCircle, AlertTriangle, Save, X,
  Edit2, Trash2, Calculator, Sparkles, FileText,
  Upload, Download, Shield, ChevronDown, ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { MonthlyPayslipTab } from '@/components/pph21/MonthlyPayslipTab';
import { ScreenHeader } from '@/components/tax';
import { fmtRp } from '@/lib/utils';
import { PageTitle } from '@/components/layout/PageTitle';
import { parseTabularFile, rowsToCsv } from '@/lib/tax/bulk-import/client-file-parser';

interface Employee {
  id: string;
  employee_name: string;
  employee_npwp: string | null;
  employee_nik: string | null;
  ptkp_category: string;
  gross_salary: number;
  jht_employee: number;
  jp_employee: number;
  position_allowance: number;
  other_deductions: number;
  is_active: boolean;
  worker_type?: 'REGULAR' | 'CONTRACT' | 'DAILY' | 'FREELANCER' | 'COMMISSIONER' | null;
  // PMK 66/2023 — PKWTT (Pegawai Tetap, 1) / PKWT (Tidak Tetap, 2) / Consultant (Bukan Pegawai, 3)
  employment_status?: 'PKWTT' | 'PKWT' | 'Consultant' | string | null;
  // Additional allowances + BPJS (master)
  meal_allowance?: number | null;
  transport_allowance?: number | null;
  other_allowances?: number | null;
  bpjs_kesehatan?: number | null;
  bonus?: number | null;
  thr?: number | null;
  // HR record (Phase C)
  hire_date?: string | null;
  resign_date?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  position?: string | null;
  department?: string | null;
  employee_number?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_account_name?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
}

const PTKP_OPTIONS = ['TK0','TK1','TK2','TK3','K0','K1','K2','K3','KI0','KI1','KI2','KI3'];

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }

const emptyForm = {
  id: '',
  // Identity
  employeeName: '', employeeNpwp: '', employeeNik: '', ptkpCategory: 'TK0',
  // Salary baseline
  grossSalary: '', jhtEmployee: '', jpEmployee: '', otherDeductions: '',
  // Allowances + BPJS — 표준 양식 col 8/10/11/12/14/15/26 매핑
  positionAllowance: '', mealAllowance: '', transportAllowance: '', otherAllowance: '',
  bpjsKesehatan: '', bonus: '', thr: '',
  // HR record
  employeeNumber: '', position: '', department: '', workerType: 'REGULAR',
  employmentStatus: '', // PMK 66/2023 — PKWTT (1) / PKWT (2) / Consultant (3)
  hireDate: '', resignDate: '', birthDate: '', gender: '', maritalStatus: '',
  email: '', phone: '', address: '',
  bankName: '', bankAccountNo: '', bankAccountName: '',
  emergencyContactName: '', emergencyContactPhone: '', notes: '',
};

export default function PPh21PayrollPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const tp = useTranslations('pph21Page');
  const tsc = useTranslations('taxScreen');
  const tps = useTranslations('monthlyPayslip');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  // 2026-06-24: master 탭 제거 후 payslipMode / activeTab 의미 없어져 정리.
  // 2026-06-21: 직원 마스터 sync 상태 (이전 달까지 sync 됐는지)
  const [syncStatus, setSyncStatus] = useState<{ syncedThrough: string | null; pendingThrough: string | null; hasPending: boolean } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  // 월별 급여 자료 (MonthlyPayslipTab) 재조회 트리거 — 업로드 완료 시 +1
  const [payslipReload, setPayslipReload] = useState(0);

  // Group employees by worker_type for summary cards
  const workerSummary = useMemo(() => {
    const groups = {
      REGULAR: { count: 0, total: 0 },
      CONTRACT: { count: 0, total: 0 },
      FREELANCER: { count: 0, total: 0 },
      DAILY: { count: 0, total: 0 },
    };
    for (const e of employees) {
      const t = (e.worker_type || 'REGULAR') as keyof typeof groups;
      if (groups[t]) {
        groups[t].count += 1;
        groups[t].total += Number(e.gross_salary) || 0;
      }
    }
    return groups;
  }, [employees]);

  // TER calculation results
  const [calcResults, setCalcResults] = useState<Record<string, { taxAmount: number; terRate: number }>>({});

  // Consultant/customer-aware customerId. PPh 21 needs employee/payroll
  // data which only COMPANY customers have, so we filter the consultant's
  // customer dropdown to COMPANY rows.
  const {
    customerId,
    isConsultant,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
  } = useEffectiveCustomerId({ companyOnly: true });

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadEmployees = useCallback(async () => {
    if (!customerId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tax/employees?customerId=${customerId}`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data.employees || []);
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [customerId]);

  const loadSyncStatus = useCallback(async () => {
    if (!customerId) return;
    try {
      const res = await fetch(`/api/tax/employees/sync?customerId=${customerId}`);
      const data = await res.json();
      if (data.success) {
        setSyncStatus({ syncedThrough: data.syncedThrough, pendingThrough: data.pendingThrough, hasPending: data.hasPending });
      }
    } catch { /* */ }
  }, [customerId]);

  const runSync = useCallback(async () => {
    if (!customerId || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/tax/employees/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', tps('syncSuccess', { added: data.added, updated: data.updated, through: data.through }));
        await loadEmployees();
        await loadSyncStatus();
      } else {
        showMsg('error', data.error || tps('syncFail'));
      }
    } catch {
      showMsg('error', tps('syncFail'));
    } finally {
      setIsSyncing(false);
    }
  }, [customerId, isSyncing, tps, loadEmployees, loadSyncStatus]);

  useEffect(() => {
    if (sessionLoading) return;
    loadEmployees();
    loadSyncStatus();
  }, [sessionLoading, loadEmployees, loadSyncStatus]);

  const startEdit = (emp: Employee) => {
    setForm({
      id: emp.id,
      employeeName: emp.employee_name,
      employeeNpwp: emp.employee_npwp || '',
      employeeNik: emp.employee_nik || '',
      ptkpCategory: emp.ptkp_category,
      grossSalary: String(emp.gross_salary),
      jhtEmployee: String(emp.jht_employee),
      jpEmployee: String(emp.jp_employee),
      otherDeductions: String(emp.other_deductions),
      positionAllowance: emp.position_allowance != null ? String(emp.position_allowance) : '',
      mealAllowance: emp.meal_allowance != null ? String(emp.meal_allowance) : '',
      transportAllowance: emp.transport_allowance != null ? String(emp.transport_allowance) : '',
      otherAllowance: emp.other_allowances != null ? String(emp.other_allowances) : '',
      bpjsKesehatan: emp.bpjs_kesehatan != null ? String(emp.bpjs_kesehatan) : '',
      bonus: emp.bonus != null ? String(emp.bonus) : '',
      thr: emp.thr != null ? String(emp.thr) : '',
      employeeNumber: emp.employee_number || '',
      position: emp.position || '',
      department: emp.department || '',
      workerType: emp.worker_type || 'REGULAR',
      employmentStatus: emp.employment_status || '',
      hireDate: emp.hire_date || '',
      resignDate: emp.resign_date || '',
      birthDate: emp.birth_date || '',
      gender: emp.gender || '',
      maritalStatus: emp.marital_status || '',
      email: emp.email || '',
      phone: emp.phone || '',
      address: emp.address || '',
      bankName: emp.bank_name || '',
      bankAccountNo: emp.bank_account_no || '',
      bankAccountName: emp.bank_account_name || '',
      emergencyContactName: emp.emergency_contact_name || '',
      emergencyContactPhone: emp.emergency_contact_phone || '',
      notes: emp.notes || '',
    });
    setShowForm(true);
  };

  const saveEmployee = async () => {
    if (!customerId || !form.employeeName || !form.grossSalary) {
      showMsg('error', tp('nameAndSalaryRequired'));
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/tax/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id || undefined,
          customerId,
          employeeName: form.employeeName,
          employeeNpwp: form.employeeNpwp,
          employeeNik: form.employeeNik,
          ptkpCategory: form.ptkpCategory,
          grossSalary: parseFloat(form.grossSalary) || 0,
          jhtEmployee: parseFloat(form.jhtEmployee) || 0,
          jpEmployee: parseFloat(form.jpEmployee) || 0,
          otherDeductions: parseFloat(form.otherDeductions) || 0,
          positionAllowance: parseFloat(form.positionAllowance) || 0,
          mealAllowance: parseFloat(form.mealAllowance) || 0,
          transportAllowance: parseFloat(form.transportAllowance) || 0,
          otherAllowance: parseFloat(form.otherAllowance) || 0,
          bpjsKesehatan: parseFloat(form.bpjsKesehatan) || 0,
          bonus: parseFloat(form.bonus) || 0,
          thr: parseFloat(form.thr) || 0,
          employeeNumber: form.employeeNumber,
          position: form.position,
          department: form.department,
          workerType: form.workerType,
          employmentStatus: form.employmentStatus || null,
          hireDate: form.hireDate || null,
          resignDate: form.resignDate || null,
          birthDate: form.birthDate || null,
          gender: form.gender,
          maritalStatus: form.maritalStatus,
          email: form.email,
          phone: form.phone,
          address: form.address,
          bankName: form.bankName,
          bankAccountNo: form.bankAccountNo,
          bankAccountName: form.bankAccountName,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', form.id ? tp('employeeUpdated') : tp('employeeAdded'));
        setShowForm(false);
        setForm(emptyForm);
        loadEmployees();
      } else {
        showMsg('error', data.error || 'Failed');
      }
    } catch { showMsg('error', 'Error'); }
    finally { setIsSaving(false); }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm(tp('deactivateConfirm'))) return;
    try {
      const res = await fetch(`/api/tax/employees?id=${id}`, { method: 'DELETE' });
      if ((await res.json()).success) { showMsg('success', tp('employeeDeactivated')); loadEmployees(); }
    } catch { /* */ }
  };

  // Calculate TER for all employees
  const calculateAll = async () => {
    setIsSaving(true);
    try {
      const month = new Date().getMonth() + 1;
      // employee_payroll.employment_status (PKWTT/PKWT/Consultant) 를
      // calculator 가 기대하는 PMK 66/2023 숫자 코드 (1/2/3) 로 역매핑.
      // 빈 값이면 undefined — calculator 는 그 경우 status 1 가정.
      const STATUS_REVERSE: Record<string, 1 | 2 | 3> = { PKWTT: 1, PKWT: 2, Consultant: 3 };
      const res = await fetch('/api/tax/pph21-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employees: employees.map(e => ({
            employee_name: e.employee_name,
            employee_npwp: e.employee_npwp || '',
            employee_nik: e.employee_nik || '',
            ptkp_category: e.ptkp_category,
            gross_salary: e.gross_salary,
            jht_employee: e.jht_employee,
            jp_employee: e.jp_employee,
            position_allowance: e.position_allowance,
            other_deductions: e.other_deductions,
            has_npwp: !!e.employee_npwp,
            month,
            employment_status: e.employment_status
              ? STATUS_REVERSE[e.employment_status as keyof typeof STATUS_REVERSE]
              : undefined,
          })),
          period: 'monthly',
        }),
      });
      const data = await res.json();
      if (data.success) {
        const results: Record<string, { taxAmount: number; terRate: number }> = {};
        (data.data.results || []).forEach((r: { employee_name: string; tax_amount: number; effective_rate: number }, i: number) => {
          if (employees[i]) {
            results[employees[i].id] = { taxAmount: r.tax_amount, terRate: r.effective_rate };
          }
        });
        setCalcResults(results);
        showMsg('success', tp('calculationComplete', { count: employees.length }));
      }
    } catch { showMsg('error', 'Calculation failed'); }
    finally { setIsSaving(false); }
  };

  if (!session) {
    return <div className="container mx-auto py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>;
  }

  // Header progress step — 단일 화면이라 고정.
  const currentStep = 2;

  // Worker-type cards definition
  const workerCards: Array<{
    key: keyof typeof workerSummary;
    label: string;
    color: string;
  }> = [
    { key: 'REGULAR',    label: tp('workerRegular'),    color: 'border-blue-200 bg-blue-50' },
    { key: 'CONTRACT',   label: tp('workerContract'),   color: 'border-green-200 bg-green-50' },
    { key: 'FREELANCER', label: tp('workerFreelancer'), color: 'border-purple-200 bg-purple-50' },
    { key: 'DAILY',      label: tp('workerDaily'),      color: 'border-amber-200 bg-amber-50' },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <PageTitle title="PPh 21" />
      <ScreenHeader
        title={tp('pageTitle')}
        step={currentStep}
        aiSteps={[tsc('stepAiProcess'), tsc('stepTaxCalc'), tsc('stepIdBillingGen')]}
      />

      {/* Consultant customer picker — visible only for CONSULTANT_JTC /
          TAX_ADVISOR_JTC. CUSTOMER role keeps the existing UI unchanged. */}
      {isConsultant && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label htmlFor="pph21-customer" className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {tsc('selectCustomer')}
          </label>
          {customers.length === 0 ? (
            <span className="text-xs text-slate-400">{tsc('noAssignedCustomers')}</span>
          ) : (
            <select
              id="pph21-customer"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="flex-1 max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Worker-type summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {workerCards.map(c => {
          const g = workerSummary[c.key];
          return (
            <div key={c.key} className={`rounded-xl border p-3 ${c.color}`}>
              <p className="text-gray-600 text-xs flex items-center gap-1">
                <Users className="h-3 w-3" />{c.label}
              </p>
              <p className="font-bold text-base mt-0.5">{tp('workerCount', { count: g.count })}</p>
              <p className="text-[11px] text-gray-600 font-mono mt-0.5">{fmt(g.total)}</p>
            </div>
          );
        })}
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{message.text}
        </div>
      )}

      {/* Data input cards */}
      <div className="mb-6">
        <PPh21DataInputSection
          customerId={customerId}
          onComplete={() => { loadEmployees(); setPayslipReload(v => v + 1); }}
          showMsg={showMsg}
          // 2026-06-26: '직원 직접 등록' 은 더 이상 별도 HR 페이지로 이동하지 않고
          // 같은 페이지에서 Dialog 폼을 띄운다 — 사용자가 PPh21 흐름에서 벗어나지
          // 않고 직원 1명을 추가할 수 있도록.
          onOpenManualEntry={() => {
            setForm(emptyForm);
            setShowForm(true);
          }}
        />
      </div>

      {/* 2026-06-26: 인라인 직원 등록 Dialog — 표준 템플릿이 수집하는 모든 필드
          (사번 / 고용형태 / NPWP / NIK / tax method / 급여 / 수당 / BPJS / HR 인사정보).
          저장 후 자동 sync 호출로 현재 월 payslip 도 즉시 생성되어 리스트에 노출. */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? '직원 정보 수정' : '직원 직접 등록'}</DialogTitle>
            <DialogDescription>
              템플릿에서 수집하는 모든 필드를 입력할 수 있습니다. 이름과 월 기본급은 필수.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* 직원 식별 */}
            <div>
              <h4 className="text-xs font-bold text-gray-600 mb-2">직원 식별 / Identitas</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px]">이름 / Nama <span className="text-red-500">*</span></Label>
                  <Input value={form.employeeName} onChange={e => setForm({ ...form, employeeName: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px]">사번 / Employee No.</Label>
                  <Input value={form.employeeNumber} onChange={e => setForm({ ...form, employeeNumber: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px]">NPWP</Label>
                  <Input value={form.employeeNpwp} onChange={e => setForm({ ...form, employeeNpwp: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">NIK</Label>
                  <Input value={form.employeeNik} onChange={e => setForm({ ...form, employeeNik: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">PTKP</Label>
                  <Select value={form.ptkpCategory} onValueChange={v => setForm({ ...form, ptkpCategory: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PTKP_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">고용형태 / Status (PMK 66/2023)</Label>
                  <Select
                    value={form.employmentStatus || 'PKWTT'}
                    onValueChange={v => setForm({ ...form, employmentStatus: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKWTT">PKWTT (Pegawai Tetap, 정직원)</SelectItem>
                      <SelectItem value="PKWT">PKWT (Pegawai Tidak Tetap, 비정직원)</SelectItem>
                      <SelectItem value="Consultant">Consultant (Bukan Pegawai, 외부)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">직군 / Tax Method (Worker Type)</Label>
                  <Select value={form.workerType} onValueChange={v => setForm({ ...form, workerType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REGULAR">REGULAR (gross / TER)</SelectItem>
                      <SelectItem value="CONTRACT">CONTRACT</SelectItem>
                      <SelectItem value="DAILY">DAILY</SelectItem>
                      <SelectItem value="FREELANCER">FREELANCER</SelectItem>
                      <SelectItem value="COMMISSIONER">COMMISSIONER</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 급여 / 수당 / BPJS */}
            <div>
              <h4 className="text-xs font-bold text-gray-600 mb-2">월 급여 · 수당 · 공제 / Gaji & Tunjangan</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px]">기본급 / Gaji Pokok <span className="text-red-500">*</span></Label>
                  <Input type="number" value={form.grossSalary} onChange={e => setForm({ ...form, grossSalary: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">직책수당 / Tunj. Jabatan</Label>
                  <Input type="number" value={form.positionAllowance} onChange={e => setForm({ ...form, positionAllowance: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">식대 / Tunj. Makan</Label>
                  <Input type="number" value={form.mealAllowance} onChange={e => setForm({ ...form, mealAllowance: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">교통비 / Tunj. Transport</Label>
                  <Input type="number" value={form.transportAllowance} onChange={e => setForm({ ...form, transportAllowance: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">기타수당 / Tunj. Lainnya</Label>
                  <Input type="number" value={form.otherAllowance} onChange={e => setForm({ ...form, otherAllowance: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">BPJS Kesehatan (employee)</Label>
                  <Input type="number" value={form.bpjsKesehatan} onChange={e => setForm({ ...form, bpjsKesehatan: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">JHT (employee)</Label>
                  <Input type="number" value={form.jhtEmployee} onChange={e => setForm({ ...form, jhtEmployee: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">JP (employee)</Label>
                  <Input type="number" value={form.jpEmployee} onChange={e => setForm({ ...form, jpEmployee: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">기타 공제 / Potongan</Label>
                  <Input type="number" value={form.otherDeductions} onChange={e => setForm({ ...form, otherDeductions: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">보너스 / Bonus</Label>
                  <Input type="number" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">THR</Label>
                  <Input type="number" value={form.thr} onChange={e => setForm({ ...form, thr: e.target.value })} className="font-mono" />
                </div>
              </div>
            </div>

            {/* HR 인사정보 */}
            <div>
              <h4 className="text-xs font-bold text-gray-600 mb-2">HR 인사정보 / Data HR (선택)</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px]">직책 / Position</Label>
                  <Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px]">부서 / Department</Label>
                  <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px]">입사일 / Hire Date</Label>
                  <Input type="date" value={form.hireDate} onChange={e => setForm({ ...form, hireDate: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px]">생년월일 / Birth Date</Label>
                  <Input type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px]">성별 / Gender</Label>
                  <Select value={form.gender || 'M'} onValueChange={v => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="F">F</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">결혼 / Marital</Label>
                  <Select value={form.maritalStatus || 'SINGLE'} onValueChange={v => setForm({ ...form, maritalStatus: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE">SINGLE</SelectItem>
                      <SelectItem value="MARRIED">MARRIED</SelectItem>
                      <SelectItem value="DIVORCED">DIVORCED</SelectItem>
                      <SelectItem value="WIDOWED">WIDOWED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">이메일 / Email</Label>
                  <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px]">전화 / Phone</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-[11px]">주소 / Address</Label>
                  <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px]">은행 / Bank</Label>
                  <Input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px]">계좌번호 / Account No.</Label>
                  <Input value={form.bankAccountNo} onChange={e => setForm({ ...form, bankAccountNo: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label className="text-[11px]">예금주 / Account Name</Label>
                  <Input value={form.bankAccountName} onChange={e => setForm({ ...form, bankAccountName: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={isSaving}>
              취소
            </Button>
            <Button
              onClick={async () => {
                await saveEmployee();
                // 저장 직후 sync 한 번 — 마스터에 직원이 들어왔으면 현재 월 payslip
                // 도 즉시 생성해서 리스트에 떠 보이게.
                if (customerId) {
                  try { await runSync(); } catch { /* non-fatal */ }
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2026-06-24: 직원 인사 기록 탭 제거 — 사이드바 메뉴
          (/tax/payroll/employees) 와 중복되어 사용자 혼란.
          PPh21 페이지는 월별 급여 자료만 다룬다. */}
      <MonthlyPayslipTab customerId={customerId} reloadTrigger={payslipReload} />

    </div>
  );
}

// ══════════════════════════════════════════════════════
// Sub-component: 3가지 자료 입력 방식
// ══════════════════════════════════════════════════════
function PPh21DataInputSection({
  customerId, onComplete, showMsg, onOpenManualEntry,
}: {
  customerId: string;
  onComplete: () => void;
  showMsg: (type: 'success' | 'error', text: string) => void;
  /** 2026-06-26: 별도 HR 페이지로 navigate 대신 같은 페이지의 Dialog 를 연다. */
  onOpenManualEntry: () => void;
}) {
  const tp = useTranslations('pph21Page');
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Month picker state — opens before upload to capture which tax month the data belongs to
  const now = new Date();
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickedYear, setPickedYear] = useState<number>(now.getFullYear());
  const [pickedMonth, setPickedMonth] = useState<number>(now.getMonth() + 1);
  const [confirmedPeriod, setConfirmedPeriod] = useState<string | null>(null);

  // 2026-06-21: 미래월 업로드 차단 — 현재 연/월까지만 선택 가능.
  const yearOptions = useMemo(() => {
    const cy = new Date().getFullYear();
    return [cy - 1, cy];
  }, []);
  const maxMonthForYear = (y: number) => {
    const n = new Date();
    if (y < n.getFullYear()) return 12;
    if (y === n.getFullYear()) return n.getMonth() + 1;
    return 0;
  };

  const periodLabel = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

  const openMonthPicker = () => {
    setMonthPickerOpen(true);
  };

  const confirmMonthPicker = () => {
    const period = periodLabel(pickedYear, pickedMonth);
    setConfirmedPeriod(period);
    setMonthPickerOpen(false);
    setTimeout(() => {
      excelInputRef.current?.click();
    }, 50);
  };

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const _legacyDownloadTemplate = async () => {
    try {
    const headers = [
      // Identity + payroll (required: employee_name + gross_salary)
      'employee_name', 'employee_npwp', 'employee_nik', 'ptkp_category', 'gross_salary',
      'position_allowance', 'overtime_pay', 'meal_allowance', 'transport_allowance',
      'other_allowances', 'bonus', 'thr', 'jht_employee', 'jp_employee',
      'bpjs_kesehatan', 'other_deductions', 'worker_type',
      // HR record
      'employee_number', 'position', 'department', 'hire_date', 'resign_date',
      'birth_date', 'gender', 'marital_status', 'email', 'phone', 'address',
      'bank_name', 'bank_account_no', 'bank_account_name',
      'emergency_contact_name', 'emergency_contact_phone', 'notes',
    ];
    // 3 \uC0D8\uD50C \u2014 \uC720\uD615\uBCC4 \uC785\uB825 \uC601\uC5ED \uC2DC\uAC01\uD654.
    // \uC720\uD615 1 (REGULAR, Pegawai Tetap): \uC804\uCCB4 34 \uCEEC\uB7FC fillable.
    // \uC720\uD615 2 (CONTRACT/DAILY, Pegawai Tidak Tetap) + \uC720\uD615 3 (FREELANCER/COMMISSIONER, Bukan Pegawai):
    //   bpjs_kesehatan / jht_employee / jp_employee \u2192 \uBBF8\uC801\uC6A9 (BPJS \uC81C\uC678 \uB300\uC0C1). \uBE48 \uC140\uB85C \uB460.
    const sampleType1: (string | number)[] = [
      'John Doe (\uC720\uD6151 REGULAR)', '01.234.567.8-901.000', '3201234567890001', 'TK/0', 15000000,
      500000, 0, 300000, 200000, 0, 0, 0, 300000, 150000, 120000, 0, 'REGULAR',
      'EMP-001', 'Manager', 'Finance', '2024-01-15', '', '1990-05-20', 'M',
      'MARRIED', 'john@example.com', '+62 812 3456 7890', 'Jl. Sudirman No. 1',
      'BCA', '1234567890', 'John Doe', 'Jane Doe', '+62 812 9876 5432', '',
    ];
    const sampleType2: (string | number)[] = [
      'Budi (\uC720\uD6152 CONTRACT)', '', '3202000000000002', 'TK/0', 5000000,
      0, 200000, 150000, 100000, 0, 0, 0, '', '', '', 0, 'CONTRACT',
      'EMP-002', 'Field Worker', 'Operations', '2025-03-10', '', '1995-08-12', 'M',
      'SINGLE', '', '', 'Jl. Mawar No. 5',
      '', '', '', '', '', '6\uAC1C\uC6D4 \uB2E8\uAE30 \uACC4\uC57D',
    ];
    const sampleType3: (string | number)[] = [
      'Sari (\uC720\uD6153 FREELANCER)', '02.345.678.9-002.000', '3203000000000003', 'TK/0', 3500000,
      0, 0, 0, 0, 0, 0, 0, '', '', '', 0, 'FREELANCER',
      'EMP-003', 'Designer', 'Marketing', '2026-01-20', '', '1992-11-30', 'F',
      'SINGLE', '', '', 'Jl. Anggrek No. 7',
      '', '', '', '', '', '\uD504\uB85C\uC81D\uD2B8 \uB2E8\uC704',
    ];

    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Sheet 1: Template \u2014 headers + 3 type-tagged sample rows
    const aoa: (string | number)[][] = [headers, sampleType1, sampleType2, sampleType3];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'PPh21 \uC9C1\uC6D0 \uB370\uC774\uD130');

    // Sheet 2: Guide \u2014 \uB9E8 \uC704\uC5D0 \uC720\uD615\uBCC4 \uC785\uB825 \uC601\uC5ED \uB9E4\uD2B8\uB9AD\uC2A4 + \uCEEC\uB7FC \uC124\uBA85
    const guideRows: string[][] = [
      ['\uD83D\uDCCB \uC720\uD615\uBCC4 \uC785\uB825 \uC601\uC5ED / Pengisian per Jenis Pegawai', ''],
      ['\uC720\uD615 / Jenis', '\uC785\uB825 \uC601\uC5ED / Kolom yang berlaku'],
      ['\uC720\uD615 1 (REGULAR \u2014 Pegawai Tetap, \uC815\uC9C1\uC6D0)',
        '\uC804\uCCB4 34 \uCEEC\uB7FC \uBAA8\uB450 \uC785\uB825 \uAC00\uB2A5. BPJS(bpjs_kesehatan/jht_employee/jp_employee) \uD3EC\uD568.'],
      ['\uC720\uD615 2 (CONTRACT / DAILY \u2014 Pegawai Tidak Tetap, \uBE44\uC815\uC9C1\uC6D0)',
        'bpjs_kesehatan / jht_employee / jp_employee \uB294 \u274C \uBBF8\uC801\uC6A9 (\uBE44\uC6CC \uB450\uC138\uC694). \uB098\uBA38\uC9C0 31 \uCEEC\uB7FC\uB9CC \uC785\uB825.'],
      ['\uC720\uD615 3 (FREELANCER / COMMISSIONER \u2014 Bukan Pegawai, \uC678\uBD80\uC778)',
        '\uC720\uD615 2 \uC640 \uB3D9\uC77C \u2014 BPJS 3 \uCEEC\uB7FC \uBBF8\uC801\uC6A9. \uC784\uAE08/\uACF5\uC81C \uD56D\uBAA9 \uB300\uBD80\uBD84 0 \uB610\uB294 \uACF5\uB780.'],
      ['', ''],
      ['\uCEEC\uB7FC / Column', '\uC124\uBA85 / Keterangan'],
      ['employee_name', '\uC9C1\uC6D0 \uC774\uB984 (\uD544\uC218) / Nama karyawan (wajib)'],
      ['employee_npwp', 'NPWP (\uC120\uD0DD, \uD615\uC2DD: 01.234.567.8-901.000)'],
      ['employee_nik', '\uC8FC\uBBFC\uBC88\uD638 / NIK 16\uC790\uB9AC'],
      ['ptkp_category', 'TK/0, TK/1, TK/2, TK/3, K/0, K/1, K/2, K/3'],
      ['gross_salary', '\uC6D4 \uAE30\uBCF8\uAE09 (\uD544\uC218, \uC22B\uC790) / Gaji bulanan (wajib)'],
      ['position_allowance', '\uC9C1\uCC45 \uC218\uB2F9 / Tunjangan jabatan'],
      ['overtime_pay', '\uCD08\uACFC\uADFC\uBB34 / Uang lembur'],
      ['meal_allowance', '\uC2DD\uB300 / Tunjangan makan'],
      ['transport_allowance', '\uAD50\uD1B5\uBE44 / Tunjangan transport'],
      ['other_allowances', '\uAE30\uD0C0 \uC218\uB2F9 / Tunjangan lainnya'],
      ['bonus', '\uBCF4\uB108\uC2A4 / Bonus'],
      ['thr', 'THR / Tunjangan Hari Raya'],
      ['jht_employee', '\u26A0 \uC720\uD615 1 \uC804\uC6A9 / Hanya Tipe 1 \u2014 JHT \uADFC\uB85C\uC790 \uBD80\uB2F4 / Iuran JHT karyawan'],
      ['jp_employee', '\u26A0 \uC720\uD615 1 \uC804\uC6A9 / Hanya Tipe 1 \u2014 JP \uADFC\uB85C\uC790 \uBD80\uB2F4 / Iuran JP karyawan'],
      ['bpjs_kesehatan', '\u26A0 \uC720\uD615 1 \uC804\uC6A9 / Hanya Tipe 1 \u2014 BPJS \uAC74\uAC15\uBCF4\uD5D8 / BPJS Kesehatan'],
      ['other_deductions', '\uAE30\uD0C0 \uACF5\uC81C / Potongan lainnya'],
      ['worker_type', 'REGULAR / CONTRACT / DAILY / FREELANCER / COMMISSIONER'],
      // HR record (optional \u2014 \uC9C1\uC6D0 master \uC77C\uAD04 \uB4F1\uB85D \uC6A9)
      ['employee_number', '\uC0AC\uC6D0\uBC88\uD638 / Nomor karyawan'],
      ['position', '\uC9C1\uCC45 / Jabatan'],
      ['department', '\uBD80\uC11C / Departemen'],
      ['hire_date', '\uC785\uC0AC\uC77C YYYY-MM-DD / Tanggal masuk'],
      ['resign_date', '\uD1F4\uC0AC\uC77C YYYY-MM-DD / Tanggal keluar (\uC120\uD0DD)'],
      ['birth_date', '\uC0DD\uB144\uC6D4\uC77C YYYY-MM-DD / Tanggal lahir'],
      ['gender', 'M / F'],
      ['marital_status', 'SINGLE / MARRIED / DIVORCED / WIDOWED'],
      ['email', '\uC774\uBA54\uC77C'],
      ['phone', '\uC804\uD654\uBC88\uD638'],
      ['address', '\uC8FC\uC18C'],
      ['bank_name', '\uC740\uD589\uBA85 / Nama bank'],
      ['bank_account_no', '\uACC4\uC88C\uBC88\uD638 / Nomor rekening'],
      ['bank_account_name', '\uC608\uAE08\uC8FC / Nama pemilik rekening'],
      ['emergency_contact_name', '\uBE44\uC0C1\uC5F0\uB77D\uCC98 \uC774\uB984'],
      ['emergency_contact_phone', '\uBE44\uC0C1\uC5F0\uB77D\uCC98 \uC804\uD654'],
      ['notes', '\uBE44\uACE0 / Catatan'],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
    wsGuide['!cols'] = [{ wch: 22 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, '\uC548\uB0B4 - Petunjuk');

    XLSX.writeFile(wb, 'pph21_employee_template.xlsx');
    } catch (err) {
      showMsg('error', `${tp('templateDownloadFailed')}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */

  /**
   * Standard PPh21 template — served from `public/templates/` so the file
   * users download stays in sync with what they later upload (no in-memory
   * regeneration drift). Same pattern as `/tax/pph23` + `/tax/ppn`.
   */
  const downloadTemplate = async () => {
    try {
      const res = await fetch('/templates/pph21-template.xlsx');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pph21_employee_template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showMsg('error', `${tp('templateDownloadFailed')}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };

  // Strict template-only upload — see handleTemplateUpload below.
  // Header cell must match a template column name exactly (case-insensitive
  // trim). employee_name + gross_salary required; others optional.
  const TEMPLATE_REQUIRED_COLS = ['employee_name', 'gross_salary'] as const;
  const TEMPLATE_OPTIONAL_COLS = [
    // Identity + payroll
    'employee_npwp', 'employee_nik', 'ptkp_category', 'position_allowance',
    'overtime_pay', 'meal_allowance', 'transport_allowance', 'other_allowances',
    'bonus', 'thr', 'jht_employee', 'jp_employee', 'bpjs_kesehatan',
    'other_deductions', 'worker_type', 'employment_status',
    // HR record (Phase: employee master xlsx)
    'employee_number', 'position', 'department', 'hire_date', 'resign_date',
    'birth_date', 'gender', 'marital_status', 'email', 'phone', 'address',
    'bank_name', 'bank_account_no', 'bank_account_name',
    'emergency_contact_name', 'emergency_contact_phone', 'notes',
  ] as const;
  const TEMPLATE_ALL_COLS = [...TEMPLATE_REQUIRED_COLS, ...TEMPLATE_OPTIONAL_COLS];

  /**
   * Normalize a header cell so JTC-style variants ("BPJS Kesehatan\n_employee")
   * collapse to a comparable form ("bpjs kesehatan _employee").
   */
  const normHeader = (h: string): string =>
    h.toLowerCase().replace(/\s+/g, ' ').trim();

  /**
   * Aliases — when the canonical column name doesn't appear, accept these
   * variants from the standard PPh21 template (`public/templates/pph21-template.xlsx`).
   * Each entry is normalized via `normHeader`.
   */
  const TEMPLATE_HEADER_ALIASES: Record<string, string[]> = {
    hire_date: ['join_date'],
    bpjs_kesehatan: ['bpjs kesehatan _employee', 'bpjs kesehatan_employee', 'bpjs kesehatan'],
    other_deductions: ['potong gaji _deduction from salary', 'potongan gaji'],
    // tax method (gross/gross up) → worker_type 별도 의미는 아니지만 자리 매핑 위해
    // 임시. 양식 사용자가 'tax_method' 컬럼 채우면 server 가 그대로 처리.
    worker_type: ['tax method _gross/gross up', 'tax method', 'tax_method'],
    // PMK 66/2023 Employment status 1/2/3 → employment_status (자체 컬럼).
    // 서버 측 import 가 1→PKWTT, 2→PKWT, 3→Consultant 로 매핑.
    employment_status: ['employment status (pegawai tetap: 1, pegawai tidak tetap: 2, bukan pegawai: 3)', 'employment_status'],
    thr: ['t h r'],
  };

  /**
   * Strict template-only upload.
   * 헤더가 우리 템플릿 컬럼명과 정확히 (case-insensitive trim) 매칭되어야 함.
   * `TEMPLATE_HEADER_ALIASES` 통해 표준 템플릿 양식 (join_date 등) 의
   * 변형도 인식. employee_name + gross_salary 필수, 나머지 optional.
   * mapping confirm UI / mapping memory 호출 X — 즉시 import.
   */
  const handleTemplateUpload = async (files: FileList | null) => {
    if (!files || !customerId) return;
    const file = files[0];
    setUploading(true);
    try {
      const parsed = await parseTabularFile(file);
      const allRows = [parsed.headers, ...parsed.dataRows];

      // Find header row by anchor 'employee_name'. Templates we generate
      // place the header at row 0; tolerate a few meta rows above.
      let headerIdx = 0;
      for (let i = 0; i < Math.min(allRows.length, 5); i++) {
        if (allRows[i].some((c) => normHeader(c) === 'employee_name')) {
          headerIdx = i;
          break;
        }
      }
      const headers = allRows[headerIdx].map(normHeader);
      const dataRows = allRows.slice(headerIdx + 1).filter((r) => r.some((c) => c !== ''));

      // Strict required-column check (uses normalized headers + alias support).
      const findIdx = (target: string): number => {
        let idx = headers.indexOf(target);
        if (idx >= 0) return idx;
        const alts = TEMPLATE_HEADER_ALIASES[target];
        if (alts) {
          for (const alt of alts) {
            idx = headers.indexOf(normHeader(alt));
            if (idx >= 0) return idx;
          }
        }
        return -1;
      };

      const missing = TEMPLATE_REQUIRED_COLS.filter((col) => findIdx(col) < 0);
      if (missing.length > 0) {
        showMsg('error', tp('templateHeaderMismatch', { missing: missing.join(', ') }));
        setUploading(false);
        return;
      }

      // Build mapped CSV with template columns only (skip unknown columns).
      // alias hit 도 canonical column name 으로 CSV 헤더에 들어가 server side
      // (`/api/tax/employees/import`) 가 `getVal(cols, 'hire_date')` 처럼 그대로
      // 읽을 수 있게 한다.
      const presentCols = TEMPLATE_ALL_COLS
        .map((col) => ({ col, idx: findIdx(col) }))
        .filter((c) => c.idx >= 0);
      const mappedHeaders = presentCols.map((c) => c.col);
      const mappedRows = dataRows.map((row) => presentCols.map((c) => row[c.idx] ?? ''));
      const mappedCsv = rowsToCsv(mappedHeaders, mappedRows);

      const blob = new Blob(['﻿' + mappedCsv], { type: 'text/csv' });
      const fd = new FormData();
      fd.append('file', blob, 'mapped.csv');
      fd.append('customerId', customerId);
      // 2026-06-21 새 정책: taxPeriod 필수 — 월별 급여 자료라는 의미.
      // monthPicker 에서 사용자가 확정한 period 가 있으면 사용, 없으면 현재 월.
      const periodToUse = confirmedPeriod || periodLabel(pickedYear, pickedMonth);
      fd.append('taxPeriod', periodToUse);

      const res = await fetch('/api/tax/employees/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        showMsg('success', `${data.data?.imported || 0}${tp('l18_2f5df1')}${data.data?.skipped ? `, ${data.data.skipped}${tp('l19_e2954a')}` : ''}`);
        onComplete();
      } else {
        showMsg('error', data.error || tp('l20_ceee68'));
      }
    } catch (err) {
      showMsg('error', `${tp('l21_175c5f')}: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
            <Sparkles className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-900">{tp('l22_643eb4')}</p>
            <p className="text-xs text-gray-600 mt-0.5">{tp('l23_5c33c2')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Method 1: Upload existing Excel/PDF — RECOMMENDED (with template download fallback) */}
        <Card className="border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:shadow-sm transition-all relative">
          <div className="absolute -top-2 left-5 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
            {tp('recommendedBadge')}
          </div>
          <CardContent className="p-5 flex flex-col h-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <FileText className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">{tp('uploadExistingTitle')}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{tp('l29_354dd1')}</p>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <Button size="sm" variant="outline" onClick={() => { void downloadTemplate(); }} className="w-full">
                <Download className="h-3 w-3 mr-1" />{tp('templateDownloadBtn')}
              </Button>
              <Button size="sm" onClick={openMonthPicker} disabled={uploading}
                className="w-full bg-emerald-600 hover:bg-emerald-700">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                {tp('l27_c3feb8')}
              </Button>
              {confirmedPeriod && (
                <p className="text-[10px] text-emerald-700 text-center">
                  {tp('monthPickerSelected', { period: confirmedPeriod })}
                </p>
              )}
              <input ref={excelInputRef} type="file" className="hidden" accept=".csv,.xlsx,.xls"
                onChange={e => handleTemplateUpload(e.target.files)} />
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-emerald-500" />
                {tp('ocrNote')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Method 3: Manual entry */}
        <Card className="border-2 border-dashed border-purple-200 hover:border-purple-400 hover:shadow-sm transition-all">
          <CardContent className="p-5 flex flex-col h-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">{tp('directInputTitle')}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{tp('l34_b7a3ab')}</p>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <Button size="sm" onClick={onOpenManualEntry} className="w-full bg-purple-600 hover:bg-purple-700">
                <Users className="h-3 w-3 mr-1" />{tp('goToEmployeeMaster')}
              </Button>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-500">
                {tp('manualEntryHint')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Month picker dialog — must select a tax month before uploading */}
      <Dialog open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tp('monthPickerTitle')}</DialogTitle>
            <DialogDescription>{tp('monthPickerDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label className="text-xs">{tp('monthPickerYear')}</Label>
              <Select value={String(pickedYear)} onValueChange={v => setPickedYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{tp('monthPickerMonth')}</Label>
              <Select value={String(pickedMonth)} onValueChange={v => setPickedMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxMonthForYear(pickedYear) }, (_, i) => i + 1).map(m => (
                    <SelectItem key={m} value={String(m)}>{tp(`month${m}` as 'month1')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMonthPickerOpen(false)}>
              {tp('cancel')}
            </Button>
            <Button onClick={confirmMonthPicker}>
              <CheckCircle className="h-4 w-4 mr-1" />
              {tp('monthPickerConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
