'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2, FileSpreadsheet, Download, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 결산 wizard 안에서 사용하는 1721 A1 일괄 발급 inline 컴포넌트.
 * 별도 /tax/ebupot 페이지로 이동할 필요 없이 같은 화면에서 직원 입력 →
 * 발급 → CSV 다운로드 까지 처리. 백엔드는 기존 /api/tax/ebupot-bulk 그대로.
 */

interface EmpRow {
  id: string;
  name: string;
  npwp: string;
  nik: string;
  ptkp: string;
  salary: number;
  jht: number;
  jp: number;
}

const PTKP_CODES = ['TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3'];

function newEmp(): EmpRow {
  return { id: crypto.randomUUID(), name: '', npwp: '', nik: '', ptkp: 'TK0', salary: 0, jht: 0, jp: 0 };
}

interface BulkResultItem {
  employeeName: string;
  buktiPotongNumber: string;
  grossIncome: number;
  taxWithheld: number;
}

interface BulkResult {
  items: BulkResultItem[];
  csv: string;
  summary: {
    companyName: string;
    companyNpwp: string;
    taxYear: number;
    totalEmployees: number;
    errorCount: number;
    totalGrossIncome: number;
    totalTaxWithheld: number;
    generatedAt: string;
  };
}

interface PrefillState {
  loading: boolean;
  source: 'payrollRows' | 'lineItems' | 'none' | null;
  sourceFilename: string | null;
  confidence: number | null;
  lowConfidence: boolean;
  prefillCount: number;
  error: string | null;
}

