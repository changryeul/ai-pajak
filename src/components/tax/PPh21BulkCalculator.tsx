'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Plus,
  Trash2,
  Calculator,
  Loader2,
  Download,
  Upload,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface EmployeeRow {
  id: string;
  name: string;
  npwp: string;
  ptkpCategory: string;
  grossSalary: number;
  jht: number;
  jp: number;
}

interface CalcResult {
  employee_name: string;
  employee_npwp?: string;
  ptkp_category: string;
  calculation: {
    gross_income: number;
    total_deductions: number;
    net_income: number;
    ptkp: number;
    taxable_income: number;
    tax_amount: number;
  };
  monthly_tax: number;
  effective_rate: number;
  error?: string;
}

interface BulkSummary {
  totalEmployees: number;
  successCount: number;
  errorCount: number;
  totalGrossIncome: number;
  totalTaxAmount: number;
  totalMonthlyTax: number;
  averageEffectiveRate: number;
}

function fmt(n: number): string {
  return n.toLocaleString('id-ID');
}

const PTKP_OPTIONS = [
  'TK0', 'TK1', 'TK2', 'TK3',
  'K0', 'K1', 'K2', 'K3',
  'KI0', 'KI1', 'KI2', 'KI3',
];

function newEmployee(): EmployeeRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    npwp: '',
    ptkpCategory: 'TK0',
    grossSalary: 0,
    jht: 0,
    jp: 0,
  };
}

const CSV_TEMPLATE_HEADER = 'name,npwp,ptkp,gross_salary,jht,jp';
const CSV_TEMPLATE_SAMPLES = [
  'Ahmad Wijaya,01.234.567.8-901.000,K1,15000000,300000,100000',
  'Siti Nurhaliza,,TK0,8500000,170000,85000',
  'Budi Santoso,98.765.432.1-098.000,K2,25000000,500000,200000',
].join('\n');

function downloadPayrollTemplate() {
  const content = CSV_TEMPLATE_HEADER + '\n' + CSV_TEMPLATE_SAMPLES;
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pph21-payroll-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parsePayrollCSV(text: string): EmployeeRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows: EmployeeRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const get = (key: string) => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? values[idx] || '' : '';
    };

    const name = get('name') || get('nama') || get('employee_name') || get('nama_karyawan');
    if (!name) continue;

    const ptkpRaw = (get('ptkp') || get('ptkp_category') || get('status_ptkp') || 'TK0').toUpperCase();
    const ptkp = PTKP_OPTIONS.includes(ptkpRaw) ? ptkpRaw : 'TK0';

    rows.push({
      id: crypto.randomUUID(),
      name,
      npwp: get('npwp') || get('npwp_karyawan') || '',
      ptkpCategory: ptkp,
      grossSalary: Number(get('gross_salary') || get('gaji') || get('gaji_bruto') || 0),
      jht: Number(get('jht') || get('jht_employee') || 0),
      jp: Number(get('jp') || get('jp_employee') || 0),
    });
  }

  return rows;
}

