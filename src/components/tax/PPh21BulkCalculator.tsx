'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { parseJTCSalaryTemplate, ptkpSlashToCode, type JTCSalaryRow } from '@/lib/tax/bulk-import/pph21-salary-template-parser';

// ---------------------------------------------------------------------------
// types

interface EmployeeRow {
  id: string;
  no?: number;
  employmentStatus: 1 | 2 | 3;
  name: string;
  gender: 'M' | 'F' | '';
  npwp: string;
  ptkpCategory: string; // 'TK/0' canonical slash form (UI), normalized at submit
  joinDate: string;
  // income (monthly)
  gaji: number;
  tunjangan: number;
  bonusThr: number;
  natura: number;
  pinjamanGaji: number;
  potonganGaji: number;
  // PENAMBAH (company-paid)
  penambahBpjsKesehatan: number;
  penambahJkk: number;
  penambahJkm: number;
  penambahJht: number;
  penambahJp: number;
  penambahJkp: number;
  // PENGURANG (employee-paid)
  pengurangBpjsKesehatan: number;
  pengurangJht: number;
  pengurangJp: number;
  pengurangJkp: number;
}

interface CalcResult {
  employee_name: string;
  employee_npwp?: string;
  ptkp_category: string;
  employment_status?: 1 | 2 | 3;
  calculation: {
    gross_income: number;
    total_deductions: number;
    net_income: number;
    ptkp: number;
    taxable_income: number;
    tax_amount: number;
    deduction_breakdown?: {
      position_allowance: number;
      employee_contributions: number;
      other_deductions: number;
    };
  };
  deduction_breakdown?: {
    position_allowance: number;
    employee_contributions: number;
    other_deductions: number;
  };
  monthly_tax: number;
  effective_rate: number;
  warning?: string;
  error?: string;
}

interface BulkSummary {
  totalEmployees: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  totalGrossIncome: number;
  totalTaxAmount: number;
  totalMonthlyTax: number;
  averageEffectiveRate: number;
}

// ---------------------------------------------------------------------------
// helpers

function fmt(n: number): string {
  return Math.round(n).toLocaleString('id-ID');
}

const PTKP_OPTIONS = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'];

const TEMPLATE_URL = '/templates/pph21-salary-template-jtc.xlsx';

function newEmployee(): EmployeeRow {
  return {
    id: crypto.randomUUID(),
    employmentStatus: 1,
    name: '',
    gender: '',
    npwp: '',
    ptkpCategory: 'TK/0',
    joinDate: '',
    gaji: 0,
    tunjangan: 0,
    bonusThr: 0,
    natura: 0,
    pinjamanGaji: 0,
    potonganGaji: 0,
    penambahBpjsKesehatan: 0,
    penambahJkk: 0,
    penambahJkm: 0,
    penambahJht: 0,
    penambahJp: 0,
    penambahJkp: 0,
    pengurangBpjsKesehatan: 0,
    pengurangJht: 0,
    pengurangJp: 0,
    pengurangJkp: 0,
  };
}

function jtcRowToEmployee(r: JTCSalaryRow): EmployeeRow {
  return {
    id: crypto.randomUUID(),
    no: r.no,
    employmentStatus: r.employmentStatus,
    name: r.name,
    gender: r.gender ?? '',
    npwp: r.npwp,
    ptkpCategory: r.ptkpCategory,
    joinDate: r.joinDate ?? '',
    gaji: r.gaji,
    tunjangan: r.tunjangan,
    bonusThr: r.bonusThr,
    natura: r.natura,
    pinjamanGaji: r.pinjamanGaji,
    potonganGaji: r.potonganGaji,
    penambahBpjsKesehatan: r.penambah.bpjsKesehatan,
    penambahJkk: r.penambah.jkk,
    penambahJkm: r.penambah.jkm,
    penambahJht: r.penambah.jht,
    penambahJp: r.penambah.jp,
    penambahJkp: r.penambah.jkp,
    pengurangBpjsKesehatan: r.pengurang.bpjsKesehatan,
    pengurangJht: r.pengurang.jht,
    pengurangJp: r.pengurang.jp,
    pengurangJkp: r.pengurang.jkp,
  };
}

