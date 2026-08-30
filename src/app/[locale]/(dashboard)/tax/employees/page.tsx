'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageTitle } from '@/components/layout/PageTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmployeeFormDialog } from '@/components/pph21/EmployeeFormDialog';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';
import { Users, Loader2, Pencil, Trash2, Plus, Info, Search } from 'lucide-react';

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
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} disabled={!customerId}>
          <Plus className="h-4 w-4 mr-1" />{tp('newEmployee')}
        </Button>
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
