'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageTitle } from '@/components/layout/PageTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmployeeFormDialog } from '@/components/pph21/EmployeeFormDialog';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';
import { Users, Loader2, Pencil, Trash2, Plus, Info, Search, Download } from 'lucide-react';

interface EmployeeRow {
  id: string;
  employee_name: string;
  employee_number?: string | null;
  employee_npwp?: string | null;
  worker_type?: string | null;
  employment_status?: string | null;
  position?: string | null;
  department?: string | null;
  gross_salary?: number | null;
  [k: string]: unknown;
}

const WORKER_TYPES = ['REGULAR', 'CONTRACT', 'DAILY', 'FREELANCER', 'COMMISSIONER'];
const EMPLOYMENT_STATUSES = ['PKWTT', 'PKWT', 'Consultant'];

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }

// 표준 PPh21 43-컬럼 템플릿(`public/templates/pph21-template.xlsx`)과 동일한 헤더.
// 다운로드 CSV 를 그대로 다시 업로드하면 import 로 왕복되도록 순서·명칭 일치.
const PPH21_TEMPLATE_HEADERS = [
  'employee_number',
  'Employment status\r\n(Pegawai Tetap: 1, Pegawai Tidak Tetap: 2, Bukan Pegawai: 3)',
  'employee_name', 'employee_npwp', 'employee_nik', 'ptkp_category',
  'tax method\r\n_gross/gross up', 'gross_salary', 'position_allowance', 'overtime_pay',
  'meal_allowance', 'transport_allowance', 'other_allowances', 'natura_fasilitas bkn uang',
  'bonus', 'THR', 'pinjaman gaji\r\n_loan from salary', 'potong gaji\r\n_deduction from salary',
  'jkk', 'jkm', 'jht_company', 'jp_company', 'bpjs kesehatan\r\n_company', 'JKP_company',
  'jht_employee', 'jp_employee', 'bpjs kesehatan\r\n_employee', 'JKP_employee',
  'position', 'department', 'join_date', 'resign_date', 'birth_date', 'gender',
  'email', 'phone', 'address', 'bank_name', 'bank_account_no', 'bank_account_name',
  'emergency_contact_name', 'emergency_contact_phone', 'notes',
];

