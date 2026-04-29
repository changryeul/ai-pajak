'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
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
import {
  Users, Plus, Loader2, CheckCircle, AlertTriangle, Save, X,
  Edit2, Trash2, Calculator, Sparkles, FileText,
  Upload, Camera, Download, Shield, ChevronDown, ChevronRight,
  Image, Send,
} from 'lucide-react';
import { MonthlyPayslipTab } from '@/components/pph21/MonthlyPayslipTab';
import { ScreenHeader } from '@/components/tax';
import { fmtRp } from '@/lib/utils';
import { PageTitle } from '@/components/layout/PageTitle';

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
  // Salary
  grossSalary: '', jhtEmployee: '', jpEmployee: '', otherDeductions: '',
  // HR record
  employeeNumber: '', position: '', department: '', workerType: 'REGULAR',
  hireDate: '', resignDate: '', birthDate: '', gender: '', maritalStatus: '',
  email: '', phone: '', address: '',
  bankName: '', bankAccountNo: '', bankAccountName: '',
  emergencyContactName: '', emergencyContactPhone: '', notes: '',
};

export default function PPh21PayrollPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const tp = useTranslations('pph21Page');
  const tsc = useTranslations('taxScreen');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState('monthly');

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

  const customerId = session?.customerId || '';

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

  useEffect(() => {
    if (sessionLoading) return;
    loadEmployees();
  }, [sessionLoading, loadEmployees]);

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
      employeeNumber: emp.employee_number || '',
      position: emp.position || '',
      department: emp.department || '',
      workerType: emp.worker_type || 'REGULAR',
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
          employeeNumber: form.employeeNumber,
          position: form.position,
          department: form.department,
          workerType: form.workerType,
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

  // Map activeTab to step number (1-4) for header progress display
  const tabToStep: Record<string, number> = {
    monthly: 2, master: 1,
  };
  const currentStep = tabToStep[activeTab] || 1;

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

  const handleSubmit = () => {
    // Scroll to filing process section to start submission flow
    const el = document.getElementById('pph21-filing-process');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <PageTitle title="PPh 21" />
      <ScreenHeader
        title={tp('pageTitle')}
        step={currentStep}
        aiSteps={[tsc('stepAiProcess'), tsc('stepTaxCalc'), tsc('stepIdBillingGen')]}
      />

      {/* Filing process: stepper + e-Bupot/SPT/payment actions (moved from old "filing" tab) */}
      <div id="pph21-filing-process" className="mb-6">
        <PPh21FilingProcess customerId={customerId} locale={locale} showMsg={showMsg} />
      </div>

      {/* Worker-type summary + submit */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
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
      <div className="flex justify-end mb-5">
        <Button onClick={handleSubmit} className="bg-slate-900 hover:bg-slate-800 text-white">
          <Send className="h-4 w-4 mr-1.5" />{tp('submitBtn')}
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{message.text}
        </div>
      )}

      {/* Data input cards (moved from old "upload" tab — always visible above tabs) */}
      <div className="mb-6">
        <PPh21DataInputSection
          customerId={customerId}
          onComplete={loadEmployees}
          showMsg={showMsg}
          onNavigateToMaster={() => setActiveTab('monthly')}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="monthly"><FileText className="h-3 w-3 mr-1" />{tp('tabMonthlyPayslip')}</TabsTrigger>
          <TabsTrigger value="master"><Users className="h-3 w-3 mr-1" />{tp('tabEmployeeMaster')}</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <MonthlyPayslipTab customerId={customerId} />
        </TabsContent>

        <TabsContent value="master">
      {/* Actions */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold">{tp('employeeList')}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={calculateAll} disabled={isSaving || employees.length === 0}>
            <Calculator className="h-3 w-3 mr-1" />{tp('calculatePph21')}
          </Button>
          <Button size="sm" onClick={() => { setForm(emptyForm); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" />{tp('newEmployee')}
          </Button>
        </div>
      </div>

      {/* Employee HR Record Form */}
      {showForm && (
        <Card className="mb-4 border-blue-200 shadow-md">
          <CardContent className="pt-4 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* 1. Basic identity */}
            <section>
              <p className="text-xs font-semibold text-slate-500 mb-2">{tp('hrSectionBasic')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">{tp('employeeName')} *</Label>
                  <Input className="h-9" value={form.employeeName} onChange={e => setForm({ ...form, employeeName: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('hrEmployeeNumber')}</Label>
                  <Input className="h-9 font-mono" value={form.employeeNumber} onChange={e => setForm({ ...form, employeeNumber: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('hrBirthDate')}</Label>
                  <Input type="date" className="h-9" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">NIK</Label>
                  <Input className="h-9 font-mono" value={form.employeeNik} onChange={e => setForm({ ...form, employeeNik: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">NPWP</Label>
                  <Input className="h-9 font-mono" value={form.employeeNpwp} onChange={e => setForm({ ...form, employeeNpwp: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('hrGender')}</Label>
                  <Select value={form.gender || '__'} onValueChange={v => setForm({ ...form, gender: v === '__' ? '' : v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__">-</SelectItem>
                      <SelectItem value="MALE">{tp('hrGenderMale')}</SelectItem>
                      <SelectItem value="FEMALE">{tp('hrGenderFemale')}</SelectItem>
                      <SelectItem value="OTHER">{tp('hrGenderOther')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{tp('hrMaritalStatus')}</Label>
                  <Select value={form.maritalStatus || '__'} onValueChange={v => setForm({ ...form, maritalStatus: v === '__' ? '' : v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__">-</SelectItem>
                      <SelectItem value="SINGLE">{tp('hrMaritalSingle')}</SelectItem>
                      <SelectItem value="MARRIED">{tp('hrMaritalMarried')}</SelectItem>
                      <SelectItem value="DIVORCED">{tp('hrMaritalDivorced')}</SelectItem>
                      <SelectItem value="WIDOWED">{tp('hrMaritalWidowed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* 2. Contact */}
            <section>
              <p className="text-xs font-semibold text-slate-500 mb-2">{tp('hrSectionContact')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">{tp('hrEmail')}</Label>
                  <Input type="email" className="h-9" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('hrPhone')}</Label>
                  <Input className="h-9 font-mono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-xs">{tp('hrAddress')}</Label>
                  <Input className="h-9" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>
            </section>

            {/* 3. Job */}
            <section>
              <p className="text-xs font-semibold text-slate-500 mb-2">{tp('hrSectionJob')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">{tp('hrPosition')}</Label>
                  <Input className="h-9" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('hrDepartment')}</Label>
                  <Input className="h-9" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('hrWorkerType')}</Label>
                  <Select value={form.workerType} onValueChange={v => setForm({ ...form, workerType: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REGULAR">{tp('workerRegular')}</SelectItem>
                      <SelectItem value="CONTRACT">{tp('workerContract')}</SelectItem>
                      <SelectItem value="DAILY">{tp('workerDaily')}</SelectItem>
                      <SelectItem value="FREELANCER">{tp('workerFreelancer')}</SelectItem>
                      <SelectItem value="COMMISSIONER">{tp('hrWorkerCommissioner')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{tp('hrHireDate')}</Label>
                  <Input type="date" className="h-9" value={form.hireDate} onChange={e => setForm({ ...form, hireDate: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('hrResignDate')}</Label>
                  <Input type="date" className="h-9" value={form.resignDate} onChange={e => setForm({ ...form, resignDate: e.target.value })} />
                </div>
              </div>
            </section>

            {/* 4. Salary baseline */}
            <section>
              <p className="text-xs font-semibold text-slate-500 mb-2">{tp('hrSectionSalary')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">PTKP *</Label>
                  <Select value={form.ptkpCategory} onValueChange={v => setForm({ ...form, ptkpCategory: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{PTKP_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{tp('monthlySalary')} *</Label>
                  <Input className="h-9 font-mono" type="number" value={form.grossSalary} onChange={e => setForm({ ...form, grossSalary: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('jhtEmployee')}</Label>
                  <Input className="h-9 font-mono" type="number" value={form.jhtEmployee} onChange={e => setForm({ ...form, jhtEmployee: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('jpEmployee')}</Label>
                  <Input className="h-9 font-mono" type="number" value={form.jpEmployee} onChange={e => setForm({ ...form, jpEmployee: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('otherDeductions')}</Label>
                  <Input className="h-9 font-mono" type="number" value={form.otherDeductions} onChange={e => setForm({ ...form, otherDeductions: e.target.value })} />
                </div>
              </div>
            </section>

            {/* 5. Bank */}
            <section>
              <p className="text-xs font-semibold text-slate-500 mb-2">{tp('hrSectionBank')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">{tp('hrBankName')}</Label>
                  <Input className="h-9" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('hrBankAccountNo')}</Label>
                  <Input className="h-9 font-mono" value={form.bankAccountNo} onChange={e => setForm({ ...form, bankAccountNo: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('hrBankAccountName')}</Label>
                  <Input className="h-9" value={form.bankAccountName} onChange={e => setForm({ ...form, bankAccountName: e.target.value })} />
                </div>
              </div>
            </section>

            {/* 6. Emergency contact */}
            <section>
              <p className="text-xs font-semibold text-slate-500 mb-2">{tp('hrSectionEmergency')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{tp('hrEmergencyName')}</Label>
                  <Input className="h-9" value={form.emergencyContactName} onChange={e => setForm({ ...form, emergencyContactName: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{tp('hrEmergencyPhone')}</Label>
                  <Input className="h-9 font-mono" value={form.emergencyContactPhone} onChange={e => setForm({ ...form, emergencyContactPhone: e.target.value })} />
                </div>
              </div>
            </section>

            {/* 7. Notes */}
            <section>
              <p className="text-xs font-semibold text-slate-500 mb-2">{tp('hrSectionMemo')}</p>
              <textarea
                className="w-full min-h-[64px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </section>

            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}><X className="h-3 w-3 mr-1" />{tp('cancel')}</Button>
              <Button size="sm" onClick={saveEmployee} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {form.id ? tp('update') : tp('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee List */}
      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{tp('noEmployees')}</p>
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs">
                    <th className="text-left py-2.5 px-3">{tp('hrEmployeeNumber')}</th>
                    <th className="text-left py-2.5 px-3">{tp('name')}</th>
                    <th className="text-left py-2.5 px-3">{tp('hrPosition')} / {tp('hrDepartment')}</th>
                    <th className="text-left py-2.5 px-3">NPWP</th>
                    <th className="text-center py-2.5 px-3">PTKP</th>
                    <th className="text-center py-2.5 px-3">{tp('hrWorkerType')}</th>
                    <th className="text-center py-2.5 px-3">{tp('hrHireDate')}</th>
                    <th className="text-right py-2.5 px-3">{tp('salary')}</th>
                    <th className="text-right py-2.5 px-3">PPh 21</th>
                    <th className="text-center py-2.5 px-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map(emp => {
                    const calc = calcResults[emp.id];
                    const workerLabel: Record<string, string> = {
                      REGULAR: tp('workerRegular'),
                      CONTRACT: tp('workerContract'),
                      DAILY: tp('workerDaily'),
                      FREELANCER: tp('workerFreelancer'),
                      COMMISSIONER: tp('hrWorkerCommissioner'),
                    };
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-xs font-mono text-gray-500">{emp.employee_number || '—'}</td>
                        <td className="py-2 px-3 text-xs font-medium">{emp.employee_name}</td>
                        <td className="py-2 px-3 text-xs text-gray-700">
                          {emp.position || '—'}
                          {emp.department && <span className="text-gray-400"> / {emp.department}</span>}
                        </td>
                        <td className="py-2 px-3 text-xs font-mono text-gray-500">{emp.employee_npwp || '—'}</td>
                        <td className="py-2 px-3 text-center"><Badge variant="outline" className="text-[10px]">{emp.ptkp_category}</Badge></td>
                        <td className="py-2 px-3 text-center text-[10px] text-gray-600">
                          {workerLabel[emp.worker_type || 'REGULAR']}
                        </td>
                        <td className="py-2 px-3 text-center text-[10px] text-gray-500 font-mono">{emp.hire_date || '—'}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{fmt(emp.gross_salary)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {calc ? (
                            <span className="text-blue-600 font-medium">{fmt(calc.taxAmount)}</span>
                          ) : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => startEdit(emp)} className="text-gray-300 hover:text-blue-500"><Edit2 className="h-3 w-3" /></button>
                            <button onClick={() => deleteEmployee(emp.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Sub-component: 3가지 자료 입력 방식
// ══════════════════════════════════════════════════════
function PPh21DataInputSection({
  customerId, onComplete, showMsg, onNavigateToMaster,
}: {
  customerId: string;
  onComplete: () => void;
  showMsg: (type: 'success' | 'error', text: string) => void;
  onNavigateToMaster: () => void;
}) {
  const tp = useTranslations('pph21Page');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);

  // Month picker state — opens before upload to capture which tax month the data belongs to
  const now = new Date();
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'excel' | 'file' | 'camera' | null>(null);
  const [pickedYear, setPickedYear] = useState<number>(now.getFullYear());
  const [pickedMonth, setPickedMonth] = useState<number>(now.getMonth() + 1);
  const [confirmedPeriod, setConfirmedPeriod] = useState<string | null>(null);

  const yearOptions = useMemo(() => {
    const cy = new Date().getFullYear();
    return [cy - 1, cy, cy + 1];
  }, []);

  const periodLabel = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

  const openMonthPicker = (action: 'excel' | 'file' | 'camera') => {
    setPendingAction(action);
    setMonthPickerOpen(true);
  };

  const confirmMonthPicker = () => {
    const period = periodLabel(pickedYear, pickedMonth);
    setConfirmedPeriod(period);
    setMonthPickerOpen(false);
    // Trigger the actual file input AFTER state settles
    setTimeout(() => {
      if (pendingAction === 'excel') {
        excelInputRef.current?.click();
      } else if (pendingAction === 'file') {
        fileInputRef.current?.click();
      } else if (pendingAction === 'camera') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e) => handleUpload((e.target as HTMLInputElement).files, 'CAMERA', 'SALARY_SLIP', period);
        input.click();
      }
    }, 50);
  };
  const [uploadedDocs, setUploadedDocs] = useState<Array<{
    id: string; file_name: string; ocr_status: string;
    ocr_result?: { extractedData?: Record<string, unknown>; confidence?: number };
  }>>([]);

  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/documents?customerId=${customerId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUploadedDocs((d.data || []).slice(0, 20)); })
      .catch(() => {});
  }, [customerId]);

  // Detect camera availability: show on mobile OR when videoinput device is connected
  useEffect(() => {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      setCameraAvailable(true);
      return;
    }
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          setCameraAvailable(devices.some(d => d.kind === 'videoinput'));
        })
        .catch(() => setCameraAvailable(false));
    }
  }, []);

  const handleUpload = async (files: FileList | null, source: string, docType: string, period?: string) => {
    if (!files || !customerId) return;
    setUploading(true);
    let count = 0;
    const taxPeriod = period || confirmedPeriod;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('customerId', customerId);
      fd.append('documentType', docType);
      fd.append('uploadSource', source);
      if (taxPeriod) fd.append('taxPeriod', taxPeriod);
      try {
        const res = await fetch('/api/documents/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
          count++;
          if (data.data?.id) fetch(`/api/documents/${data.data.id}/ocr`, { method: 'POST' }).catch(() => {});
        }
      } catch { /* */ }
    }
    if (count > 0) {
      showMsg('success', `${count}${tp('l3_4c0fb1')}`);
      setTimeout(() => {
        fetch(`/api/documents?customerId=${customerId}`)
          .then(r => r.json())
          .then(d => { if (d.success) setUploadedDocs((d.data || []).slice(0, 20)); })
          .catch(() => {});
      }, 2000);
    }
    setUploading(false);
  };

  const downloadTemplate = () => {
    const headers = ['employee_name', 'employee_npwp', 'employee_nik', 'ptkp_category', 'gross_salary', 'position_allowance', 'overtime_pay', 'meal_allowance', 'transport_allowance', 'other_allowances', 'bonus', 'thr', 'jht_employee', 'jp_employee', 'bpjs_kesehatan', 'other_deductions', 'worker_type'];
    const sample = ['John Doe', '01.234.567.8-901.000', '3201234567890001', 'TK0', '15000000', '500000', '0', '300000', '200000', '0', '0', '0', '300000', '150000', '120000', '0', 'REGULAR'];
    const csv = [headers.join(','), sample.join(','), ''].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pph21_employee_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Column mapping state
  const [mappingStep, setMappingStep] = useState<'idle' | 'mapping' | 'importing'>('idle');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Array<{ sourceColumn: string; targetField: string; confidence: string }>>([]);
  const [mappedFile, setMappedFile] = useState<File | null>(null);

  const TARGET_FIELDS_LIST = [
    { field: '', label: `— ${tp('l4_98adeb')} —` },
    { field: 'employee_name', label: `${tp('l5_59ec33')} *` },
    { field: 'employee_npwp', label: 'NPWP' },
    { field: 'employee_nik', label: 'NIK' },
    { field: 'ptkp_category', label: 'PTKP' },
    { field: 'gross_salary', label: `${tp('l6_34d71f')} *` },
    { field: 'position_allowance', label: tp('l7_8188f9') },
    { field: 'overtime_pay', label: tp('l8_34c079') },
    { field: 'meal_allowance', label: tp('l9_dfe00f') },
    { field: 'transport_allowance', label: tp('l10_d0b2e2') },
    { field: 'other_allowances', label: tp('l11_cafd07') },
    { field: 'bonus', label: tp('l12_e7fffe') },
    { field: 'thr', label: 'THR' },
    { field: 'jht_employee', label: 'JHT' },
    { field: 'jp_employee', label: 'JP' },
    { field: 'bpjs_kesehatan', label: 'BPJS' },
    { field: 'other_deductions', label: tp('l13_2289a4') },
    { field: 'worker_type', label: tp('l14_67e774') },
  ];

  const handleExcelUpload = async (files: FileList | null) => {
    if (!files || !customerId) return;
    const file = files[0];
    setMappedFile(file);

    // Read CSV/Excel and extract headers for mapping
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { showMsg('error', tp('l15_5d59d2')); return; }

    const headerRaw = lines[0].replace(/\uFEFF/, '');
    const headers = headerRaw.split(',').map(h => h.trim().replace(/['"]/g, ''));
    const preview = lines.slice(1, 4).map(l => l.split(',').map(c => c.trim().replace(/['"]/g, '')));

    setCsvHeaders(headers);
    setCsvPreview(preview);

    // Check mapping memory first
    try {
      const memRes = await fetch(`/api/tax/employees/mapping?customerId=${customerId}&headers=${encodeURIComponent(JSON.stringify(headers))}`);
      const memData = await memRes.json();
      if (memData.success && memData.remembered && memData.data?.mappings) {
        const saved = memData.data.mappings as Array<{ sourceColumn: string; targetField: string }>;
        const autoMappings = headers.map(h => {
          const s = saved.find(m => m.sourceColumn === h);
          return { sourceColumn: h, targetField: s?.targetField || '', confidence: s ? 'HIGH' : 'NONE' };
        });
        setColumnMappings(autoMappings);
        setMappingStep('mapping');
        showMsg('success', `${tp('l16_3884de')} (${memData.data.used_count}${tp('l17_66d39a')}`);
        return;
      }
    } catch { /* fallback to keyword mapping */ }

    // No memory — auto-map using keyword matching
    const KEYWORD_MAP: Record<string, string[]> = {
      employee_name: ['nama', 'name', 'karyawan', 'pegawai', '이름', 'employee'],
      employee_npwp: ['npwp', 'tax_id'],
      employee_nik: ['nik', 'ktp'],
      ptkp_category: ['ptkp', 'status'],
      gross_salary: ['gaji', 'salary', 'basic', 'pokok', 'base', '기본급', 'gross', 'gapok'],
      position_allowance: ['jabatan', 'position', '직책'],
      overtime_pay: ['lembur', 'overtime', '초과'],
      meal_allowance: ['makan', 'meal', '식대'],
      transport_allowance: ['transport', '교통'],
      other_allowances: ['tunjangan lain', 'allowance', '수당'],
      bonus: ['bonus', '보너스'],
      thr: ['thr', 'hari raya'],
      jht_employee: ['jht', 'hari tua'],
      jp_employee: ['jp', 'pensiun'],
      bpjs_kesehatan: ['bpjs', 'kesehatan'],
      other_deductions: ['potongan', 'deduction', '공제'],
      worker_type: ['type', 'tipe', 'jenis', '유형'],
    };

    const usedTargets = new Set<string>();
    const mappings = headers.map(h => {
      const lower = h.toLowerCase();
      for (const [field, keywords] of Object.entries(KEYWORD_MAP)) {
        if (usedTargets.has(field)) continue;
        if (keywords.some(kw => lower.includes(kw) || kw.includes(lower))) {
          usedTargets.add(field);
          return { sourceColumn: h, targetField: field, confidence: lower === keywords[0] ? 'HIGH' : 'MEDIUM' };
        }
      }
      return { sourceColumn: h, targetField: '', confidence: 'NONE' };
    });

    setColumnMappings(mappings);
    setMappingStep('mapping');
  };

  const handleConfirmMapping = async () => {
    if (!mappedFile || !customerId) return;
    setMappingStep('importing');
    setUploading(true);

    // Rebuild CSV with mapped headers
    const text = await mappedFile.text();
    const lines = text.split('\n').filter(l => l.trim());
    const dataRows = lines.slice(1);

    const mappedHeaders = columnMappings.map(m => m.targetField || 'SKIP');
    const mappedCsv = [mappedHeaders.join(','), ...dataRows].join('\n');

    const blob = new Blob(['\uFEFF' + mappedCsv], { type: 'text/csv' });
    const fd = new FormData();
    fd.append('file', blob, 'mapped.csv');
    fd.append('customerId', customerId);
    if (confirmedPeriod) fd.append('taxPeriod', confirmedPeriod);

    try {
      const res = await fetch('/api/tax/employees/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        showMsg('success', `${data.data?.imported || 0}${tp('l18_2f5df1')}${data.data?.skipped ? `, ${data.data.skipped}${tp('l19_e2954a')}` : ''}`);
        onComplete();
        setMappingStep('idle');

        // Save mapping to memory for future auto-use
        try {
          await fetch('/api/tax/employees/mapping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId,
              headers: csvHeaders,
              mappings: columnMappings.filter(m => m.targetField),
            }),
          });
        } catch { /* non-blocking */ }
      } else {
        showMsg('error', data.error || tp('l20_ceee68'));
        setMappingStep('mapping');
      }
    } catch {
      showMsg('error', tp('l21_175c5f'));
      setMappingStep('mapping');
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Method 1: Template download + upload */}
        <Card className="border-2 border-dashed border-blue-200 hover:border-blue-400 hover:shadow-sm transition-all">
          <CardContent className="p-5 flex flex-col h-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Download className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">{tp('templateDownloadTitle')}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{tp('templateDownloadDesc')}</p>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <Button size="sm" variant="outline" onClick={downloadTemplate} className="w-full">
                <Download className="h-3 w-3 mr-1" />{tp('templateDownloadBtn')}
              </Button>
              <Button size="sm" onClick={() => openMonthPicker('excel')} disabled={uploading}
                className="w-full bg-blue-600 hover:bg-blue-700">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                {tp('l27_c3feb8')}
              </Button>
              {confirmedPeriod && pendingAction === 'excel' && (
                <p className="text-[10px] text-blue-700 text-center">
                  {tp('monthPickerSelected', { period: confirmedPeriod })}
                </p>
              )}
              <input ref={excelInputRef} type="file" className="hidden" accept=".csv,.xlsx,.xls"
                onChange={e => handleExcelUpload(e.target.files)} />
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-500 font-medium">
                worker_type: <span className="font-mono text-gray-600">REGULAR / CONTRACT / DAILY / FREELANCER</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Method 2: Upload existing Excel/PDF — RECOMMENDED */}
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
              <Button size="sm" onClick={() => openMonthPicker('file')} disabled={uploading}
                className="w-full bg-emerald-600 hover:bg-emerald-700">
                <Upload className="h-3 w-3 mr-1" />{tp('fileUploadBtn')}
              </Button>
              {cameraAvailable && (
                <Button size="sm" variant="outline" disabled={uploading} className="w-full"
                  onClick={() => openMonthPicker('camera')}>
                  <Camera className="h-3 w-3 mr-1" />{tp('cameraCapture')}
                </Button>
              )}
              {confirmedPeriod && (pendingAction === 'file' || pendingAction === 'camera') && (
                <p className="text-[10px] text-emerald-700 text-center">
                  {tp('monthPickerSelected', { period: confirmedPeriod })}
                </p>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.xlsx,.xls,.csv" multiple
                onChange={e => handleUpload(e.target.files, 'WEB', 'SALARY_SLIP')} />
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
              <Button size="sm" onClick={onNavigateToMaster} className="w-full bg-purple-600 hover:bg-purple-700">
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

      {/* Column mapping confirmation */}
      {mappingStep === 'mapping' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                {tp('l38_f14ec9')} — AI{tp('l39_b33aa4')}
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setMappingStep('idle')}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-[11px] text-blue-700">
              {tp('l40_2e3d2f')}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-white">
                    <th className="p-2 text-left border">{tp('excelColumn')}</th>
                    <th className="p-2 text-left border">{tp('mappingTarget')}</th>
                    <th className="p-2 text-center border">{tp('l43_fc4409')}</th>
                    <th className="p-2 text-left border">{tp('l44_b12106')}</th>
                  </tr>
                </thead>
                <tbody>
                  {csvHeaders.map((header, i) => {
                    const mapping = columnMappings[i];
                    return (
                      <tr key={i} className="border-b">
                        <td className="p-2 border font-mono text-[11px]">{header}</td>
                        <td className="p-1 border">
                          <select
                            value={mapping?.targetField || ''}
                            onChange={e => {
                              const next = [...columnMappings];
                              next[i] = { ...next[i], targetField: e.target.value, confidence: e.target.value ? 'HIGH' : 'NONE' };
                              setColumnMappings(next);
                            }}
                            className={`w-full h-7 px-1 text-[11px] border rounded ${
                              mapping?.confidence === 'HIGH' ? 'bg-green-50 border-green-300' :
                              mapping?.confidence === 'MEDIUM' ? 'bg-amber-50 border-amber-300' :
                              mapping?.targetField ? 'bg-blue-50' : 'bg-gray-50'
                            }`}>
                            {TARGET_FIELDS_LIST.map(tf => (
                              <option key={tf.field} value={tf.field}>{tf.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 border text-center">
                          <Badge className={
                            mapping?.confidence === 'HIGH' ? 'text-[8px] bg-green-100 text-green-700' :
                            mapping?.confidence === 'MEDIUM' ? 'text-[8px] bg-amber-100 text-amber-700' :
                            'text-[8px] bg-gray-100 text-gray-500'
                          }>{mapping?.confidence || 'NONE'}</Badge>
                        </td>
                        <td className="p-2 border text-[10px] text-gray-500 font-mono">
                          {csvPreview.slice(0, 2).map((row, ri) => row[i] || '').join(' | ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-500">
                {tp('l45_b43f85')} + {tp('l46_e3b66d')}
              </p>
              <Button size="sm" onClick={handleConfirmMapping}
                disabled={uploading || !columnMappings.some(m => m.targetField === 'employee_name') || !columnMappings.some(m => m.targetField === 'gross_salary')}>
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                {tp('l47_b8a4a8')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Uploaded documents */}
      {uploadedDocs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
              <Image className="h-4 w-4" />{tp('uploadedDocs', { count: uploadedDocs.length })}
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {uploadedDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 p-2 rounded border text-xs">
                  <Badge className={
                    doc.ocr_status === 'COMPLETED' ? 'text-[8px] bg-green-100 text-green-700' :
                    doc.ocr_status === 'PROCESSING' ? 'text-[8px] bg-blue-100 text-blue-700' :
                    'text-[8px] bg-gray-100 text-gray-600'
                  }>
                    {doc.ocr_status === 'COMPLETED' ? tp('ocrComplete') : doc.ocr_status === 'PROCESSING' ? tp('l51_95d1e4') : tp('l52_65905a')}
                  </Badge>
                  <span className="truncate">{doc.file_name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
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


// ══════════════════════════════════════════════════════
// Sub-component: PPh 21 신고 프로세스
// ══════════════════════════════════════════════════════
function PPh21FilingProcess({
  customerId, locale, showMsg,
}: {
  customerId: string;
  locale: string;
  showMsg: (type: 'success' | 'error', text: string) => void;
}) {
  const tp = useTranslations('pph21Page');
  const [creatingSPT, setCreatingSPT] = useState(false);
  const [generatingBP, setGeneratingBP] = useState(false);
  const [bpResult, setBpResult] = useState<Array<{ employeeName: string; bpNumber: string; pph21: number }>>([]);
  const [sptResult, setSptResult] = useState<{
    totalGrossIncome: number; totalTaxWithheld: number; itemCount: number;
    submissionDeadline: string; isOverdue: boolean;
  } | null>(null);

  const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Check existing SPT Masa PPh21
  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/tax/filings?customerId=${customerId}&taxType=PPh21&period=${currentPeriod}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const filings = d?.data || [];
        const existing = filings.find((f: { tax_type: string; tax_period: string }) =>
          f.tax_type === 'PPh21' && f.tax_period === currentPeriod);
        if (existing?.tax_data?.spt_masa_result) {
          const r = existing.tax_data.spt_masa_result;
          setSptResult({
            totalGrossIncome: r.total_gross_income || 0,
            totalTaxWithheld: r.total_tax_withheld || 0,
            itemCount: r.item_count || 0,
            submissionDeadline: r.submission_deadline || '',
            isOverdue: false,
          });
        }
      })
      .catch(() => {});
  }, [customerId, currentPeriod]);

  const handleCreateSPT = async () => {
    setCreatingSPT(true);
    try {
      const res = await fetch('/api/tax/spt-masa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, taxType: 'PPh21', period: currentPeriod }),
      });
      const data = await res.json();
      if (data.success || data.sptMasa) {
        const spt = data.sptMasa;
        if (spt) {
          setSptResult({
            totalGrossIncome: spt.totalGrossIncome || 0,
            totalTaxWithheld: spt.totalTaxWithheld || 0,
            itemCount: spt.itemCount || 0,
            submissionDeadline: spt.submissionDeadline || '',
            isOverdue: spt.isOverdue || false,
          });
        }
        showMsg('success', `SPT Masa PPh 21 ${tp('l84_f3bc85')}`);
      } else {
        showMsg('error', data.error || data.message || `SPT ${tp('l85_cbbcb4')}`);
      }
    } catch {
      showMsg('error', tp('l21_175c5f'));
    } finally {
      setCreatingSPT(false);
    }
  };

  const handleGenerateBP = async () => {
    setGeneratingBP(true);
    try {
      const res = await fetch('/api/tax/ebupot-pph21', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, period: currentPeriod }),
      });
      const data = await res.json();
      if (data.success) {
        setBpResult(data.data?.buktiPotongs || []);
        showMsg('success', data.message || `e-Bupot ${tp('l84_f3bc85')}`);
      } else {
        showMsg('error', data.error || `e-Bupot ${tp('l85_cbbcb4')}`);
      }
    } catch {
      showMsg('error', tp('l21_175c5f'));
    } finally {
      setGeneratingBP(false);
    }
  };

  const steps = [
    { id: 1, label: tp('l0_bcefd6'), done: true, desc: tp('l86_c7547e') },
    { id: 2, label: tp('l87_40851c'), done: true, desc: tp('l88_9dcc47') },
    { id: 3, label: `PPh 21 ${tp('l89_4e9509')}`, done: true, desc: `TER ${tp('l90_773723')}` },
    { id: 4, label: 'e-Bupot', done: bpResult.length > 0, desc: bpResult.length > 0 ? tp('countSuffix', { count: bpResult.length }) : tp('l91_ac6176') },
    { id: 5, label: 'SPT Masa', done: !!sptResult, desc: sptResult ? `${tp('l92_df2337')} ${sptResult.submissionDeadline?.substring(0, 10)}` : tp('l91_ac6176') },
    { id: 6, label: tp('l93_b303e6'), done: false, desc: tp('l94_a3adc9') },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <Shield className="h-4 w-4 text-blue-600" />
        {currentPeriod} PPh 21 {tp('l95_aa38cd')}
      </h3>

      {/* Progress steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step.done ? <CheckCircle className="h-4 w-4" /> : step.id}
              </div>
              <p className="text-[10px] mt-1 text-center font-medium">{step.label}</p>
              <p className="text-[9px] text-gray-400 text-center">{step.desc}</p>
            </div>
            {i < steps.length - 1 && <div className={`h-0.5 w-full ${step.done ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* e-Bupot 1721-A1 */}
      {bpResult.length === 0 ? (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-purple-900">{tp('eBupotGenTitle')}</p>
              <p className="text-xs text-purple-700">{tp('l97_00866c')}</p>
            </div>
            <Button onClick={handleGenerateBP} disabled={generatingBP} variant="outline">
              {generatingBP ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
              e-Bupot {tp('l96_4169bb')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="font-medium text-sm text-green-900">{tp('eBupotGenDone', { count: bpResult.length })}</p>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {bpResult.map((bp, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-1.5 bg-white rounded">
                  <span>{bp.employeeName}</span>
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono text-[9px] bg-purple-100 text-purple-700">{bp.bpNumber}</Badge>
                    <span className="font-mono text-blue-700">{fmtRp(bp.pph21)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SPT Masa action */}
      {!sptResult ? (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-blue-900">{tp('sptMasaGenTitle')}</p>
              <p className="text-xs text-blue-700">{tp('l99_b88336')}</p>
            </div>
            <Button onClick={handleCreateSPT} disabled={creatingSPT}>
              {creatingSPT ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
              SPT Masa {tp('l96_4169bb')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="font-medium text-sm text-green-900">{tp('sptMasaGenDone')}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-gray-500">{tp('l100_00c733')}</p><p className="font-bold">{sptResult.itemCount}</p></div>
                <div><p className="text-gray-500">{tp('l101_6a76ba')}</p><p className="font-mono font-bold">{fmtRp(sptResult.totalGrossIncome)}</p></div>
                <div><p className="text-gray-500">{tp('pph21TaxAmount')}</p><p className="font-mono font-bold text-blue-700">{fmtRp(sptResult.totalTaxWithheld)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-indigo-200 bg-indigo-50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-indigo-900">{tp('l103_25e8b8')}</p>
                <p className="text-xs text-indigo-700">{tp('billingNote')}</p>
              </div>
              <a href={`/${locale}/tax/monthly-payments`}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                {tp('l105_d76082')}
              </a>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
