'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, FileSpreadsheet, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface EmpRow { id: string; name: string; npwp: string; nik: string; ptkp: string; salary: number; jht: number; jp: number; }
function newEmp(): EmpRow { return { id: crypto.randomUUID(), name: '', npwp: '', nik: '', ptkp: 'TK0', salary: 0, jht: 0, jp: 0 }; }

export default function EBupotPage() {
  const t = useTranslations('pages');
  const te = useTranslations('ebupotPage');
  const [employees, setEmployees] = useState<EmpRow[]>([newEmp()]);
  const [companyNpwp, setCompanyNpwp] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);

  const generate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tax/ebupot-bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employees: employees.filter(e => e.name && e.salary > 0).map(e => ({
            employee_name: e.name, employee_npwp: e.npwp, employee_nik: e.nik,
            ptkp_category: e.ptkp, gross_salary: e.salary,
            jht_employee: e.jht, jp_employee: e.jp,
            position_allowance: 0, other_deductions: 0,
            tax_period_start: '01', tax_period_end: '12',
          })),
          taxYear: 2025, companyNpwp, companyName,
        }),
      });
      const data = await res.json();
      if (data.success) setResult(data.data);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  const downloadCSV = () => {
    if (!result?.csv) return;
    const blob = new Blob([result.csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ebupot-1721a1-${result.summary.taxYear}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <FileSpreadsheet className="h-6 w-6 text-blue-600" />{t('ebupotTitle')}
      </h1>

      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">{te('companyName')}</Label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="PT Example" /></div>
            <div><Label className="text-xs">{te('companyNpwp')}</Label><Input value={companyNpwp} onChange={e => setCompanyNpwp(e.target.value)} placeholder="XX.XXX.XXX.X-XXX.XXX" className="font-mono" /></div>
          </div>

          <div className="text-xs font-medium text-gray-500">{te('employeeList')}</div>
          {employees.map(emp => (
            <div key={emp.id} className="grid grid-cols-8 gap-1.5 items-end">
              <Input className="col-span-2 text-xs" placeholder={te('name')} value={emp.name} onChange={e => setEmployees(p => p.map(x => x.id === emp.id ? { ...x, name: e.target.value } : x))} />
              <Input className="text-xs font-mono" placeholder="NPWP" value={emp.npwp} onChange={e => setEmployees(p => p.map(x => x.id === emp.id ? { ...x, npwp: e.target.value } : x))} />
              <Input className="text-xs font-mono" placeholder="NIK" value={emp.nik} onChange={e => setEmployees(p => p.map(x => x.id === emp.id ? { ...x, nik: e.target.value } : x))} />
              <Select value={emp.ptkp} onValueChange={v => setEmployees(p => p.map(x => x.id === emp.id ? { ...x, ptkp: v } : x))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{['TK0','TK1','TK2','TK3','K0','K1','K2','K3'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="text-xs font-mono" type="number" placeholder={te('salary')} value={emp.salary || ''} onChange={e => setEmployees(p => p.map(x => x.id === emp.id ? { ...x, salary: Number(e.target.value) } : x))} />
              <Input className="text-xs font-mono" type="number" placeholder="JHT" value={emp.jht || ''} onChange={e => setEmployees(p => p.map(x => x.id === emp.id ? { ...x, jht: Number(e.target.value) } : x))} />
              <Button variant="ghost" size="sm" onClick={() => { if (employees.length > 1) setEmployees(p => p.filter(x => x.id !== emp.id)); }}><Trash2 className="h-3 w-3 text-red-400" /></Button>
            </div>
          ))}
          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setEmployees(p => [...p, newEmp()])}><Plus className="h-3.5 w-3.5 mr-1" />{te('addEmployee')}</Button>
            <Button onClick={generate} disabled={isLoading} className="bg-gradient-to-r from-blue-600 to-indigo-600">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}{te('generate')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{te('result', { count: result.summary.totalEmployees })}</CardTitle>
            <Button variant="outline" size="sm" onClick={downloadCSV}><Download className="h-3.5 w-3.5 mr-1" />{te('downloadCsv')}</Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-gray-50 rounded-lg text-center"><p className="text-xs text-gray-500">{te('totalGross')}</p><p className="font-bold text-sm">Rp {result.summary.totalGrossIncome.toLocaleString('id-ID')}</p></div>
              <div className="p-3 bg-blue-50 rounded-lg text-center"><p className="text-xs text-gray-500">{te('totalPph')}</p><p className="font-bold text-sm">Rp {result.summary.totalTaxWithheld.toLocaleString('id-ID')}</p></div>
              <div className="p-3 bg-green-50 rounded-lg text-center"><p className="text-xs text-gray-500">{te('employees')}</p><p className="font-bold text-sm">{result.summary.totalEmployees}</p></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-gray-500"><th className="text-left py-1.5 px-2">{te('name')}</th><th className="text-left py-1.5 px-2">{te('bpNumber')}</th><th className="text-right py-1.5 px-2">{te('gross')}</th><th className="text-right py-1.5 px-2">PPh</th></tr></thead>
                <tbody>{result.items.slice(0, 20).map((item: { employeeName: string; buktiPotongNumber: string; grossIncome: number; taxWithheld: number }, i: number) => (
                  <tr key={i} className="border-b last:border-0"><td className="py-1.5 px-2">{item.employeeName}</td><td className="py-1.5 px-2 font-mono">{item.buktiPotongNumber}</td><td className="py-1.5 px-2 text-right font-mono">Rp {item.grossIncome.toLocaleString('id-ID')}</td><td className="py-1.5 px-2 text-right font-mono">Rp {item.taxWithheld.toLocaleString('id-ID')}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
