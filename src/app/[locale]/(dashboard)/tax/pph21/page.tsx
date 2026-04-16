'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useSession } from '@/hooks/useSession';
import {
  Users, Plus, Loader2, CheckCircle, AlertTriangle, Save, X,
  Edit2, Trash2, Calculator, Sparkles, DollarSign, FileText,
  Upload, Camera, Download, Shield, ChevronDown, ChevronRight,
  Briefcase, Image,
} from 'lucide-react';
import { MonthlyPayslipTab } from '@/components/pph21/MonthlyPayslipTab';
import { fmtRp } from '@/lib/utils';

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
}

const PTKP_OPTIONS = ['TK0','TK1','TK2','TK3','K0','K1','K2','K3','KI0','KI1','KI2','KI3'];

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }

const emptyForm = {
  id: '', employeeName: '', employeeNpwp: '', employeeNik: '', ptkpCategory: 'TK0',
  grossSalary: '', jhtEmployee: '', jpEmployee: '', otherDeductions: '',
};

export default function PPh21PayrollPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const tp = useTranslations('pph21Page');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState({ totalEmployees: 0, totalGrossSalary: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState('upload');

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
        setSummary(data.data.summary || { totalEmployees: 0, totalGrossSalary: 0 });
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

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-blue-200 text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" />PPh 21</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{tp('pageTitle')}</h1>
          <p className="text-blue-200 mt-2 text-sm">{tp('pageDescription')}</p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-blue-200 text-xs flex items-center gap-1"><Users className="h-3 w-3" />{tp('employeeCount')}</p>
              <p className="font-bold text-lg">{tp('employeeCountValue', { count: summary.totalEmployees })}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-blue-200 text-xs flex items-center gap-1"><DollarSign className="h-3 w-3" />{tp('totalSalary')}</p>
              <p className="font-bold text-lg">{fmt(summary.totalGrossSalary)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step Progress Indicator */}
      <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-1">
        {[
          { step: 1, label: tp('step1_upload'), tab: 'upload' },
          { step: 2, label: tp('step2_ai'), tab: 'monthly' },
          { step: 3, label: tp('step3_calculate'), tab: 'master' },
          { step: 4, label: tp('step4_billing'), tab: 'filing' },
        ].map((s, i, arr) => {
          const tabOrder = ['upload', 'monthly', 'master', 'freelancer', 'filing'];
          const currentIdx = tabOrder.indexOf(activeTab);
          const stepIdx = tabOrder.indexOf(s.tab);
          const isActive = activeTab === s.tab || (s.step === 3 && activeTab === 'freelancer');
          const isDone = stepIdx < currentIdx;
          return (
            <div key={s.step} className="flex items-center">
              <button
                onClick={() => setActiveTab(s.tab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm border-blue-600'
                    : isDone
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="font-bold">{s.step}.</span> {s.label}
                {isDone && <CheckCircle className="h-3 w-3 ml-1" />}
              </button>
              {i < arr.length - 1 && (
                <div className={`mx-1.5 w-6 h-0.5 flex-shrink-0 ${isDone ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="upload"><Upload className="h-3 w-3 mr-1" />{tp('l0_bcefd6')}</TabsTrigger>
          <TabsTrigger value="monthly"><FileText className="h-3 w-3 mr-1" />{tp('tabMonthlyPayslip')}</TabsTrigger>
          <TabsTrigger value="master"><Users className="h-3 w-3 mr-1" />{tp('tabEmployeeMaster')}</TabsTrigger>
          <TabsTrigger value="freelancer"><Briefcase className="h-3 w-3 mr-1" />{tp('l1_c148d4')}</TabsTrigger>
          <TabsTrigger value="filing"><Shield className="h-3 w-3 mr-1" />{tp('l2_38b7db')}</TabsTrigger>
        </TabsList>

        {/* ── Tab: 자료 입력 (3가지 방식) ── */}
        <TabsContent value="upload">
          <PPh21DataInputSection
            customerId={customerId}
            onComplete={loadEmployees}
            showMsg={showMsg}
            onNavigateToMaster={() => setActiveTab('master')}
          />
        </TabsContent>

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

      {/* Employee Form */}
      {showForm && (
        <Card className="mb-4 border-blue-200 shadow-md">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{tp('employeeName')}</Label>
                <Input className="h-9" value={form.employeeName} onChange={e => setForm({ ...form, employeeName: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">NPWP</Label>
                <Input className="h-9 font-mono" value={form.employeeNpwp} onChange={e => setForm({ ...form, employeeNpwp: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">PTKP</Label>
                <Select value={form.ptkpCategory} onValueChange={v => setForm({ ...form, ptkpCategory: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{PTKP_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">{tp('monthlySalary')}</Label>
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
            <div className="flex gap-2 justify-end">
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
                    <th className="text-left py-2.5 px-3">{tp('name')}</th>
                    <th className="text-left py-2.5 px-3">NPWP</th>
                    <th className="text-center py-2.5 px-3">PTKP</th>
                    <th className="text-right py-2.5 px-3">{tp('salary')}</th>
                    <th className="text-right py-2.5 px-3">PPh 21</th>
                    <th className="text-center py-2.5 px-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map(emp => {
                    const calc = calcResults[emp.id];
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-xs font-medium">{emp.employee_name}</td>
                        <td className="py-2 px-3 text-xs font-mono text-gray-500">{emp.employee_npwp || '—'}</td>
                        <td className="py-2 px-3 text-center"><Badge variant="outline" className="text-[10px]">{emp.ptkp_category}</Badge></td>
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

        {/* ── Tab: 비정규직/프리랜서 ── */}
        <TabsContent value="freelancer">
          <FreelancerSection customerId={customerId} showMsg={showMsg} />
        </TabsContent>

        {/* ── Tab: 신고 프로세스 ── */}
        <TabsContent value="filing">
          <PPh21FilingProcess customerId={customerId} locale={locale} showMsg={showMsg} />
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

  const handleUpload = async (files: FileList | null, source: string, docType: string) => {
    if (!files || !customerId) return;
    setUploading(true);
    let count = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('customerId', customerId);
      fd.append('documentType', docType);
      fd.append('uploadSource', source);
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
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <p className="text-sm font-bold text-blue-900 mb-2">{tp('l22_643eb4')}</p>
        <p className="text-xs text-blue-700">{tp('l23_5c33c2')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Method 1: Template download + upload */}
        <Card className="border-2 border-dashed hover:border-blue-400 transition-colors cursor-pointer">
          <CardContent className="p-5 text-center">
            <Download className="h-8 w-8 text-blue-600 mx-auto mb-3" />
            <p className="font-bold text-sm mb-1">{tp('templateDownloadTitle')}</p>
            <p className="text-[11px] text-gray-500 mb-3">{tp('templateDownloadDesc')}</p>
            <div className="space-y-2">
              <Button size="sm" variant="outline" onClick={downloadTemplate} className="w-full">
                <Download className="h-3 w-3 mr-1" />{tp('templateDownloadBtn')}
              </Button>
              <Button size="sm" onClick={() => excelInputRef.current?.click()} disabled={uploading} className="w-full">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                {tp('l27_c3feb8')}
              </Button>
              <input ref={excelInputRef} type="file" className="hidden" accept=".csv,.xlsx,.xls"
                onChange={e => handleExcelUpload(e.target.files)} />
            </div>
            <p className="text-[10px] text-gray-400 mt-2">worker_type: REGULAR / CONTRACT / DAILY / FREELANCER</p>
          </CardContent>
        </Card>

        {/* Method 2: Upload existing Excel/PDF */}
        <Card className="border-2 border-dashed hover:border-emerald-400 transition-colors cursor-pointer">
          <CardContent className="p-5 text-center">
            <FileText className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
            <p className="font-bold text-sm mb-1">{tp('uploadExistingTitle')}</p>
            <p className="text-[11px] text-gray-500 mb-3">{tp('l29_354dd1')}</p>
            <div className="space-y-2">
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full">
                <Upload className="h-3 w-3 mr-1" />{tp('fileUploadBtn')}
              </Button>
              {cameraAvailable && (
                <Button size="sm" variant="outline" disabled={uploading} className="w-full"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.capture = 'environment';
                    input.onchange = (e) => handleUpload((e.target as HTMLInputElement).files, 'CAMERA', 'SALARY_SLIP');
                    input.click();
                  }}>
                  <Camera className="h-3 w-3 mr-1" />{tp('cameraCapture')}
                </Button>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.xlsx,.xls,.csv" multiple
                onChange={e => handleUpload(e.target.files, 'WEB', 'SALARY_SLIP')} />
            </div>
            <p className="text-[10px] text-gray-400 mt-2">{tp('ocrNote')}</p>
          </CardContent>
        </Card>

        {/* Method 3: Manual entry */}
        <Card className="border-2 border-dashed hover:border-purple-400 transition-colors">
          <CardContent className="p-5 text-center">
            <Users className="h-8 w-8 text-purple-600 mx-auto mb-3" />
            <p className="font-bold text-sm mb-1">{tp('directInputTitle')}</p>
            <p className="text-[11px] text-gray-500 mb-3">{tp('l34_b7a3ab')}</p>
            <div className="space-y-2">
              <Button size="sm" onClick={onNavigateToMaster} className="w-full bg-purple-600 hover:bg-purple-700">
                <Users className="h-3 w-3 mr-1" />{tp('goToEmployeeMaster')}
              </Button>
              <p className="text-[10px] text-gray-500 bg-gray-50 rounded p-2 text-left leading-relaxed">
                "{tp('l36_5558f6')}" {tp('l37_9e4142')}
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
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Sub-component: 비정규직/프리랜서 관리
// ══════════════════════════════════════════════════════
function FreelancerSection({
  customerId, showMsg,
}: {
  customerId: string;
  showMsg: (type: 'success' | 'error', text: string) => void;
}) {
  const tp = useTranslations('pph21Page');
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
        <p className="text-sm font-bold text-amber-900 mb-2">{tp('freelancerTitle')}</p>
        <p className="text-xs text-amber-700">{tp('l55_e44dbc')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Worker type cards with explanation */}
        {[
          {
            type: 'CONTRACT', label: tp('l56_1ed7ef'), icon: '📋',
            desc: tp('l57_8ffa3f'),
            calc: `TER × ${tp('l58_277101')}`,
            color: 'border-blue-200 bg-blue-50',
          },
          {
            type: 'DAILY', label: tp('l59_ab78f2'), icon: '🔨',
            desc: tp('l60_bd695b'),
            calc: `(${tp('l61_e0b3b7')} × 5% (${tp('l62_841e25')}`,
            color: 'border-green-200 bg-green-50',
          },
          {
            type: 'FREELANCER', label: tp('l63_fff243'), icon: '💼',
            desc: `50% DPP ${tp('l64_7fede2')}`,
            calc: `DPP = 50% × ${tp('l65_a52335')}`,
            color: 'border-purple-200 bg-purple-50',
            warning: `⚠️ ${tp('l66_da242e')}`,
          },
          {
            type: 'COMMISSIONER', label: tp('l67_3e8f6a'), icon: '🏛️',
            desc: tp('l68_6b99e2'),
            calc: `${tp('l69_6e150b')} = ${tp('l70_ecd09e')}`,
            color: 'border-amber-200 bg-amber-50',
          },
        ].map(wt => (
          <Card key={wt.type} className={`${wt.color}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{wt.icon}</span>
                <div>
                  <p className="font-bold text-sm">{wt.label}</p>
                  <Badge variant="outline" className="text-[9px]">{wt.type}</Badge>
                </div>
              </div>
              <p className="text-xs text-gray-700 mb-2">{wt.desc}</p>
              <div className="bg-white rounded p-2 text-[11px] text-gray-600">
                <p className="font-medium">{tp('calcMethod')}</p>
                <p>{wt.calc}</p>
              </div>
              {wt.warning && (
                <p className="text-[10px] text-red-600 mt-2">{wt.warning}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Freelancer cumulative tracker */}
      <FreelancerCumulativeTracker customerId={customerId} showMsg={showMsg} />
    </div>
  );
}

// ── Freelancer Cumulative Tracker ──
function FreelancerCumulativeTracker({
  customerId, showMsg,
}: {
  customerId: string;
  showMsg: (type: 'success' | 'error', text: string) => void;
}) {
  const tp = useTranslations('pph21Page');
  const currentYear = new Date().getFullYear();
  const [freelancers, setFreelancers] = useState<Array<{
    id: string; employee_name: string; gross_salary: number;
  }>>([]);
  const [cumulatives, setCumulatives] = useState<Array<{
    employee_id: string;
    monthly_entries: Array<{ month: string; gross: number; expenses: number; net: number }>;
    cumulative_gross: number;
    cumulative_net: number;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Load freelancers + cumulative data
  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/tax/employees?customerId=${customerId}`).then(r => r.json()),
      fetch(`/api/tax/freelancer-cumulative?customerId=${customerId}&year=${currentYear}`).then(r => r.json()),
    ]).then(([empData, cumData]) => {
      const allEmps = empData.data?.employees || [];
      setFreelancers(allEmps.filter((e: { worker_type?: string; is_active: boolean }) =>
        e.worker_type === 'FREELANCER' && e.is_active
      ));
      if (cumData.success) setCumulatives(cumData.data || []);
    }).finally(() => setLoading(false));
  }, [customerId, currentYear]);

  const handleSaveMonth = async (employeeId: string, month: number, gross: number, expenses: number) => {
    setSavingId(employeeId);
    try {
      const res = await fetch('/api/tax/freelancer-cumulative', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, employeeId, taxYear: currentYear, month, gross, expenses }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', `${month}${tp('l72_43f9aa')}`);
        // Refresh
        const cumRes = await fetch(`/api/tax/freelancer-cumulative?customerId=${customerId}&year=${currentYear}`);
        const cumData = await cumRes.json();
        if (cumData.success) setCumulatives(cumData.data || []);
      }
    } catch { showMsg('error', tp('l73_5f3ec4')); }
    finally { setSavingId(null); }
  };

  if (freelancers.length === 0) {
    return (
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4">
          <p className="text-sm font-bold text-purple-900 flex items-center gap-2">
            <Briefcase className="h-4 w-4" />{tp('freelancerCumulative')}
          </p>
          <p className="text-xs text-purple-700 mt-2">
            {tp('noFreelancers', { tab: tp('l76_db07a6') })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-200">
      <CardContent className="p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-purple-600" />
          {tp('l74_3e7eca')} ({tp('freelancerList', { year: currentYear, count: freelancers.length })})
        </h3>

        <div className="bg-purple-50 rounded-lg p-2 text-[10px] text-purple-800 mb-3">
          {tp('freelancerDppNote')}
        </div>

        {loading ? (
          <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
        ) : (
          <div className="space-y-4">
            {freelancers.map(fl => {
              const cum = cumulatives.find(c => c.employee_id === fl.id);
              const entries = cum?.monthly_entries || [];
              const MONTHS_SHORT = [tp('month1'),tp('month2'),tp('month3'),tp('month4'),tp('month5'),tp('month6'),tp('month7'),tp('month8'),tp('month9'),tp('month10'),tp('month11'),tp('month12')];

              return (
                <div key={fl.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{fl.employee_name}</p>
                      <p className="text-[10px] text-gray-500">{tp('baseContract', { amount: fmtRp(fl.gross_salary) })}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-gray-500">{tp('l82_90271c')}</p>
                      <p className="font-mono font-bold">{fmtRp(cum?.cumulative_gross || 0)}</p>
                      <p className="text-purple-600 text-[10px]">DPP 50%: {fmtRp(cum?.cumulative_net || 0)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 md:grid-cols-6 gap-1">
                    {MONTHS_SHORT.map((label, i) => {
                      const entry = entries.find((e: { month: string }) => e.month === String(i + 1).padStart(2, '0'));
                      const [localGross, setLocalGross] = useState(String(entry?.gross || ''));

                      return (
                        <div key={i} className="text-center">
                          <p className="text-[9px] text-gray-500">{label}</p>
                          <Input
                            type="number"
                            className="h-7 text-[10px] font-mono text-center px-1"
                            value={localGross}
                            onChange={e => setLocalGross(e.target.value)}
                            onBlur={() => {
                              const val = Number(localGross) || 0;
                              if (val !== (entry?.gross || 0)) {
                                handleSaveMonth(fl.id, i + 1, val, 0);
                              }
                            }}
                            placeholder={tp('l83_d25373')}
                          />
                          {entry && entry.gross > 0 && (
                            <p className="text-[8px] text-purple-600">{fmtRp(entry.net)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
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
