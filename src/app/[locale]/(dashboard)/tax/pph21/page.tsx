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

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{message.text}
        </div>
      )}

      <Tabs defaultValue="upload" className="mb-4">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="upload"><Upload className="h-3 w-3 mr-1" />자료 입력</TabsTrigger>
          <TabsTrigger value="monthly"><FileText className="h-3 w-3 mr-1" />{tp('tabMonthlyPayslip')}</TabsTrigger>
          <TabsTrigger value="master"><Users className="h-3 w-3 mr-1" />{tp('tabEmployeeMaster')}</TabsTrigger>
          <TabsTrigger value="freelancer"><Briefcase className="h-3 w-3 mr-1" />비정규직/프리랜서</TabsTrigger>
          <TabsTrigger value="filing"><Shield className="h-3 w-3 mr-1" />신고 프로세스</TabsTrigger>
        </TabsList>

        {/* ── Tab: 자료 입력 (3가지 방식) ── */}
        <TabsContent value="upload">
          <PPh21DataInputSection customerId={customerId} onComplete={loadEmployees} showMsg={showMsg} />
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
  customerId, onComplete, showMsg,
}: {
  customerId: string;
  onComplete: () => void;
  showMsg: (type: 'success' | 'error', text: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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
      showMsg('success', `${count}건 업로드 완료. OCR 처리 중...`);
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

  const handleExcelUpload = async (files: FileList | null) => {
    if (!files || !customerId) return;
    setUploading(true);
    const file = files[0];
    const fd = new FormData();
    fd.append('file', file);
    fd.append('customerId', customerId);
    try {
      const res = await fetch('/api/tax/employees/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        showMsg('success', `${data.data?.imported || 0}명의 직원 데이터가 임포트되었습니다`);
        onComplete();
      } else {
        showMsg('error', data.error || '임포트 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <p className="text-sm font-bold text-blue-900 mb-2">급여 데이터 입력 방법을 선택하세요</p>
        <p className="text-xs text-blue-700">세 가지 방식 중 편한 방법으로 직원 급여 데이터를 입력합니다</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Method 1: Template download + upload */}
        <Card className="border-2 border-dashed hover:border-blue-400 transition-colors cursor-pointer">
          <CardContent className="p-5 text-center">
            <Download className="h-8 w-8 text-blue-600 mx-auto mb-3" />
            <p className="font-bold text-sm mb-1">1. 템플릿 다운로드</p>
            <p className="text-[11px] text-gray-500 mb-3">CSV 템플릿을 다운로드하여 직원 급여 데이터를 입력하고 업로드</p>
            <div className="space-y-2">
              <Button size="sm" variant="outline" onClick={downloadTemplate} className="w-full">
                <Download className="h-3 w-3 mr-1" />템플릿 다운로드 (.csv)
              </Button>
              <Button size="sm" onClick={() => excelInputRef.current?.click()} disabled={uploading} className="w-full">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                작성한 파일 업로드
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
            <p className="font-bold text-sm mb-1">2. 기존 급여 자료 업로드</p>
            <p className="text-[11px] text-gray-500 mb-3">회사에서 사용하는 급여 Excel, PDF, 이미지를 업로드하면 AI가 자동 파싱</p>
            <div className="space-y-2">
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full">
                <Upload className="h-3 w-3 mr-1" />파일 업로드 (Excel/PDF)
              </Button>
              <Button size="sm" variant="outline" disabled={uploading} className="w-full"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.capture = 'environment';
                  input.onchange = (e) => handleUpload((e.target as HTMLInputElement).files, 'CAMERA', 'SALARY_SLIP');
                  input.click();
                }}>
                <Camera className="h-3 w-3 mr-1" />급여명세 촬영
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.xlsx,.xls,.csv" multiple
                onChange={e => handleUpload(e.target.files, 'WEB', 'SALARY_SLIP')} />
            </div>
            <p className="text-[10px] text-gray-400 mt-2">JTC 급여명세서 양식도 OCR 인식 가능</p>
          </CardContent>
        </Card>

        {/* Method 3: Manual entry */}
        <Card className="border-2 border-dashed hover:border-purple-400 transition-colors cursor-pointer">
          <CardContent className="p-5 text-center">
            <Users className="h-8 w-8 text-purple-600 mx-auto mb-3" />
            <p className="font-bold text-sm mb-1">3. 직접 입력</p>
            <p className="text-[11px] text-gray-500 mb-3">직원 마스터 탭에서 한 사람씩 직접 등록</p>
            <p className="text-xs text-gray-600 mt-3 bg-gray-50 rounded p-2">
              "직원 마스터" 탭 → "직원 추가" → 이름/NPWP/급여 입력
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Uploaded documents */}
      {uploadedDocs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
              <Image className="h-4 w-4" />업로드된 증빙 ({uploadedDocs.length}건)
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {uploadedDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 p-2 rounded border text-xs">
                  <Badge className={
                    doc.ocr_status === 'COMPLETED' ? 'text-[8px] bg-green-100 text-green-700' :
                    doc.ocr_status === 'PROCESSING' ? 'text-[8px] bg-blue-100 text-blue-700' :
                    'text-[8px] bg-gray-100 text-gray-600'
                  }>
                    {doc.ocr_status === 'COMPLETED' ? 'OCR완료' : doc.ocr_status === 'PROCESSING' ? '처리중' : '대기'}
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
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
        <p className="text-sm font-bold text-amber-900 mb-2">비정규직 & 프리랜서 관리</p>
        <p className="text-xs text-amber-700">직원 유형에 따라 PPh 21 계산 방법이 다릅니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Worker type cards with explanation */}
        {[
          {
            type: 'CONTRACT', label: '계약직 (PKWT)', icon: '📋',
            desc: '정규직과 동일한 TER 방식 계산. 계약 기간 명시.',
            calc: 'TER × 총급여 (월 1~11월) / 12월 연말정산',
            color: 'border-blue-200 bg-blue-50',
          },
          {
            type: 'DAILY', label: '일용직 (Harian Lepas)', icon: '🔨',
            desc: '일급 Rp 450,000 초과분에 대해 과세.',
            calc: '(일급 - 450,000) × 5% (일용직 비과세 한도)',
            color: 'border-green-200 bg-green-50',
          },
          {
            type: 'FREELANCER', label: '프리랜서 (Bukan Pegawai)', icon: '💼',
            desc: '50% DPP 규정 적용. 연간 누적 소득/지출 추적 필수.',
            calc: 'DPP = 50% × 총수입. 누적 PKP에 대해 누진세율 적용.',
            color: 'border-purple-200 bg-purple-50',
            warning: '⚠️ 프리랜서 비용은 연간 누적 관리가 필요합니다',
          },
          {
            type: 'COMMISSIONER', label: '위원/감사위원 (Komisaris)', icon: '🏛️',
            desc: '누적 방식으로 과세. PTKP 차감 후 누진세율.',
            calc: '누적 총보수 - PTKP - 이전 과세표준 = 당월 PKP',
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
                <p className="font-medium">계산 방법:</p>
                <p>{wt.calc}</p>
              </div>
              {wt.warning && (
                <p className="text-[10px] text-red-600 mt-2">{wt.warning}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
        <p className="text-sm font-bold text-purple-900 flex items-center gap-2">
          <Briefcase className="h-4 w-4" />프리랜서 비용 누적 관리
        </p>
        <p className="text-xs text-purple-700 mt-1">
          직원 마스터 탭에서 worker_type을 FREELANCER로 등록하면, 매월 급여 명세 탭에서
          지급 시 누적 소득/지출이 자동 추적됩니다. 연말정산 시 누적 DPP(50% × 총수입)에
          대해 누진세율이 적용됩니다.
        </p>
        <p className="text-xs text-purple-700 mt-2">
          <b>등록 방법:</b> 직원 마스터 → 직원 추가 → PTKP: TK0 (프리랜서), 급여란에 월 계약금액 입력
        </p>
      </div>
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
        showMsg('success', 'SPT Masa PPh 21 생성 완료');
      } else {
        showMsg('error', data.error || data.message || 'SPT 생성 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
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
        showMsg('success', data.message || 'e-Bupot 생성 완료');
      } else {
        showMsg('error', data.error || 'e-Bupot 생성 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setGeneratingBP(false);
    }
  };

  const steps = [
    { id: 1, label: '자료 입력', done: true, desc: '직원 급여 데이터' },
    { id: 2, label: '급여 생성', done: true, desc: '월별 급여 명세' },
    { id: 3, label: 'PPh 21 계산', done: true, desc: 'TER 자동 계산' },
    { id: 4, label: 'e-Bupot', done: bpResult.length > 0, desc: bpResult.length > 0 ? `${bpResult.length}건` : '미생성' },
    { id: 5, label: 'SPT Masa', done: !!sptResult, desc: sptResult ? `마감 ${sptResult.submissionDeadline?.substring(0, 10)}` : '미생성' },
    { id: 6, label: '납부', done: false, desc: '납부 페이지' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <Shield className="h-4 w-4 text-blue-600" />
        {currentPeriod} PPh 21 신고 진행 상황
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
              <p className="font-medium text-sm text-purple-900">e-Bupot 1721-A1 생성</p>
              <p className="text-xs text-purple-700">직원별 Bukti Potong PPh 21을 일괄 생성합니다</p>
            </div>
            <Button onClick={handleGenerateBP} disabled={generatingBP} variant="outline">
              {generatingBP ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
              e-Bupot 생성
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="font-medium text-sm text-green-900">e-Bupot 1721-A1 — {bpResult.length}건 생성 완료</p>
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
              <p className="font-medium text-sm text-blue-900">SPT Masa PPh 21 생성</p>
              <p className="text-xs text-blue-700">월별 급여 명세 데이터를 기반으로 SPT Masa를 생성합니다</p>
            </div>
            <Button onClick={handleCreateSPT} disabled={creatingSPT}>
              {creatingSPT ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
              SPT Masa 생성
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="font-medium text-sm text-green-900">SPT Masa PPh 21 생성 완료</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-gray-500">직원 수</p><p className="font-bold">{sptResult.itemCount}명</p></div>
                <div><p className="text-gray-500">총 급여</p><p className="font-mono font-bold">{fmtRp(sptResult.totalGrossIncome)}</p></div>
                <div><p className="text-gray-500">PPh 21 세액</p><p className="font-mono font-bold text-blue-700">{fmtRp(sptResult.totalTaxWithheld)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-indigo-200 bg-indigo-50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-indigo-900">납부 진행</p>
                <p className="text-xs text-indigo-700">ID Billing 생성 후 은행에서 납부 → NTPN 입력</p>
              </div>
              <a href={`/${locale}/tax/monthly-payments`}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                납부 페이지로
              </a>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