// 각 템플릿 헤더 → employee_payroll 행에서 값을 뽑아내는 매퍼.
// 행에 없는 항목(overtime_pay/natura/loan 등)은 빈 값으로 둔다.
function employmentStatusNum(s: unknown): string {
  return s === 'PKWTT' ? '1' : s === 'PKWT' ? '2' : s === 'Consultant' ? '3' : '';
}
function taxMethodLabel(m: unknown): string {
  return String(m || '').toUpperCase() === 'GROSS_UP' ? 'Gross up' : m ? 'Gross' : '';
}
function templateValue(header: string, e: EmployeeRow): string {
  const v = (k: string) => { const x = e[k]; return x == null ? '' : String(x); };
  switch (header) {
    case 'employee_number': return v('employee_number');
    case 'Employment status\r\n(Pegawai Tetap: 1, Pegawai Tidak Tetap: 2, Bukan Pegawai: 3)':
      return employmentStatusNum(e.employment_status);
    case 'employee_name': return v('employee_name');
    case 'employee_npwp': return v('employee_npwp');
    case 'employee_nik': return v('employee_nik');
    case 'ptkp_category': return v('ptkp_category');
    case 'tax method\r\n_gross/gross up': return taxMethodLabel(e.pph21_method);
    case 'gross_salary': return v('gross_salary');
    case 'position_allowance': return v('position_allowance');
    case 'meal_allowance': return v('meal_allowance');
    case 'transport_allowance': return v('transport_allowance');
    case 'other_allowances': return v('other_allowance');
    case 'bonus': return v('bonus');
    case 'THR': return v('thr');
    case 'jht_company': return v('jht_company');
    case 'jp_company': return v('jp_company');
    case 'bpjs kesehatan\r\n_company': return v('bpjs_kes_company');
    case 'jht_employee': return v('jht_employee');
    case 'jp_employee': return v('jp_employee');
    case 'bpjs kesehatan\r\n_employee': return v('bpjs_kesehatan');
    case 'position': return v('position');
    case 'department': return v('department');
    case 'join_date': return v('hire_date');
    case 'resign_date': return v('resign_date');
    case 'birth_date': return v('birth_date');
    case 'gender': return v('gender');
    case 'email': return v('email');
    case 'phone': return v('phone');
    case 'address': return v('address');
    case 'bank_name': return v('bank_name');
    case 'bank_account_no': return v('bank_account_no');
    case 'bank_account_name': return v('bank_account_name');
    case 'emergency_contact_name': return v('emergency_contact_name');
    case 'emergency_contact_phone': return v('emergency_contact_phone');
    case 'notes': return v('notes');
    // 템플릿엔 있으나 마스터에 없는 항목 → 빈 값
    default: return '';
  }
}
function csvCell(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function EmployeeDirectoryPage() {
  const tp = useTranslations('pph21Page');
  const { customerId, isConsultant, customers, selectedCustomerId, setSelectedCustomerId } =
    useEffectiveCustomerId({ companyOnly: true });

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadEmployees = useCallback(async () => {
    if (!customerId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tax/employees?customerId=${customerId}`);
      const data = await res.json();
      if (data.success) setEmployees(data.data.employees || []);
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [customerId]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter(e => {
      if (typeFilter && (e.worker_type || 'REGULAR') !== typeFilter) return false;
      if (statusFilter && (e.employment_status || '') !== statusFilter) return false;
      if (!q) return true;
      return [e.employee_name, e.employee_number, e.employee_npwp]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [employees, query, typeFilter, statusFilter]);

  // PPh21 템플릿 형식 CSV 다운로드 — 현재 로드된 전체 직원 명부를 43-컬럼으로 내보냄.
  const exportCsv = () => {
    if (employees.length === 0) return;
    const headerLine = PPH21_TEMPLATE_HEADERS.map(csvCell).join(',');
    const bodyLines = employees.map(e =>
      PPH21_TEMPLATE_HEADERS.map(h => csvCell(templateValue(h, e))).join(','));
    const csv = '﻿' + [headerLine, ...bodyLines].join('\r\n'); // BOM for Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `pph21-employees-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteEmployee = async (emp: EmployeeRow) => {
    if (!window.confirm(tp('deactivateConfirm'))) return;
    try {
      const res = await fetch(`/api/tax/employees?id=${emp.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { showMsg('success', tp('employeeDeactivated')); loadEmployees(); }
      else showMsg('error', data.error || 'Failed');
    } catch { showMsg('error', 'Error'); }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <PageTitle title={tp('directoryTitle')} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />{tp('directoryTitle')}
          <span className="text-slate-400 font-normal text-base">({employees.length})</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={employees.length === 0}>
            <Download className="h-4 w-4 mr-1" />{tp('downloadCsvTemplate')}
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} disabled={!customerId}>
            <Plus className="h-4 w-4 mr-1" />{tp('newEmployee')}
          </Button>
        </div>
      </div>

      {/* 정보성 안내 — 명부 변경은 세금 신고와 무관 */}
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-900">{tp('directoryBannerTitle')}</p>
          <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{tp('directoryBannerBody')}</p>
        </div>
      </div>

      {/* Consultant customer picker */}
      {isConsultant && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label htmlFor="emp-customer" className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer</label>
          {customers.length === 0 ? (
            <span className="text-xs text-slate-400">—</span>
          ) : (
            <select id="emp-customer" value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}
              className="flex-1 max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-400">
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.full_name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Search + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input className="pl-8 h-9" placeholder={tp('directorySearchPlaceholder')} value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">{tp('filterAllTypes')}</option>
          {WORKER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{tp('filterAllStatus')}</option>
          {EMPLOYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-400">{tp('noEmployees')}</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(emp => (
            <div key={emp.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-blue-50/40 transition-colors">
              <button onClick={() => { setEditing(emp); setShowForm(true); }} className="flex-1 flex items-center gap-3 min-w-0 text-left" title={tp('dialogTitleEdit')}>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{emp.employee_name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {emp.employee_number ? `${emp.employee_number} · ` : ''}
                    {emp.worker_type || 'REGULAR'}{emp.employment_status ? ` · ${emp.employment_status}` : ''}
                    {emp.position ? ` · ${emp.position}` : ''}
                    {emp.employee_npwp ? ` · ${emp.employee_npwp}` : ''}
                  </p>
                </div>
                <span className="ml-auto text-xs font-mono text-slate-600 whitespace-nowrap">{fmt(Number(emp.gross_salary) || 0)}</span>
              </button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(emp); setShowForm(true); }} title={tp('dialogTitleEdit')}>
                <Pencil className="h-4 w-4 text-slate-500" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteEmployee(emp)} title={tp('deactivateConfirm')}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <EmployeeFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        customerId={customerId}
        employee={editing}
        onSaved={loadEmployees}
      />
    </div>
  );
}