// ---------------------------------------------------------------------------
// component

export function PPh21BulkCalculator() {
  const t = useTranslations('pph21Bulk');
  const [employees, setEmployees] = useState<EmployeeRow[]>([newEmployee()]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [results, setResults] = useState<CalcResult[] | null>(null);
  const [summary, setSummary] = useState<BulkSummary | null>(null);

  const addEmployee = () => setEmployees((prev) => [...prev, newEmployee()]);

  const removeEmployee = (id: string) => {
    if (employees.length <= 1) return;
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const updateEmployee = useCallback(
    (id: string, field: keyof EmployeeRow, value: string | number) => {
      setEmployees((prev) =>
        prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
      );
    },
    [],
  );

  const handleXlsxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImportNotice(null);
    setResults(null);
    setSummary(null);

    try {
      const buf = await file.arrayBuffer();
      const summary = await parseJTCSalaryTemplate(buf);
      if (summary.rows.length === 0) {
        setError(t('errorXlsxParse'));
        return;
      }
      if (summary.rows.length > 500) {
        setError(t('errorMax'));
        return;
      }
      setEmployees(summary.rows.map(jtcRowToEmployee));
      const notices: string[] = [];
      if (summary.skippedNonTetap > 0) {
        notices.push(t('skippedNonTetap', { count: summary.skippedNonTetap }));
      }
      if (summary.skippedInvalid > 0) {
        notices.push(t('skippedInvalid', { count: summary.skippedInvalid }));
      }
      setImportNotice(notices.length > 0 ? notices.join(' · ') : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorXlsxParse'));
    } finally {
      // Reset so same file re-upload triggers onChange.
      e.target.value = '';
    }
  };

  const calculate = useCallback(async () => {
    const validEmployees = employees.filter((e) => e.name && e.gaji > 0);
    if (validEmployees.length === 0) {
      setError(t('errorEmpty'));
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
            employee_npwp: e.npwp || undefined,
            employment_status: e.employmentStatus,
            ptkp_category: ptkpSlashToCode(e.ptkpCategory),
            gender: e.gender || undefined,
            join_date: e.joinDate || undefined,
            gaji: e.gaji,
            tunjangan: e.tunjangan,
            bonus_thr: e.bonusThr,
            natura: e.natura,
            pinjaman_gaji: e.pinjamanGaji,
            potongan_gaji: e.potonganGaji,
            penambah: {
              bpjs_kesehatan: e.penambahBpjsKesehatan,
              jkk: e.penambahJkk,
              jkm: e.penambahJkm,
              jht: e.penambahJht,
              jp: e.penambahJp,
              jkp: e.penambahJkp,
            },
            pengurang: {
              bpjs_kesehatan: e.pengurangBpjsKesehatan,
              jht: e.pengurangJht,
              jp: e.pengurangJp,
              jkp: e.pengurangJkp,
            },
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
  }, [employees, t]);

  const validCount = useMemo(
    () => employees.filter((e) => e.name && e.gaji > 0).length,
    [employees],
  );

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* xlsx upload + template download */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-3 border border-emerald-100">
            <p className="text-xs font-medium text-emerald-900 mb-2 flex items-center gap-1">
              <FileSpreadsheet className="h-4 w-4" /> {t('xlsxHint')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={TEMPLATE_URL} download>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  {t('downloadTemplateXlsx')}
                </a>
              </Button>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {t('uploadXlsx')}
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleXlsxUpload}
                />
              </label>
              {employees.length > 1 && (
                <span className="text-xs text-emerald-700 self-center">
                  ✓ {t('loaded', { count: employees.length })}
                </span>
              )}
            </div>
            {importNotice && (
              <p className="text-[11px] text-amber-700 mt-2 flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                {importNotice}
              </p>
            )}
          </div>

          {/* 24-column horizontal-scrollable grid */}
          <div className="overflow-x-auto border rounded-lg bg-white">
            <table className="text-xs min-w-[2400px]">
              {/* section divider header row */}
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-2 py-1.5 text-left font-semibold text-slate-600" colSpan={7}>
                    {t('sectionBasic')}
                  </th>
                  <th className="px-2 py-1.5 text-left font-semibold text-blue-700 border-l" colSpan={6}>
                    {t('sectionIncome')}
                  </th>
                  <th className="px-2 py-1.5 text-left font-semibold text-orange-700 border-l" colSpan={6}>
                    {t('sectionPenambah')}
                  </th>
                  <th className="px-2 py-1.5 text-left font-semibold text-purple-700 border-l" colSpan={4}>
                    {t('sectionPengurang')}
                  </th>
                  <th className="px-2 py-1.5 border-l" />
                </tr>
                <tr className="bg-slate-100 border-b text-slate-600 font-medium">
                  {/* basic */}
                  <th className="px-2 py-1.5 text-left w-[40px]">{t('colNo')}</th>
                  <th className="px-2 py-1.5 text-left w-[150px]">{t('colStatus')}</th>
                  <th className="px-2 py-1.5 text-left w-[160px]">{t('colName')}</th>
                  <th className="px-2 py-1.5 text-left w-[60px]">{t('colGender')}</th>
                  <th className="px-2 py-1.5 text-left w-[80px]">{t('colPtkp')}</th>
                  <th className="px-2 py-1.5 text-left w-[180px]">{t('colNpwp')}</th>
                  <th className="px-2 py-1.5 text-left w-[120px]">{t('colJoinDate')}</th>
                  {/* income */}
                  <th className="px-2 py-1.5 text-right w-[120px] border-l">{t('colGaji')}</th>
                  <th className="px-2 py-1.5 text-right w-[110px]">{t('colTunjangan')}</th>
                  <th className="px-2 py-1.5 text-right w-[110px]">{t('colBonusThr')}</th>
                  <th className="px-2 py-1.5 text-right w-[100px]">{t('colNatura')}</th>
                  <th className="px-2 py-1.5 text-right w-[100px]">{t('colPinjaman')}</th>
                  <th className="px-2 py-1.5 text-right w-[110px]">{t('colPotongan')}</th>
                  {/* penambah */}
                  <th className="px-2 py-1.5 text-right w-[110px] border-l">{t('colBpjsKesCompany')}</th>
                  <th className="px-2 py-1.5 text-right w-[80px]">{t('colJkk')}</th>
                  <th className="px-2 py-1.5 text-right w-[80px]">{t('colJkm')}</th>
                  <th className="px-2 py-1.5 text-right w-[100px]">{t('colJhtCompany')}</th>
                  <th className="px-2 py-1.5 text-right w-[100px]">{t('colJpCompany')}</th>
                  <th className="px-2 py-1.5 text-right w-[100px]">{t('colJkpCompany')}</th>
                  {/* pengurang */}
                  <th className="px-2 py-1.5 text-right w-[110px] border-l">{t('colBpjsKesEmployee')}</th>
                  <th className="px-2 py-1.5 text-right w-[100px]">{t('colJhtEmployee')}</th>
                  <th className="px-2 py-1.5 text-right w-[100px]">{t('colJpEmployee')}</th>
                  <th className="px-2 py-1.5 text-right w-[100px]">{t('colJkpEmployee')}</th>
                  <th className="px-2 py-1.5 w-[40px] border-l" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees.map((emp, idx) => (
                  <EmployeeInputRow
                    key={emp.id}
                    emp={emp}
                    rowNo={idx + 1}
                    onChange={updateEmployee}
                    onRemove={removeEmployee}
                    canRemove={employees.length > 1}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={addEmployee}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('addEmployee')}
            </Button>
            <span className="text-xs text-gray-400">
              {t('employeeCount', { count: employees.length })}
            </span>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button
            onClick={calculate}
            disabled={isLoading || validCount === 0}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('calculating')}
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                {t('calculate', { count: validCount })}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results && summary && <ResultsSection results={results} summary={summary} t={t} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// row component

interface RowProps {
  emp: EmployeeRow;
  rowNo: number;
  onChange: (id: string, field: keyof EmployeeRow, value: string | number) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

function NumCell(props: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  return (
    <Input
      type="number"
      className="h-8 text-xs font-mono text-right"
      placeholder={props.placeholder ?? 'Rp'}
      value={props.value || ''}
      onChange={(e) => props.onChange(Number(e.target.value) || 0)}
    />
  );
}

function EmployeeInputRow({ emp, rowNo, onChange, onRemove, canRemove }: RowProps) {
  const t = useTranslations('pph21Bulk');
  const isNonTetap = emp.employmentStatus !== 1;
  return (
    <tr className={`hover:bg-blue-50/30 ${isNonTetap ? 'bg-amber-50/40' : ''}`}>
      <td className="px-2 py-1 text-center text-xs text-slate-500">{rowNo}</td>
      <td className="px-2 py-1">
        <Select
          value={String(emp.employmentStatus)}
          onValueChange={(v) => onChange(emp.id, 'employmentStatus', Number(v))}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">{t('statusTetap')}</SelectItem>
            <SelectItem value="2">{t('statusTidakTetap')}</SelectItem>
            <SelectItem value="3">{t('statusBerhenti')}</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1">
        <Input
          className="h-8 text-xs"
          placeholder={t('namePlaceholder')}
          value={emp.name}
          onChange={(e) => onChange(emp.id, 'name', e.target.value)}
        />
      </td>
      <td className="px-2 py-1">
        <Select
          value={emp.gender || '__none'}
          onValueChange={(v) => onChange(emp.id, 'gender', v === '__none' ? '' : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">-</SelectItem>
            <SelectItem value="M">M</SelectItem>
            <SelectItem value="F">F</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1">
        <Select
          value={emp.ptkpCategory}
          onValueChange={(v) => onChange(emp.id, 'ptkpCategory', v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PTKP_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1">
        <Input
          className="h-8 text-xs font-mono"
          placeholder="XX.XXX.XXX.X-XXX.XXX"
          value={emp.npwp}
          onChange={(e) => onChange(emp.id, 'npwp', e.target.value)}
        />
      </td>
      <td className="px-2 py-1">
        <Input
          type="date"
          className="h-8 text-xs"
          value={emp.joinDate}
          onChange={(e) => onChange(emp.id, 'joinDate', e.target.value)}
        />
      </td>
      {/* income */}
      <td className="px-2 py-1 border-l">
        <NumCell value={emp.gaji} onChange={(n) => onChange(emp.id, 'gaji', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.tunjangan} onChange={(n) => onChange(emp.id, 'tunjangan', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.bonusThr} onChange={(n) => onChange(emp.id, 'bonusThr', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.natura} onChange={(n) => onChange(emp.id, 'natura', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.pinjamanGaji} onChange={(n) => onChange(emp.id, 'pinjamanGaji', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.potonganGaji} onChange={(n) => onChange(emp.id, 'potonganGaji', n)} />
      </td>
      {/* penambah (company) */}
      <td className="px-2 py-1 border-l">
        <NumCell value={emp.penambahBpjsKesehatan} onChange={(n) => onChange(emp.id, 'penambahBpjsKesehatan', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.penambahJkk} onChange={(n) => onChange(emp.id, 'penambahJkk', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.penambahJkm} onChange={(n) => onChange(emp.id, 'penambahJkm', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.penambahJht} onChange={(n) => onChange(emp.id, 'penambahJht', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.penambahJp} onChange={(n) => onChange(emp.id, 'penambahJp', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.penambahJkp} onChange={(n) => onChange(emp.id, 'penambahJkp', n)} />
      </td>
      {/* pengurang (employee) */}
      <td className="px-2 py-1 border-l">
        <NumCell value={emp.pengurangBpjsKesehatan} onChange={(n) => onChange(emp.id, 'pengurangBpjsKesehatan', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.pengurangJht} onChange={(n) => onChange(emp.id, 'pengurangJht', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.pengurangJp} onChange={(n) => onChange(emp.id, 'pengurangJp', n)} />
      </td>
      <td className="px-2 py-1">
        <NumCell value={emp.pengurangJkp} onChange={(n) => onChange(emp.id, 'pengurangJkp', n)} />
      </td>
      <td className="px-2 py-1 text-center border-l">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(emp.id)}
          disabled={!canRemove}
          className="h-7 w-7 p-0"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </Button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// results

interface ResultsProps {
  results: CalcResult[];
  summary: BulkSummary;
  t: ReturnType<typeof useTranslations>;
}

function ResultsSection({ results, summary, t }: ResultsProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: t('totalEmployees'), value: summary.totalEmployees, sub: `${summary.errorCount} ${t('errors')}` },
          { label: t('totalGross'), value: `Rp ${fmt(summary.totalGrossIncome)}`, sub: t('perYear') },
          { label: t('totalTax'), value: `Rp ${fmt(summary.totalTaxAmount)}`, sub: `Rp ${fmt(summary.totalMonthlyTax)}/${t('perMonth')}` },
          { label: t('avgRate'), value: `${summary.averageEffectiveRate.toFixed(2)}%`, sub: t('effective') },
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

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t('resultTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2 px-2">{t('colName')}</th>
                  <th className="text-left py-2 px-2">{t('colStatus')}</th>
                  <th className="text-left py-2 px-2">{t('colPtkp')}</th>
                  <th className="text-right py-2 px-2">{t('colGross')}</th>
                  <th className="text-right py-2 px-2">{t('colDeductionBreakdown')}</th>
                  <th className="text-right py-2 px-2">{t('colNet')}</th>
                  <th className="text-right py-2 px-2">PPh 21/Thn</th>
                  <th className="text-right py-2 px-2">PPh 21/Bln</th>
                  <th className="text-right py-2 px-2">{t('colRate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.map((r, i) => {
                  const dd = r.deduction_breakdown ?? r.calculation.deduction_breakdown;
                  return (
                    <tr key={i} className={r.error ? 'bg-red-50' : r.warning ? 'bg-amber-50/30' : 'hover:bg-gray-50'}>
                      <td className="py-2 px-2">
                        <span className="font-medium">{r.employee_name}</span>
                        {r.error && <p className="text-xs text-red-500">{r.error}</p>}
                        {r.warning && (
                          <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3" /> {r.warning}
                          </p>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {r.employment_status && (
                          <Badge variant="outline" className="text-xs">
                            {r.employment_status}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-xs">{r.ptkp_category}</Badge>
                      </td>
                      <td className="py-2 px-2 text-right font-mono">Rp {fmt(r.calculation.gross_income)}</td>
                      <td className="py-2 px-2 text-right font-mono text-[11px] text-gray-600">
                        {dd ? (
                          <>
                            <div>{t('colBiayaJabatan')}: Rp {fmt(dd.position_allowance)}</div>
                            <div>{t('colIuranKaryawan')}: Rp {fmt(dd.employee_contributions)}</div>
                          </>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">Rp {fmt(r.calculation.net_income)}</td>
                      <td className="py-2 px-2 text-right font-mono font-medium">Rp {fmt(r.calculation.tax_amount)}</td>
                      <td className="py-2 px-2 text-right font-mono text-blue-600">Rp {fmt(r.monthly_tax)}</td>
                      <td className="py-2 px-2 text-right">{r.effective_rate.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 font-bold">
                <tr>
                  <td className="py-2 px-2" colSpan={3}>{t('total')}</td>
                  <td className="py-2 px-2 text-right font-mono">Rp {fmt(summary.totalGrossIncome)}</td>
                  <td className="py-2 px-2"></td>
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
  );
}

export default PPh21BulkCalculator;
