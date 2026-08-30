'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Save } from 'lucide-react';

const PTKP_OPTIONS = ['TK0','TK1','TK2','TK3','K0','K1','K2','K3','KI0','KI1','KI2','KI3'];

const emptyForm = {
  id: '',
  employeeName: '', employeeNpwp: '', employeeNik: '', ptkpCategory: 'TK0',
  grossSalary: '', jhtEmployee: '', jpEmployee: '', otherDeductions: '',
  positionAllowance: '', mealAllowance: '', transportAllowance: '', otherAllowance: '',
  bpjsKesehatan: '', bonus: '', thr: '',
  employeeNumber: '', position: '', department: '', workerType: 'REGULAR',
  employmentStatus: '',
  hireDate: '', resignDate: '', birthDate: '', gender: '', maritalStatus: '',
  email: '', phone: '', address: '',
  bankName: '', bankAccountNo: '', bankAccountName: '', notes: '',
};

type FormState = typeof emptyForm;

/** DB row(snake_case, loose) → form(camelCase). Missing fields fall back to blank. */
function rowToForm(row: Record<string, unknown> | null): FormState {
  if (!row) return { ...emptyForm };
  const s = (v: unknown) => (v == null ? '' : String(v));
  return {
    id: s(row.id),
    employeeName: s(row.employee_name),
    employeeNpwp: s(row.employee_npwp),
    employeeNik: s(row.employee_nik),
    ptkpCategory: (row.ptkp_category as string) || 'TK0',
    grossSalary: s(row.gross_salary),
    jhtEmployee: s(row.jht_employee),
    jpEmployee: s(row.jp_employee),
    otherDeductions: s(row.other_deductions),
    positionAllowance: s(row.position_allowance),
    mealAllowance: s(row.meal_allowance),
    transportAllowance: s(row.transport_allowance),
    otherAllowance: s(row.other_allowance ?? row.other_allowances),
    bpjsKesehatan: s(row.bpjs_kesehatan),
    bonus: s(row.bonus),
    thr: s(row.thr),
    employeeNumber: s(row.employee_number),
    position: s(row.position),
    department: s(row.department),
    workerType: (row.worker_type as string) || 'REGULAR',
    employmentStatus: s(row.employment_status),
    hireDate: s(row.hire_date),
    resignDate: s(row.resign_date),
    birthDate: s(row.birth_date),
    gender: s(row.gender),
    maritalStatus: s(row.marital_status),
    email: s(row.email),
    phone: s(row.phone),
    address: s(row.address),
    bankName: s(row.bank_name),
    bankAccountNo: s(row.bank_account_no),
    bankAccountName: s(row.bank_account_name),
    notes: s(row.notes),
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  /** Existing employee row (snake_case) to edit; null → create mode. */
  employee?: Record<string, unknown> | null;
  /** Called after a successful save so the parent can reload its list. */
  onSaved?: () => void;
  /** When true, POST /sync after save so the current-month payslip is regenerated. */
  syncAfterSave?: boolean;
}

/**
 * Shared employee master create/edit dialog. Used by the PPh21 payroll screen,
 * the standalone 직원목록 page, and the payslip detail "직원정보 전체 수정".
 * Employee info is informational (not used in the PPh21 calc), so editing here
 * is safe — it never retroactively changes any filed tax figure.
 */
export function EmployeeFormDialog({ open, onOpenChange, customerId, employee, onSaved, syncAfterSave }: Props) {
  const tp = useTranslations('pph21Page');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form each time the dialog opens (or the target employee changes).
  useEffect(() => {
    if (open) {
      setForm(rowToForm(employee ?? null));
      setError(null);
    }
  }, [open, employee]);

  const save = async () => {
    if (!customerId || !form.employeeName || !form.grossSalary) {
      setError(tp('nameAndSalaryRequired'));
      return;
    }
    setIsSaving(true);
    setError(null);
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
          positionAllowance: parseFloat(form.positionAllowance) || 0,
          mealAllowance: parseFloat(form.mealAllowance) || 0,
          transportAllowance: parseFloat(form.transportAllowance) || 0,
          otherAllowance: parseFloat(form.otherAllowance) || 0,
          bpjsKesehatan: parseFloat(form.bpjsKesehatan) || 0,
          bonus: parseFloat(form.bonus) || 0,
          thr: parseFloat(form.thr) || 0,
          employeeNumber: form.employeeNumber,
          position: form.position,
          department: form.department,
          workerType: form.workerType,
          employmentStatus: form.employmentStatus || null,
          hireDate: form.hireDate || null,
          resignDate: form.resignDate || null,
          birthDate: form.birthDate || null,
          gender: form.gender,
          maritalStatus: form.maritalStatus,
          email: form.email,
          phone: form.phone,
          address: form.address,
          bankName: form.bankName,
          bankAccountNo: form.bankAccountNo,
          bankAccountName: form.bankAccountName,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed');
        return;
      }
      // Best-effort sync so a newly added employee shows up in the current month.
      if (syncAfterSave && customerId) {
        try {
          await fetch('/api/tax/employees/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId }),
          });
        } catch { /* non-fatal */ }
      }
      onOpenChange(false);
      onSaved?.();
    } catch {
      setError('Error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? tp('dialogTitleEdit') : tp('dialogTitleCreate')}</DialogTitle>
          <DialogDescription>{tp('dialogDescription')}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <div className="space-y-5 py-2">
          {/* 직원 식별 */}
          <div>
            <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('secIdentity')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-[11px]">{tp('fieldName')} <span className="text-red-500">*</span></Label>
                <Input value={form.employeeName} onChange={e => setForm({ ...form, employeeName: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldEmployeeNo')}</Label>
                <Input value={form.employeeNumber} onChange={e => setForm({ ...form, employeeNumber: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">NPWP</Label>
                <Input value={form.employeeNpwp} onChange={e => setForm({ ...form, employeeNpwp: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">NIK</Label>
                <Input value={form.employeeNik} onChange={e => setForm({ ...form, employeeNik: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">PTKP</Label>
                <Select value={form.ptkpCategory} onValueChange={v => setForm({ ...form, ptkpCategory: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PTKP_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldEmploymentStatusPMK')}</Label>
                <Select value={form.employmentStatus || 'PKWTT'} onValueChange={v => setForm({ ...form, employmentStatus: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PKWTT">PKWTT (Pegawai Tetap)</SelectItem>
                    <SelectItem value="PKWT">PKWT (Pegawai Tidak Tetap)</SelectItem>
                    <SelectItem value="Consultant">Consultant (Bukan Pegawai)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldWorkerType')}</Label>
                <Select value={form.workerType} onValueChange={v => setForm({ ...form, workerType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REGULAR">REGULAR (gross / TER)</SelectItem>
                    <SelectItem value="CONTRACT">CONTRACT</SelectItem>
                    <SelectItem value="DAILY">DAILY</SelectItem>
                    <SelectItem value="FREELANCER">FREELANCER</SelectItem>
                    <SelectItem value="COMMISSIONER">COMMISSIONER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 급여 / 수당 / BPJS */}
          <div>
            <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('secSalaryAllowance')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-[11px]">{tp('fieldGajiPokok')} <span className="text-red-500">*</span></Label>
                <Input type="number" value={form.grossSalary} onChange={e => setForm({ ...form, grossSalary: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldTunjJabatan')}</Label>
                <Input type="number" value={form.positionAllowance} onChange={e => setForm({ ...form, positionAllowance: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldTunjMakan')}</Label>
                <Input type="number" value={form.mealAllowance} onChange={e => setForm({ ...form, mealAllowance: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldTunjTransport')}</Label>
                <Input type="number" value={form.transportAllowance} onChange={e => setForm({ ...form, transportAllowance: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldTunjLainnya')}</Label>
                <Input type="number" value={form.otherAllowance} onChange={e => setForm({ ...form, otherAllowance: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">BPJS Kesehatan (employee)</Label>
                <Input type="number" value={form.bpjsKesehatan} onChange={e => setForm({ ...form, bpjsKesehatan: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">JHT (employee)</Label>
                <Input type="number" value={form.jhtEmployee} onChange={e => setForm({ ...form, jhtEmployee: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">JP (employee)</Label>
                <Input type="number" value={form.jpEmployee} onChange={e => setForm({ ...form, jpEmployee: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldPotongan')}</Label>
                <Input type="number" value={form.otherDeductions} onChange={e => setForm({ ...form, otherDeductions: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldBonus')}</Label>
                <Input type="number" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">THR</Label>
                <Input type="number" value={form.thr} onChange={e => setForm({ ...form, thr: e.target.value })} className="font-mono" />
              </div>
            </div>
          </div>

          {/* HR 인사정보 */}
          <div>
            <h4 className="text-xs font-bold text-gray-600 mb-2">{tp('secHRInfo')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-[11px]">{tp('fieldPosition')}</Label>
                <Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldDepartment')}</Label>
                <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldHireDate')}</Label>
                <Input type="date" value={form.hireDate} onChange={e => setForm({ ...form, hireDate: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldBirthDate')}</Label>
                <Input type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldGender')}</Label>
                <Select value={form.gender || 'M'} onValueChange={v => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldMarital')}</Label>
                <Select value={form.maritalStatus || 'SINGLE'} onValueChange={v => setForm({ ...form, maritalStatus: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE">SINGLE</SelectItem>
                    <SelectItem value="MARRIED">MARRIED</SelectItem>
                    <SelectItem value="DIVORCED">DIVORCED</SelectItem>
                    <SelectItem value="WIDOWED">WIDOWED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldEmail')}</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldPhone')}</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="md:col-span-3">
                <Label className="text-[11px]">{tp('fieldAddress')}</Label>
                <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldBank')}</Label>
                <Input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldAccountNo')}</Label>
                <Input value={form.bankAccountNo} onChange={e => setForm({ ...form, bankAccountNo: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label className="text-[11px]">{tp('fieldAccountName')}</Label>
                <Input value={form.bankAccountName} onChange={e => setForm({ ...form, bankAccountName: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {tp('btnCancel')}
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            {tp('btnSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