export function PPh21BulkCalculator() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([newEmployee()]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CalcResult[] | null>(null);
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const addEmployee = () => setEmployees((prev) => [...prev, newEmployee()]);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResults(null);
    setSummary(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = parsePayrollCSV(text);
        if (parsed.length === 0) {
          setError('CSV 파일이 비어 있거나 형식이 잘못되었습니다. 템플릿을 다운로드해서 확인하세요.');
          return;
        }
        if (parsed.length > 500) {
          setError('최대 500명까지 지원합니다');
          return;
        }
        setEmployees(parsed);
      } catch {
        setError('CSV 파싱 실패');
      }
    };
    reader.readAsText(file, 'utf-8');
    // Reset file input so the same file can be re-uploaded
    e.target.value = '';
  };

  const removeEmployee = (id: string) => {
    if (employees.length <= 1) return;
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const updateEmployee = (id: string, field: keyof EmployeeRow, value: string | number) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const calculate = useCallback(async () => {
    const validEmployees = employees.filter((e) => e.name && e.grossSalary > 0);
    if (validEmployees.length === 0) {
      setError('Minimal satu karyawan dengan nama dan gaji harus diisi');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tax/pph21-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employees: validEmployees.map((e) => ({
            employee_name: e.name,
            employee_npwp: e.npwp,
            ptkp_category: e.ptkpCategory,
            gross_salary: e.grossSalary,
            jht_employee: e.jht,
            jp_employee: e.jp,
          })),
          period: 'annual',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Calculation failed');

      setResults(data.data.results);
      setSummary(data.data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setIsLoading(false);
    }
  }, [employees]);

  const exportCSV = () => {
    if (!results) return;
    const headers = 'Nama,NPWP,PTKP,Gaji Bruto,PPh 21 Tahunan,PPh 21 Bulanan,Tarif Efektif\n';
    const rows = results.map((r) =>
      `"${r.employee_name}","${r.employee_npwp || ''}","${r.ptkp_category}",${r.calculation.gross_income},${r.calculation.tax_amount},${r.monthly_tax},${r.effective_rate.toFixed(2)}%`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pph21-bulk-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            PPh 21 Bulk Calculator
          </CardTitle>
          <CardDescription>
            Hitung PPh 21 untuk banyak karyawan sekaligus (maks 500)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Employee Rows */}
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-3">Nama Karyawan</div>
              <div className="col-span-2">NPWP</div>
              <div className="col-span-1">PTKP</div>
              <div className="col-span-2">Gaji Bulanan</div>
              <div className="col-span-1">JHT</div>
              <div className="col-span-1">JP</div>
              <div className="col-span-2"></div>
            </div>

            {employees.map((emp) => (
              <div key={emp.id} className="grid grid-cols-12 gap-2 items-center">
                <Input
                  className="col-span-3 text-sm"
                  placeholder="Nama"
                  value={emp.name}
                  onChange={(e) => updateEmployee(emp.id, 'name', e.target.value)}
                />
                <Input
                  className="col-span-2 text-sm font-mono"
                  placeholder="XX.XXX.XXX.X-XXX.XXX"
                  value={emp.npwp}
                  onChange={(e) => updateEmployee(emp.id, 'npwp', e.target.value)}
                />
                <Select
                  value={emp.ptkpCategory}
                  onValueChange={(v) => updateEmployee(emp.id, 'ptkpCategory', v)}
                >
                  <SelectTrigger className="col-span-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PTKP_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="col-span-2 text-sm font-mono"
                  type="number"
                  placeholder="Rp"
                  value={emp.grossSalary || ''}
                  onChange={(e) => updateEmployee(emp.id, 'grossSalary', Number(e.target.value))}
                />
                <Input
                  className="col-span-1 text-sm font-mono"
                  type="number"
                  placeholder="JHT"
                  value={emp.jht || ''}
                  onChange={(e) => updateEmployee(emp.id, 'jht', Number(e.target.value))}
                />
                <Input
                  className="col-span-1 text-sm font-mono"
                  type="number"
                  placeholder="JP"
                  value={emp.jp || ''}
                  onChange={(e) => updateEmployee(emp.id, 'jp', Number(e.target.value))}
                />
                <div className="col-span-2 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => removeEmployee(emp.id)} disabled={employees.length <= 1}>
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* CSV Upload + Template Download */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-100">
            <p className="text-xs font-medium text-green-900 mb-2">📊 Excel/CSV로 한 번에 입력</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={downloadPayrollTemplate}>
                <Download className="h-3.5 w-3.5 mr-1" />
                CSV 템플릿 다운로드
              </Button>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    CSV 파일 업로드
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleCSVUpload}
                />
              </label>
              {employees.length > 1 && (
                <span className="text-xs text-green-700 self-center">
                  ✅ {employees.length}명 로드됨
                </span>
              )}
            </div>
            <p className="text-[10px] text-green-600 mt-1">
              헤더: name, npwp, ptkp, gross_salary, jht, jp — 또는 인도네시아어(nama, gaji_bruto) 도 인식
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={addEmployee}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Tambah Karyawan
            </Button>
            <span className="text-xs text-gray-400">{employees.length} karyawan</span>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button onClick={calculate} disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600">
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menghitung...</>
            ) : (
              <><Calculator className="h-4 w-4 mr-2" />Hitung PPh 21 ({employees.filter(e => e.name && e.grossSalary > 0).length} karyawan)</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results && summary && (
        <>
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Karyawan', value: summary.totalEmployees, sub: `${summary.errorCount} error` },
              { label: 'Total Gaji Bruto', value: `Rp ${fmt(summary.totalGrossIncome)}`, sub: 'per tahun' },
              { label: 'Total PPh 21', value: `Rp ${fmt(summary.totalTaxAmount)}`, sub: `Rp ${fmt(summary.totalMonthlyTax)}/bulan` },
              { label: 'Rata-rata Tarif', value: `${summary.averageEffectiveRate.toFixed(2)}%`, sub: 'efektif' },
            ].map((stat, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-gray-400">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Results Table */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Hasil Perhitungan</CardTitle>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left py-2 px-2">Nama</th>
                      <th className="text-left py-2 px-2">PTKP</th>
                      <th className="text-right py-2 px-2">Gaji Bruto</th>
                      <th className="text-right py-2 px-2">Neto</th>
                      <th className="text-right py-2 px-2">PPh 21/Thn</th>
                      <th className="text-right py-2 px-2">PPh 21/Bln</th>
                      <th className="text-right py-2 px-2">Tarif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map((r, i) => (
                      <tr key={i} className={r.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="py-2 px-2">
                          <span className="font-medium">{r.employee_name}</span>
                          {r.error && <p className="text-xs text-red-500">{r.error}</p>}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="text-xs">{r.ptkp_category}</Badge>
                        </td>
                        <td className="py-2 px-2 text-right font-mono">Rp {fmt(r.calculation.gross_income)}</td>
                        <td className="py-2 px-2 text-right font-mono">Rp {fmt(r.calculation.net_income)}</td>
                        <td className="py-2 px-2 text-right font-mono font-medium">Rp {fmt(r.calculation.tax_amount)}</td>
                        <td className="py-2 px-2 text-right font-mono text-blue-600">Rp {fmt(r.monthly_tax)}</td>
                        <td className="py-2 px-2 text-right">{r.effective_rate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 font-bold">
                    <tr>
                      <td className="py-2 px-2" colSpan={2}>Total</td>
                      <td className="py-2 px-2 text-right font-mono">Rp {fmt(summary.totalGrossIncome)}</td>
                      <td className="py-2 px-2"></td>
                      <td className="py-2 px-2 text-right font-mono">Rp {fmt(summary.totalTaxAmount)}</td>
                      <td className="py-2 px-2 text-right font-mono text-blue-600">Rp {fmt(summary.totalMonthlyTax)}</td>
                      <td className="py-2 px-2 text-right">{summary.averageEffectiveRate.toFixed(1)}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default PPh21BulkCalculator;
