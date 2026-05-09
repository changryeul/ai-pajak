'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2, FileSpreadsheet, Download } from 'lucide-react';
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

export function ClosingEbupotInline({
  taxYear,
  initialCompanyName,
  initialCompanyNpwp,
}: {
  taxYear: number;
  initialCompanyName?: string | null;
  initialCompanyNpwp?: string | null;
}) {
  const [companyName, setCompanyName] = useState(initialCompanyName ?? '');
  const [companyNpwp, setCompanyNpwp] = useState(initialCompanyNpwp ?? '');
  const [employees, setEmployees] = useState<EmpRow[]>([newEmp()]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const valid = employees.filter((e) => e.name && e.salary > 0);

  const generate = async () => {
    if (!companyName || !companyNpwp) {
      toast.error('회사명과 NPWP가 필요합니다');
      return;
    }
    if (valid.length === 0) {
      toast.error('직원 1명 이상이 필요합니다');
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
        toast.error(json.error || '발급 실패');
        return;
      }
      setResult(json.data as BulkResult);
      toast.success(`${json.data.summary.totalEmployees}명 1721 A1 발급 완료`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '네트워크 오류');
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
    setEmployees((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 mt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-bold text-slate-900">e-Bupot 1721 A1 일괄 발급</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {taxYear}년 직원 원천징수 증빙. 회사명/NPWP는 결산 정보에서 자동 채움.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <Label className="text-[11px] text-slate-600">회사명</Label>
          <Input
            className="text-sm"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="PT Example Indonesia"
          />
        </div>
        <div>
          <Label className="text-[11px] text-slate-600">회사 NPWP</Label>
          <Input
            className="text-sm font-mono"
            value={companyNpwp}
            onChange={(e) => setCompanyNpwp(e.target.value)}
            placeholder="XX.XXX.XXX.X-XXX.XXX"
          />
        </div>
      </div>

      <p className="text-[11px] text-slate-600 font-medium mt-4">직원 목록</p>
      <div className="space-y-2 mt-1">
        {employees.map((emp) => (
          <div key={emp.id} className="grid grid-cols-12 gap-1.5 items-end">
            <Input
              className="col-span-3 text-xs"
              placeholder="이름"
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
              placeholder="연봉"
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
          onClick={() => setEmployees((p) => [...p, newEmp()])}
        >
          <Plus className="h-3 w-3 mr-1" />
          직원 추가
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
          1721 A1 발급
        </Button>
      </div>

      {result && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-800">
              {result.summary.totalEmployees}명 발급 완료
              {result.summary.errorCount > 0 && (
                <span className="text-rose-700"> · 오류 {result.summary.errorCount}건</span>
              )}
            </p>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={downloadCsv}>
              <Download className="h-3 w-3 mr-1" />
              CSV
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
            <div className="rounded bg-white border border-slate-200 p-2 text-center">
              <p className="text-slate-500">총 급여</p>
              <p className="font-mono text-slate-900 font-semibold">
                Rp {result.summary.totalGrossIncome.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="rounded bg-white border border-slate-200 p-2 text-center">
              <p className="text-slate-500">총 PPh 21</p>
              <p className="font-mono text-slate-900 font-semibold">
                Rp {result.summary.totalTaxWithheld.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="rounded bg-white border border-slate-200 p-2 text-center">
              <p className="text-slate-500">직원</p>
              <p className="font-mono text-slate-900 font-semibold">{result.summary.totalEmployees}</p>
            </div>
          </div>
          {result.items.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left py-1.5 px-2">이름</th>
                    <th className="text-left py-1.5 px-2">증빙번호</th>
                    <th className="text-right py-1.5 px-2">급여</th>
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
                  …상위 20명만 표시. 전체는 CSV 다운로드.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
