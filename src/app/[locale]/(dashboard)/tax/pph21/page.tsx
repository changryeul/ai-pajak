'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import {
  Users, Plus, Loader2, CheckCircle, AlertTriangle, Save, X,
  Edit2, Trash2, Calculator, Sparkles, DollarSign,
} from 'lucide-react';

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
  const { session } = useSession();
  const params = useParams();
  const locale = params.locale as string;

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
    if (!customerId) return;
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

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

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
      showMsg('error', 'Nama dan gaji wajib diisi');
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
        showMsg('success', form.id ? 'Data karyawan diperbarui' : 'Karyawan ditambahkan');
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
    if (!confirm('Nonaktifkan karyawan ini?')) return;
    try {
      const res = await fetch(`/api/tax/employees?id=${id}`, { method: 'DELETE' });
      if ((await res.json()).success) { showMsg('success', 'Karyawan dinonaktifkan'); loadEmployees(); }
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
        showMsg('success', `${employees.length}명 PPh 21 계산 완료`);
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
          <h1 className="text-2xl md:text-3xl font-bold mt-1">급여 대장 관리</h1>
          <p className="text-blue-200 mt-2 text-sm">직원 등록 + 월별 PPh 21 TER 계산</p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-blue-200 text-xs flex items-center gap-1"><Users className="h-3 w-3" />직원 수</p>
              <p className="font-bold text-lg">{summary.totalEmployees}명</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-blue-200 text-xs flex items-center gap-1"><DollarSign className="h-3 w-3" />총 급여</p>
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

      {/* Actions */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold">Daftar Karyawan</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={calculateAll} disabled={isSaving || employees.length === 0}>
            <Calculator className="h-3 w-3 mr-1" />PPh 21 계산
          </Button>
          <Button size="sm" onClick={() => { setForm(emptyForm); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" />Karyawan Baru
          </Button>
        </div>
      </div>

      {/* Employee Form */}
      {showForm && (
        <Card className="mb-4 border-blue-200 shadow-md">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Nama Karyawan *</Label>
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
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Gaji Bulanan *</Label>
                <Input className="h-9 font-mono" type="number" value={form.grossSalary} onChange={e => setForm({ ...form, grossSalary: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">JHT Karyawan</Label>
                <Input className="h-9 font-mono" type="number" value={form.jhtEmployee} onChange={e => setForm({ ...form, jhtEmployee: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">JP Karyawan</Label>
                <Input className="h-9 font-mono" type="number" value={form.jpEmployee} onChange={e => setForm({ ...form, jpEmployee: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Potongan Lain</Label>
                <Input className="h-9 font-mono" type="number" value={form.otherDeductions} onChange={e => setForm({ ...form, otherDeductions: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}><X className="h-3 w-3 mr-1" />Batal</Button>
              <Button size="sm" onClick={saveEmployee} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {form.id ? 'Update' : 'Simpan'}
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
          <p className="text-sm">Belum ada karyawan terdaftar</p>
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs">
                    <th className="text-left py-2.5 px-3">Nama</th>
                    <th className="text-left py-2.5 px-3">NPWP</th>
                    <th className="text-center py-2.5 px-3">PTKP</th>
                    <th className="text-right py-2.5 px-3">Gaji</th>
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
    </div>
  );
}