export function ClosingEbupotInline({
  taxYear,
  initialCompanyName,
  initialCompanyNpwp,
  sessionId,
}: {
  taxYear: number;
  initialCompanyName?: string | null;
  initialCompanyNpwp?: string | null;
  /** When provided, the form auto-prefills employees from the latest PAYROLL
   *  closing_document OCR result for this session. */
  sessionId?: string | null;
}) {
  const t = useTranslations('closingEbupot');
  const [companyName, setCompanyName] = useState(initialCompanyName ?? '');
  const [companyNpwp, setCompanyNpwp] = useState(initialCompanyNpwp ?? '');
  const [employees, setEmployees] = useState<EmpRow[]>([newEmp()]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [prefill, setPrefill] = useState<PrefillState>({
    loading: false,
    source: null,
    sourceFilename: null,
    confidence: null,
    lowConfidence: false,
    prefillCount: 0,
    error: null,
  });
  // Once the user has touched the employee table we stop auto-overwriting it.
  const hasUserEditedRef = useRef(false);

  const runPrefill = useCallback(async () => {
    if (!sessionId) return;
    setPrefill((p) => ({ ...p, loading: true, error: null }));
    try {
      const res = await fetch(`/api/tax/annual-closing/${sessionId}/ebupot-prefill`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) {
        setPrefill((p) => ({ ...p, loading: false, error: json.error || t('errors.prefillFailed') }));
        return;
      }
      const payload = json.data as {
        source: 'payrollRows' | 'lineItems' | 'none';
        sourceFilename: string | null;
        ocrConfidence: number | null;
        lowConfidence: boolean;
        employees: Array<{
          name: string;
          npwp: string;
          nik: string;
          ptkp: string;
          salary: number;
          jht: number;
          jp: number;
        }>;
      };
      if (payload.source === 'none' || payload.employees.length === 0) {
        setPrefill({
          loading: false,
          source: 'none',
          sourceFilename: null,
          confidence: null,
          lowConfidence: false,
          prefillCount: 0,
          error: null,
        });
        return;
      }
      // Only overwrite if user hasn't started editing the table.
      if (!hasUserEditedRef.current) {
        setEmployees(payload.employees.map((e) => ({ ...e, id: crypto.randomUUID() })));
      }
      setPrefill({
        loading: false,
        source: payload.source,
        sourceFilename: payload.sourceFilename,
        confidence: payload.ocrConfidence,
        lowConfidence: payload.lowConfidence,
        prefillCount: payload.employees.length,
        error: null,
      });
    } catch (err) {
      setPrefill((p) => ({
        ...p,
        loading: false,
        error: err instanceof Error ? err.message : t('errors.network'),
      }));
    }
  }, [sessionId, t]);

  useEffect(() => {
    if (sessionId) void runPrefill();
  }, [sessionId, runPrefill]);

  const valid = employees.filter((e) => e.name && e.salary > 0);

  const generate = async () => {
    if (!companyName || !companyNpwp) {
      toast.error(t('errors.companyRequired'));
      return;
    }
    if (valid.length === 0) {
      toast.error(t('errors.employeesRequired'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/tax/ebupot-bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employees: valid.map((e) => ({
            employee_name: e.name,
            employee_npwp: e.npwp,
            employee_nik: e.nik,
            ptkp_category: e.ptkp,
            gross_salary: e.salary,
            jht_employee: e.jht,
            jp_employee: e.jp,
            position_allowance: 0,
            other_deductions: 0,
            tax_period_start: '01',
            tax_period_end: '12',
          })),
          taxYear,
          companyNpwp,
          companyName,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || t('errors.issueFailed'));
        return;
      }
      setResult(json.data as BulkResult);
      toast.success(t('successToast', { n: json.data.summary.totalEmployees }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = () => {
    if (!result?.csv) return;
    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ebupot-1721a1-${result.summary.taxYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateEmp = (id: string, patch: Partial<EmpRow>) => {
    hasUserEditedRef.current = true;
    setEmployees((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 mt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-bold text-slate-900">{t('heading')}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('subtitle', { year: taxYear })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <Label className="text-[11px] text-slate-600">{t('companyName')}</Label>
          <Input
            className="text-sm"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="PT Example Indonesia"
          />
        </div>
        <div>
          <Label className="text-[11px] text-slate-600">{t('companyNpwp')}</Label>
          <Input
            className="text-sm font-mono"
            value={companyNpwp}
            onChange={(e) => setCompanyNpwp(e.target.value)}
            placeholder="XX.XXX.XXX.X-XXX.XXX"
          />
        </div>
      </div>

      {sessionId && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-xs">
          {prefill.loading ? (
            <span className="flex items-center text-emerald-700">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {t('ocrLoading')}
            </span>
          ) : prefill.source === 'payrollRows' || prefill.source === 'lineItems' ? (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center font-bold text-emerald-800">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {t('ocrPrefilled', { n: prefill.prefillCount })}
                </p>
                <p className="text-[10px] text-emerald-700 mt-0.5">
                  {prefill.sourceFilename
                    ? t('ocrSourceFile', { filename: prefill.sourceFilename })
                    : t('ocrSourceDefault')}
                  {prefill.confidence !== null
                    ? t('ocrConfidence', { pct: Math.round(prefill.confidence * 100) })
                    : ''}
                  {prefill.source === 'lineItems' ? t('ocrManualNote') : ''}
                </p>
                {prefill.lowConfidence && (
                  <p className="flex items-center text-[10px] text-amber-800 mt-1">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {t('ocrLowConfWarn')}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-[10px] h-7"
                onClick={() => {
                  hasUserEditedRef.current = false;
                  void runPrefill();
                }}
                disabled={prefill.loading}
              >
                {t('ocrRefill')}
              </Button>
            </div>
          ) : prefill.error ? (
            <p className="text-[11px] text-rose-700">
              <AlertTriangle className="inline h-3 w-3 mr-1" />
              {t('ocrPrefillFailed', { error: prefill.error })}
            </p>
          ) : (
            <p className="text-[11px] text-slate-600">{t('ocrEmptyHint')}</p>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-600 font-medium mt-4">{t('employeeList')}</p>
      <div className="space-y-2 mt-1">
        {employees.map((emp) => (
          <div key={emp.id} className="grid grid-cols-12 gap-1.5 items-end">
            <Input
              className="col-span-3 text-xs"
              placeholder={t('namePlaceholder')}
              value={emp.name}
              onChange={(e) => updateEmp(emp.id, { name: e.target.value })}
            />
            <Input
              className="col-span-2 text-xs font-mono"
              placeholder="NPWP"
              value={emp.npwp}
              onChange={(e) => updateEmp(emp.id, { npwp: e.target.value })}
            />
            <Input
              className="col-span-2 text-xs font-mono"
              placeholder="NIK"
              value={emp.nik}
              onChange={(e) => updateEmp(emp.id, { nik: e.target.value })}
            />
            <Select value={emp.ptkp} onValueChange={(v) => updateEmp(emp.id, { ptkp: v })}>
              <SelectTrigger className="col-span-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PTKP_CODES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="col-span-2 text-xs font-mono"
              type="number"
              placeholder={t('salaryPlaceholder')}
              value={emp.salary || ''}
              onChange={(e) => updateEmp(emp.id, { salary: Number(e.target.value) })}
            />
            <Input
              className="col-span-1 text-xs font-mono"
              type="number"
              placeholder="JHT"
              value={emp.jht || ''}
              onChange={(e) => updateEmp(emp.id, { jht: Number(e.target.value) })}
            />
            <Button
              variant="ghost"
              size="sm"
              className="col-span-1"
              onClick={() => {
                if (employees.length > 1) {
                  hasUserEditedRef.current = true;
                  setEmployees((p) => p.filter((x) => x.id !== emp.id));
                }
              }}
            >
              <Trash2 className="h-3 w-3 text-rose-400" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-between mt-3">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            hasUserEditedRef.current = true;
            setEmployees((p) => [...p, newEmp()]);
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          {t('addEmployee')}
        </Button>
        <Button
          size="sm"
          onClick={generate}
          disabled={busy || valid.length === 0}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <FileSpreadsheet className="h-3 w-3 mr-1" />
          )}
          {t('issueBtn')}
        </Button>
      </div>

      {result && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-800">
              {t('issueDone', { n: result.summary.totalEmployees })}
              {result.summary.errorCount > 0 && (
                <span className="text-rose-700">{t('issueErrors', { n: result.summary.errorCount })}</span>
              )}
            </p>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={downloadCsv}>
              <Download className="h-3 w-3 mr-1" />
              CSV
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
            <div className="rounded bg-white border border-slate-200 p-2 text-center">
              <p className="text-slate-500">{t('totalSalary')}</p>
              <p className="font-mono text-slate-900 font-semibold">
                Rp {result.summary.totalGrossIncome.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="rounded bg-white border border-slate-200 p-2 text-center">
              <p className="text-slate-500">{t('totalPph21')}</p>
              <p className="font-mono text-slate-900 font-semibold">
                Rp {result.summary.totalTaxWithheld.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="rounded bg-white border border-slate-200 p-2 text-center">
              <p className="text-slate-500">{t('employeeCount')}</p>
              <p className="font-mono text-slate-900 font-semibold">{result.summary.totalEmployees}</p>
            </div>
          </div>
          {result.items.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left py-1.5 px-2">{t('tblName')}</th>
                    <th className="text-left py-1.5 px-2">{t('tblCertNo')}</th>
                    <th className="text-right py-1.5 px-2">{t('tblSalary')}</th>
                    <th className="text-right py-1.5 px-2">PPh 21</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.slice(0, 20).map((item, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1.5 px-2">{item.employeeName}</td>
                      <td className="py-1.5 px-2 font-mono">{item.buktiPotongNumber}</td>
                      <td className="py-1.5 px-2 text-right font-mono">
                        Rp {item.grossIncome.toLocaleString('id-ID')}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono">
                        Rp {item.taxWithheld.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.items.length > 20 && (
                <p className="text-[10px] text-slate-500 px-2 py-1 bg-slate-50">
                  {t('tblTop20Note')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
