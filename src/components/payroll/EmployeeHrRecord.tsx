'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';
import { Loader2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────────────────────
type FamilyMember = { relation: string; name: string; dob: string; nik: string; occupation: string; dependent: string } & Record<string, string>;
type EducationEntry = { level: string; major: string; school: string; city: string; year: string } & Record<string, string>;
type CareerEntry = { period: string; company: string; jobTitle: string; reason: string } & Record<string, string>;
type PromotionEntry = { date: string; previousTitle: string; newTitle: string; reason: string } & Record<string, string>;
type MovementEntry = { date: string; previousDept: string; newDept: string; reason: string } & Record<string, string>;
type RewardEntry = { date: string; type: string; title: string; note: string } & Record<string, string>;

interface EmployeeRow {
  id?: string;
  employee_number?: string | null;
  employee_name: string;
  preferred_name?: string | null;
  photo_url?: string | null;
  nationality?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  place_of_birth?: string | null;
  blood_type?: string | null;
  employee_nik?: string | null;
  employee_npwp?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  position?: string | null;
  department?: string | null;
  work_location?: string | null;
  supervisor?: string | null;
  hire_date?: string | null;
  employment_status?: string | null;
  contract_status?: string | null;
  probation_end?: string | null;
  marital_status?: string | null;
  ptkp_category?: string | null;
  spouse_name?: string | null;
  dependents?: string | null;
  basic_salary?: number | null;
  transport_allowance?: number | null;
  meal_allowance?: number | null;
  position_allowance?: number | null;
  other_allowance?: number | null;
  pph21_method?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_account_name?: string | null;
  bpjs_kesehatan?: string | null;
  bpjs_kesehatan_no?: string | null;
  bpjs_tk?: string | null;
  bpjs_tk_no?: string | null;
  private_insurance?: string | null;
  contract_type?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  passport_no?: string | null;
  kitas_no?: string | null;
  work_permit_expiry?: string | null;
  tax_residency?: string | null;
  notes?: string | null;
  family?: FamilyMember[] | null;
  education?: EducationEntry[] | null;
  career?: CareerEntry[] | null;
  promotions?: PromotionEntry[] | null;
  movements?: MovementEntry[] | null;
  rewards?: RewardEntry[] | null;
}

// UI-shaped record used by the form — fields match the original prototype keys.
interface UiEmployee {
  id?: string;
  employeeId: string;        // employee_number
  fullName: string;
  preferredName: string;
  photoDataUrl: string;
  nationality: string;
  gender: string;
  dob: string;
  placeOfBirth: string;
  bloodType: string;
  nik: string;
  npwp: string;
  phone: string;
  email: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  position: string;
  department: string;
  workLocation: string;
  supervisor: string;
  joinDate: string;
  employmentStatus: string;
  contractStatus: string;
  probationEnd: string;
  maritalStatus: string;
  ptkp: string;
  spouseName: string;
  dependents: string;
  basicSalary: string;
  transportAllowance: string;
  mealAllowance: string;
  positionAllowance: string;
  otherAllowance: string;
  pph21Method: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  bpjsKesehatan: string;
  bpjsKesehatanNo: string;
  bpjsTk: string;
  bpjsTkNo: string;
  privateInsurance: string;
  contractType: string;
  contractStart: string;
  contractEnd: string;
  passportNo: string;
  kitasNo: string;
  workPermitExpiry: string;
  taxResidency: string;
  notes: string;
}

interface UiRecord {
  employee: UiEmployee;
  family: FamilyMember[];
  education: EducationEntry[];
  career: CareerEntry[];
  promotions: PromotionEntry[];
  movements: MovementEntry[];
  rewards: RewardEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row → UI shape (and back)
// ─────────────────────────────────────────────────────────────────────────────
const toStr = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const rowToUi = (r: EmployeeRow): UiRecord => ({
  employee: {
    id: r.id,
    employeeId: toStr(r.employee_number),
    fullName: toStr(r.employee_name),
    preferredName: toStr(r.preferred_name),
    photoDataUrl: toStr(r.photo_url),
    nationality: toStr(r.nationality),
    gender: toStr(r.gender),
    dob: toStr(r.birth_date),
    placeOfBirth: toStr(r.place_of_birth),
    bloodType: toStr(r.blood_type),
    nik: toStr(r.employee_nik),
    npwp: toStr(r.employee_npwp),
    phone: toStr(r.phone),
    email: toStr(r.email),
    address: toStr(r.address),
    emergencyName: toStr(r.emergency_contact_name),
    emergencyPhone: toStr(r.emergency_contact_phone),
    position: toStr(r.position),
    department: toStr(r.department),
    workLocation: toStr(r.work_location),
    supervisor: toStr(r.supervisor),
    joinDate: toStr(r.hire_date),
    employmentStatus: toStr(r.employment_status),
    contractStatus: toStr(r.contract_status),
    probationEnd: toStr(r.probation_end),
    maritalStatus: toStr(r.marital_status),
    ptkp: toStr(r.ptkp_category),
    spouseName: toStr(r.spouse_name),
    dependents: toStr(r.dependents),
    basicSalary: toStr(r.basic_salary),
    transportAllowance: toStr(r.transport_allowance),
    mealAllowance: toStr(r.meal_allowance),
    positionAllowance: toStr(r.position_allowance),
    otherAllowance: toStr(r.other_allowance),
    pph21Method: toStr(r.pph21_method),
    bankName: toStr(r.bank_name),
    bankAccount: toStr(r.bank_account_no),
    bankHolder: toStr(r.bank_account_name),
    bpjsKesehatan: toStr(r.bpjs_kesehatan),
    bpjsKesehatanNo: toStr(r.bpjs_kesehatan_no),
    bpjsTk: toStr(r.bpjs_tk),
    bpjsTkNo: toStr(r.bpjs_tk_no),
    privateInsurance: toStr(r.private_insurance),
    contractType: toStr(r.contract_type),
    contractStart: toStr(r.contract_start_date),
    contractEnd: toStr(r.contract_end_date),
    passportNo: toStr(r.passport_no),
    kitasNo: toStr(r.kitas_no),
    workPermitExpiry: toStr(r.work_permit_expiry),
    taxResidency: toStr(r.tax_residency),
    notes: toStr(r.notes),
  },
  family: Array.isArray(r.family) ? r.family : [],
  education: Array.isArray(r.education) ? r.education : [],
  career: Array.isArray(r.career) ? r.career : [],
  promotions: Array.isArray(r.promotions) ? r.promotions : [],
  movements: Array.isArray(r.movements) ? r.movements : [],
  rewards: Array.isArray(r.rewards) ? r.rewards : [],
});

const uiToApi = (rec: UiRecord, customerId: string) => ({
  id: rec.employee.id,
  customerId,
  employeeNumber: rec.employee.employeeId || null,
  employeeName: rec.employee.fullName,
  preferredName: rec.employee.preferredName || null,
  // photoUrl is intentionally not sent here — the /photo endpoint persists
  // the storage path on its own. For unsaved (new) employees we still want
  // the inline data: URL so it round-trips through the first save.
  photoUrl: rec.employee.photoDataUrl?.startsWith('data:') ? rec.employee.photoDataUrl : undefined,
  nationality: rec.employee.nationality || null,
  gender: rec.employee.gender || null,
  birthDate: rec.employee.dob || null,
  placeOfBirth: rec.employee.placeOfBirth || null,
  bloodType: rec.employee.bloodType || null,
  employeeNik: rec.employee.nik || null,
  employeeNpwp: rec.employee.npwp || null,
  phone: rec.employee.phone || null,
  email: rec.employee.email || null,
  address: rec.employee.address || null,
  emergencyContactName: rec.employee.emergencyName || null,
  emergencyContactPhone: rec.employee.emergencyPhone || null,
  position: rec.employee.position || null,
  department: rec.employee.department || null,
  workLocation: rec.employee.workLocation || null,
  supervisor: rec.employee.supervisor || null,
  hireDate: rec.employee.joinDate || null,
  employmentStatus: rec.employee.employmentStatus || null,
  contractStatus: rec.employee.contractStatus || null,
  probationEnd: rec.employee.probationEnd || null,
  maritalStatus: rec.employee.maritalStatus || null,
  ptkpCategory: rec.employee.ptkp || null,
  spouseName: rec.employee.spouseName || null,
  dependents: rec.employee.dependents || null,
  basicSalary: rec.employee.basicSalary ? Number(rec.employee.basicSalary) : null,
  transportAllowance: rec.employee.transportAllowance ? Number(rec.employee.transportAllowance) : null,
  mealAllowance: rec.employee.mealAllowance ? Number(rec.employee.mealAllowance) : null,
  positionAllowance: rec.employee.positionAllowance ? Number(rec.employee.positionAllowance) : null,
  otherAllowance: rec.employee.otherAllowance ? Number(rec.employee.otherAllowance) : null,
  pph21Method: rec.employee.pph21Method || null,
  bankName: rec.employee.bankName || null,
  bankAccountNo: rec.employee.bankAccount || null,
  bankAccountName: rec.employee.bankHolder || null,
  bpjsKesehatan: rec.employee.bpjsKesehatan || null,
  bpjsKesehatanNo: rec.employee.bpjsKesehatanNo || null,
  bpjsTk: rec.employee.bpjsTk || null,
  bpjsTkNo: rec.employee.bpjsTkNo || null,
  privateInsurance: rec.employee.privateInsurance || null,
  contractType: rec.employee.contractType || null,
  contractStartDate: rec.employee.contractStart || null,
  contractEndDate: rec.employee.contractEnd || null,
  passportNo: rec.employee.passportNo || null,
  kitasNo: rec.employee.kitasNo || null,
  workPermitExpiry: rec.employee.workPermitExpiry || null,
  taxResidency: rec.employee.taxResidency || null,
  notes: rec.employee.notes || null,
  family: rec.family,
  education: rec.education,
  career: rec.career,
  promotions: rec.promotions,
  movements: rec.movements,
  rewards: rec.rewards,
});

const emptyRecord = (): UiRecord => ({
  employee: {
    employeeId: '', fullName: '', preferredName: '', photoDataUrl: '',
    nationality: 'Indonesia', gender: 'Male', dob: '', placeOfBirth: '', bloodType: '',
    nik: '', npwp: '', phone: '', email: '', address: '',
    emergencyName: '', emergencyPhone: '',
    position: '', department: '', workLocation: '', supervisor: '',
    joinDate: '', employmentStatus: 'PKWTT', contractStatus: 'Active', probationEnd: '',
    maritalStatus: 'Single', ptkp: 'TK/0', spouseName: '', dependents: '0',
    basicSalary: '', transportAllowance: '', mealAllowance: '', positionAllowance: '', otherAllowance: '',
    pph21Method: 'Gross',
    bankName: '', bankAccount: '', bankHolder: '',
    bpjsKesehatan: 'Active', bpjsKesehatanNo: '', bpjsTk: 'Active', bpjsTkNo: '', privateInsurance: '',
    contractType: 'PKWTT', contractStart: '', contractEnd: '',
    passportNo: '', kitasNo: '', workPermitExpiry: '', taxResidency: 'Indonesia Tax Resident',
    notes: '',
  },
  family: [], education: [], career: [], promotions: [], movements: [], rewards: [],
});

// ─────────────────────────────────────────────────────────────────────────────
// Reusable inputs (matching the prototype's tailwind aesthetic)
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value || ''}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm outline-none ${readOnly ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100'}`}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value || ''}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm outline-none ${readOnly ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100'}`}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function TextAreaField({ label, value, onChange, readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <textarea
        value={value || ''}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-800 shadow-sm outline-none ${readOnly ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100'}`}
      />
    </label>
  );
}

function Section({ emoji, title, subtitle, colorClass, children }: {
  emoji: string; title: string; subtitle: string; colorClass: string; children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/70">
      <div className={`h-2 ${colorClass}`} />
      <div className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-lg text-white ${colorClass}`}>{emoji}</div>
          <div>
            <h2 className="text-base font-black text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

function ArrayRow({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">{children}</div>;
}

function AddButton({ children, onClick, hidden }: { children: React.ReactNode; onClick: () => void; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
    >
      ＋ {children}
    </button>
  );
}

function PhotoUpload({ photoDataUrl, fullName, readOnly, onUpload, onRemove, employeeId }: {
  photoDataUrl: string; fullName: string; readOnly: boolean;
  onUpload: (v: string) => void; onRemove: () => void;
  employeeId?: string;
}) {
  const t = useTranslations('employeeHr.photo');
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // For unsaved (new) employees we keep the data URL inline and let the
    // initial save snapshot the photo path during the first edit pass; for
    // existing employees we upload to Supabase Storage immediately and store
    // the signed URL.
    if (!employeeId) {
      const reader = new FileReader();
      reader.onload = () => onUpload(String(reader.result || ''));
      reader.readAsDataURL(file);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/tax/employees/${employeeId}/photo`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (json.success && json.data?.signedUrl) {
        onUpload(json.data.signedUrl);
      } else {
        // Fall back to data URL on error so the user still sees the picture.
        const reader = new FileReader();
        reader.onload = () => onUpload(String(reader.result || ''));
        reader.readAsDataURL(file);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => onUpload(String(reader.result || ''));
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (employeeId) {
      try {
        await fetch(`/api/tax/employees/${employeeId}/photo`, { method: 'DELETE' });
      } catch { /* ignore */ }
    }
    onRemove();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-3xl border-4 border-white/60 bg-white/20 text-center text-sm font-black tracking-widest shadow-xl">
        {photoDataUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={photoDataUrl} alt={`${fullName} profile`} className="h-full w-full object-cover" />
        ) : (
          <span>PHOTO<br />UPLOAD</span>
        )}
      </div>
      {!readOnly && (
        <div className="flex flex-col items-center gap-2">
          <label className="cursor-pointer rounded-2xl bg-white px-4 py-2 text-sm font-black text-indigo-700 shadow-sm hover:bg-indigo-50">
            {uploading ? t('uploading') : t('uploadBtn')}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
          {photoDataUrl && (
            <button type="button" onClick={handleRemove} className="text-xs font-bold text-white/80 underline">
              {t('removeBtn')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Search screen
// ─────────────────────────────────────────────────────────────────────────────
interface ImportSummary {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; message?: string; messageKey?: string }[];
  unmappedHeaders: string[];
  mappedHeaders: { column: string; field: string }[];
}

function UploadCard({ customerId, onImported }: { customerId: string; onImported: () => void }) {
  const t = useTranslations('employeeHr.uploadSection');
  const tEmployeeHr = useTranslations('employeeHr');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string>('');

  const handleFile = async (file: File) => {
    setUploading(true);
    setSummary(null);
    setError('');
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('customerId', customerId);
      const res = await fetch('/api/tax/employees/hr-import', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // API returns either `errorKey` (i18n key into employeeHr namespace) or
        // `error` (plain string fallback). Strip the `employeeHr.` prefix so
        // the namespaced `t` resolves correctly.
        const key = typeof json.errorKey === 'string' && json.errorKey.startsWith('employeeHr.')
          ? json.errorKey.slice('employeeHr.'.length)
          : null;
        const tEmp = tEmployeeHr;
        setError(key ? tEmp(key) : (json.error || t('uploadFailed')));
      } else {
        setSummary(json.data as ImportSummary);
        onImported();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <section className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/70">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="flex-1 space-y-3">
          <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
            {t('title')}
          </div>
          <h3 className="text-lg font-black text-slate-900">{t('heading')}</h3>
          <p className="text-sm text-slate-600">{t('desc')}</p>
          <p className="text-xs text-slate-500">
            <span className="font-mono">{t('example')}</span> {t('exampleValue')}
          </p>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{t('note')}</p>
        </div>
        <div className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-6 lg:w-72">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> {t('uploading')}</> : t('button')}
          </button>
          <p className="text-[11px] text-slate-500 text-center">
            {fileName || t('noFile')}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {summary && (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm">
          <p className="font-bold text-emerald-900">
            {t('summary', {
              imported: summary.imported,
              updated: summary.updated,
              skipped: summary.skipped,
              total: summary.totalRows,
            })}
          </p>
          {summary.mappedHeaders.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-emerald-700">
                {t('viewMapped', { n: summary.mappedHeaders.length })}
              </summary>
              <div className="mt-2 grid gap-1 text-[11px] text-emerald-800 sm:grid-cols-2">
                {summary.mappedHeaders.map((m) => (
                  <div key={`${m.column}-${m.field}`}>
                    <span className="font-mono">{m.column}</span> → <span className="font-mono">{m.field}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          {summary.unmappedHeaders.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-amber-700">
                {t('unmapped', { n: summary.unmappedHeaders.length })}
              </summary>
              <div className="mt-2 text-[11px] text-amber-800 font-mono">
                {summary.unmappedHeaders.join(', ')}
              </div>
            </details>
          )}
          {summary.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-red-700">
                {t('errors', { n: summary.errors.length })}
              </summary>
              <div className="mt-2 space-y-0.5 text-[11px] text-red-800">
                {summary.errors.map((er) => {
                  // API may return either `messageKey` (i18n key, namespaced
                  // under `employeeHr.`) or a raw `message` string.
                  const localized = er.messageKey && er.messageKey.startsWith('employeeHr.')
                    ? tEmployeeHr(er.messageKey.slice('employeeHr.'.length))
                    : er.message ?? '';
                  return <div key={er.row}>Row {er.row}: {localized}</div>;
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function SearchScreen({
  searchBy, setSearchBy, keyword, setKeyword, results, openDetail, openNew, loading, customerId, onImported, customerPicker,
}: {
  searchBy: 'ID' | 'NAME';
  setSearchBy: (v: 'ID' | 'NAME') => void;
  keyword: string;
  setKeyword: (v: string) => void;
  results: UiRecord[];
  openDetail: (rec: UiRecord, mode: 'view' | 'edit') => void;
  openNew: () => void;
  loading: boolean;
  customerId: string;
  onImported: () => void;
  /** Consultant-only customer dropdown shown above the search box. Null for CUSTOMER role. */
  customerPicker: React.ReactNode | null;
}) {
  const t = useTranslations('employeeHr.search');
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 p-6 text-slate-800">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 p-8 text-white shadow-2xl shadow-indigo-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex rounded-full bg-white/20 px-4 py-1 text-xs font-black">AI Payroll · Employee Master</div>
              <h1 className="text-4xl font-black tracking-tight">{t('title')}</h1>
              <p className="mt-3 text-indigo-100">{t('subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-indigo-700 shadow-lg hover:bg-indigo-50"
            >
              {t('newEmployee')}
            </button>
          </div>
        </section>

        {customerPicker}

        <UploadCard customerId={customerId} onImported={onImported} />

        <section className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/70">
          <div className="grid gap-4 lg:grid-cols-[180px_1fr_auto] lg:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{t('by')}</span>
              <select
                value={searchBy}
                onChange={(e) => setSearchBy(e.target.value as 'ID' | 'NAME')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                <option value="ID">{t('byId')}</option>
                <option value="NAME">{t('byName')}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{t('keyword')}</span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={searchBy === 'ID' ? t('placeholderId') : t('placeholderName')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-500 px-4 py-3 text-center text-sm font-black text-white shadow-lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : t('resultCount', { n: results.length })}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((item) => (
            <div
              key={item.employee.id || item.employee.employeeId}
              className="rounded-3xl border border-white bg-white p-5 shadow-lg shadow-slate-200/70"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-100 to-fuchsia-100 text-xs font-black text-indigo-500">
                  {item.employee.photoDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.employee.photoDataUrl} alt="profile" className="h-full w-full object-cover" />
                  ) : 'PHOTO'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-indigo-600">{item.employee.employeeId || '—'}</div>
                  <div className="mt-1 text-xl font-black text-slate-900">{item.employee.fullName}</div>
                  <div className="text-sm text-slate-500">{item.employee.position}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {item.employee.department}{item.employee.workLocation ? ` · ${item.employee.workLocation}` : ''}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => openDetail(item, 'view')}
                  className="w-full rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-indigo-700"
                >
                  {t('openBtn')}
                </button>
              </div>
            </div>
          ))}
        </section>

        {!loading && results.length === 0 && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-700">
            {t('emptyState')}
          </div>
        )}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail screen
// ─────────────────────────────────────────────────────────────────────────────
interface ChangeLogEntry {
  id: string;
  section: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_label: string | null;
  changed_at: string;
}

function ChangeHistoryPanel({ entries, title }: { entries: ChangeLogEntry[]; title: string }) {
  const t = useTranslations('employeeHr.history');
  if (entries.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        {t('empty', { title })}
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <span className="text-xs font-bold text-slate-700">{title}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
          {t('count', { n: entries.length })}
        </span>
      </div>
      <ul className="divide-y divide-slate-100 text-xs">
        {entries.map((e) => (
          <li key={e.id} className="grid grid-cols-[110px_1fr_1fr_1fr_120px] gap-2 px-4 py-2">
            <span className="font-mono font-bold text-indigo-600">{e.changed_at.slice(0, 10)}</span>
            <span className="text-slate-700"><span className="text-slate-400">{t('field')}</span><br />{e.field}</span>
            <span className="text-slate-700 truncate"><span className="text-slate-400">{t('before')}</span><br />{e.old_value || '—'}</span>
            <span className="text-slate-700 truncate"><span className="text-slate-400">{t('after')}</span><br />{e.new_value || '—'}</span>
            <span className="text-slate-700 truncate"><span className="text-slate-400">{t('actor')}</span><br />{e.changed_by_label || '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailScreen({
  record, setRecord, mode, setMode, goBack, onSave, isNew, savedMessage, saving, changes,
}: {
  record: UiRecord;
  setRecord: React.Dispatch<React.SetStateAction<UiRecord>>;
  mode: 'view' | 'edit';
  setMode: (m: 'view' | 'edit') => void;
  goBack: () => void;
  onSave: () => void;
  isNew: boolean;
  savedMessage: string;
  saving: boolean;
  changes: ChangeLogEntry[];
}) {
  const tForm = useTranslations('employeeHr.form');
  const tSec = useTranslations('employeeHr.sections');
  const employee = record.employee;
  const readOnly = mode === 'view';

  const updateEmployee = <K extends keyof UiEmployee>(key: K, value: UiEmployee[K]) => {
    setRecord((prev) => ({ ...prev, employee: { ...prev.employee, [key]: value } }));
  };

  type ListKey = 'family' | 'education' | 'career' | 'promotions' | 'movements' | 'rewards';

  const updateList = <T extends Record<string, string>>(listKey: ListKey, index: number, key: keyof T & string, value: string) => {
    setRecord((prev) => ({
      ...prev,
      [listKey]: (prev[listKey] as unknown as T[]).map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addRow = <T,>(listKey: ListKey, template: T) => {
    setRecord((prev) => ({ ...prev, [listKey]: [...(prev[listKey] as unknown as T[]), template] }));
  };

  const grossSalary = useMemo(() => {
    const n = (v: string) => Number(String(v || '0').replace(/[^0-9.-]/g, '')) || 0;
    return n(employee.basicSalary) + n(employee.transportAllowance) + n(employee.mealAllowance)
      + n(employee.positionAllowance) + n(employee.otherAllowance);
  }, [employee.basicSalary, employee.transportAllowance, employee.mealAllowance, employee.positionAllowance, employee.otherAllowance]);

  const money = (v: number) => {
    try {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
    } catch { return `Rp ${v || 0}`; }
  };

  const changesBy = (section: string) => changes.filter((c) => c.section === section);

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 p-6 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-4 shadow-xl shadow-slate-200/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={goBack}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50">
                {tForm('back')}
              </button>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">
                {isNew ? tForm('newTitle') : tForm('detailTitle')}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isNew && mode === 'view' ? (
                <button type="button" onClick={() => setMode('edit')}
                  className="rounded-2xl bg-fuchsia-600 px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-fuchsia-700">
                  {tForm('edit')}
                </button>
              ) : !isNew ? (
                <>
                  <button type="button" onClick={() => setMode('view')}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50">
                    {tForm('cancelEdit')}
                  </button>
                  <button type="button" onClick={onSave} disabled={saving}
                    className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
                    {tForm('saveAndView')}
                  </button>
                </>
              ) : (
                <button type="button" onClick={onSave} disabled={saving}
                  className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
                  {tForm('createNew')}
                </button>
              )}
            </div>
          </div>
        </section>

        <header className="overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 text-white shadow-2xl shadow-indigo-200">
          <div className="grid gap-6 p-6 lg:grid-cols-[220px_1fr_280px] lg:items-center">
            <PhotoUpload
              photoDataUrl={employee.photoDataUrl}
              fullName={employee.fullName}
              readOnly={readOnly}
              employeeId={employee.id}
              onUpload={(value) => updateEmployee('photoDataUrl', value)}
              onRemove={() => updateEmployee('photoDataUrl', '')}
            />
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">{employee.employeeId || (isNew ? tForm('newBadge') : '—')}</span>
                {employee.contractStatus && (
                  <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-bold text-emerald-950">{employee.contractStatus}</span>
                )}
                {employee.ptkp && (
                  <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-amber-950">PTKP {employee.ptkp}</span>
                )}
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${mode === 'view' ? 'bg-sky-300 text-sky-950' : 'bg-fuchsia-300 text-fuchsia-950'}`}>
                  {mode === 'view' ? tForm('modeView') : isNew ? tForm('modeNew') : tForm('modeEdit')}
                </span>
              </div>
              <div>
                <h2 className="text-4xl font-black tracking-tight">{employee.fullName || tForm('namePlaceholder')}</h2>
                <p className="mt-1 text-lg text-indigo-100">
                  {employee.position}{employee.department ? ` · ${employee.department}` : ''}
                </p>
              </div>
              <div className="grid gap-2 text-sm text-indigo-50 md:grid-cols-3">
                <div>✉ {employee.email || '—'}</div>
                <div>☎ {employee.phone || '—'}</div>
                <div>📍 {employee.workLocation || '—'}</div>
              </div>
            </div>
            <div className="rounded-3xl bg-white/15 p-4 text-center">
              <div className="text-xs uppercase tracking-widest text-indigo-100">Gross Salary</div>
              <div className="mt-1 text-2xl font-black">{money(grossSalary)}</div>
              <div className="mt-1 text-xs text-indigo-100">AI Payroll base data</div>
              <button type="button" onClick={onSave} disabled={readOnly && !isNew || saving}
                className={`mt-4 rounded-2xl px-4 py-2 text-sm font-black shadow-sm ${(readOnly && !isNew) ? 'bg-white/30 text-white/60' : 'bg-white text-indigo-700 hover:bg-indigo-50'} disabled:opacity-60`}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
                {tForm('save')}
              </button>
              {savedMessage && <div className="mt-3 text-xs font-bold text-white">{savedMessage}</div>}
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section emoji="👤" title={tSec('personal')} subtitle="Personal identity & contact profile" colorClass="bg-gradient-to-r from-sky-500 to-cyan-400">
            <div className="grid gap-4 md:grid-cols-2">
              <Field readOnly={readOnly} label="Employee ID" value={employee.employeeId} onChange={(v) => updateEmployee('employeeId', v)} />
              <Field readOnly={readOnly} label="Full Name" value={employee.fullName} onChange={(v) => updateEmployee('fullName', v)} />
              <Field readOnly={readOnly} label="Preferred Name" value={employee.preferredName} onChange={(v) => updateEmployee('preferredName', v)} />
              <SelectField readOnly={readOnly} label="Nationality" value={employee.nationality} onChange={(v) => updateEmployee('nationality', v)} options={['Indonesia', 'Korea', 'Japan', 'China', 'Singapore', 'Other']} />
              <SelectField readOnly={readOnly} label="Gender" value={employee.gender} onChange={(v) => updateEmployee('gender', v)} options={['Male', 'Female']} />
              <Field readOnly={readOnly} label="Date of Birth" type="date" value={employee.dob} onChange={(v) => updateEmployee('dob', v)} />
              <Field readOnly={readOnly} label="Place of Birth" value={employee.placeOfBirth} onChange={(v) => updateEmployee('placeOfBirth', v)} />
              <Field readOnly={readOnly} label="Blood Type" value={employee.bloodType} onChange={(v) => updateEmployee('bloodType', v)} />
              <Field readOnly={readOnly} label="NIK" value={employee.nik} onChange={(v) => updateEmployee('nik', v)} />
              <Field readOnly={readOnly} label="NPWP" value={employee.npwp} onChange={(v) => updateEmployee('npwp', v)} />
              <Field readOnly={readOnly} label="Phone" value={employee.phone} onChange={(v) => updateEmployee('phone', v)} />
              <Field readOnly={readOnly} label="Email" value={employee.email} onChange={(v) => updateEmployee('email', v)} />
              <TextAreaField readOnly={readOnly} label="Address" value={employee.address} onChange={(v) => updateEmployee('address', v)} />
              <div className="grid gap-4">
                <Field readOnly={readOnly} label="Emergency Contact" value={employee.emergencyName} onChange={(v) => updateEmployee('emergencyName', v)} />
                <Field readOnly={readOnly} label="Emergency Phone" value={employee.emergencyPhone} onChange={(v) => updateEmployee('emergencyPhone', v)} />
              </div>
            </div>
                      <ChangeHistoryPanel entries={changesBy('basic')} title={tSec('personalHistory')} />
          </Section>

          <Section emoji="💼" title={tSec('employment')} subtitle="Employment position, department & work status" colorClass="bg-gradient-to-r from-violet-500 to-purple-400">
            <div className="grid gap-4 md:grid-cols-2">
              <Field readOnly={readOnly} label="Position" value={employee.position} onChange={(v) => updateEmployee('position', v)} />
              <Field readOnly={readOnly} label="Department" value={employee.department} onChange={(v) => updateEmployee('department', v)} />
              <Field readOnly={readOnly} label="Work Location" value={employee.workLocation} onChange={(v) => updateEmployee('workLocation', v)} />
              <Field readOnly={readOnly} label="Supervisor" value={employee.supervisor} onChange={(v) => updateEmployee('supervisor', v)} />
              <Field readOnly={readOnly} label="Join Date" type="date" value={employee.joinDate} onChange={(v) => updateEmployee('joinDate', v)} />
              <SelectField readOnly={readOnly} label="Employment Status" value={employee.employmentStatus} onChange={(v) => updateEmployee('employmentStatus', v)} options={['PKWTT', 'PKWT', 'Probation', 'Intern', 'Daily Worker']} />
              <SelectField readOnly={readOnly} label="Contract Status" value={employee.contractStatus} onChange={(v) => updateEmployee('contractStatus', v)} options={['Active', 'Probation', 'Resigned', 'Terminated', 'Suspended']} />
              <Field readOnly={readOnly} label="Probation End" type="date" value={employee.probationEnd} onChange={(v) => updateEmployee('probationEnd', v)} />
            </div>
                      <ChangeHistoryPanel entries={changesBy('employment')} title={tSec('employmentHistory')} />
          </Section>

          <Section emoji="👨‍👩‍👧" title={tSec('familyPtkp')} subtitle="Family members, dependents & tax status" colorClass="bg-gradient-to-r from-rose-500 to-pink-400">
            <div className="mb-4 grid gap-4 md:grid-cols-4">
              <SelectField readOnly={readOnly} label="Marital Status" value={employee.maritalStatus} onChange={(v) => updateEmployee('maritalStatus', v)} options={['Single', 'Married', 'Divorced', 'Widowed']} />
              <SelectField readOnly={readOnly} label="PTKP" value={employee.ptkp} onChange={(v) => updateEmployee('ptkp', v)} options={['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3', 'K/I/0', 'K/I/1', 'K/I/2', 'K/I/3']} />
              <Field readOnly={readOnly} label="Spouse Name" value={employee.spouseName} onChange={(v) => updateEmployee('spouseName', v)} />
              <Field readOnly={readOnly} label="Dependents" value={employee.dependents} onChange={(v) => updateEmployee('dependents', v)} />
            </div>
            <div className="space-y-3">
              {record.family.map((item, i) => (
                <ArrayRow key={`family-${i}`}>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field readOnly={readOnly} label="Relation" value={item.relation} onChange={(v) => updateList<FamilyMember>('family', i, 'relation', v)} />
                    <Field readOnly={readOnly} label="Name" value={item.name} onChange={(v) => updateList<FamilyMember>('family', i, 'name', v)} />
                    <Field readOnly={readOnly} label="DOB" type="date" value={item.dob} onChange={(v) => updateList<FamilyMember>('family', i, 'dob', v)} />
                    <Field readOnly={readOnly} label="NIK" value={item.nik} onChange={(v) => updateList<FamilyMember>('family', i, 'nik', v)} />
                    <Field readOnly={readOnly} label="Occupation" value={item.occupation} onChange={(v) => updateList<FamilyMember>('family', i, 'occupation', v)} />
                    <SelectField readOnly={readOnly} label="Dependent" value={item.dependent} onChange={(v) => updateList<FamilyMember>('family', i, 'dependent', v)} options={['Yes', 'No']} />
                  </div>
                </ArrayRow>
              ))}
              <AddButton hidden={readOnly} onClick={() => addRow<FamilyMember>('family', { relation: 'Child', name: '', dob: '', nik: '', occupation: '', dependent: 'Yes' })}>{tSec('addFamily')}</AddButton>
            </div>
                      <ChangeHistoryPanel entries={changesBy('family_ptkp')} title={tSec('familyHistory')} />
          </Section>

          <Section emoji="🎓" title={tSec('education')} subtitle="Education background" colorClass="bg-gradient-to-r from-emerald-500 to-teal-400">
            <div className="space-y-3">
              {record.education.map((item, i) => (
                <ArrayRow key={`education-${i}`}>
                  <div className="grid gap-3 md:grid-cols-5">
                    <Field readOnly={readOnly} label="Level" value={item.level} onChange={(v) => updateList<EducationEntry>('education', i, 'level', v)} />
                    <Field readOnly={readOnly} label="Major" value={item.major} onChange={(v) => updateList<EducationEntry>('education', i, 'major', v)} />
                    <Field readOnly={readOnly} label="School" value={item.school} onChange={(v) => updateList<EducationEntry>('education', i, 'school', v)} />
                    <Field readOnly={readOnly} label="City" value={item.city} onChange={(v) => updateList<EducationEntry>('education', i, 'city', v)} />
                    <Field readOnly={readOnly} label="Year" value={item.year} onChange={(v) => updateList<EducationEntry>('education', i, 'year', v)} />
                  </div>
                </ArrayRow>
              ))}
              <AddButton hidden={readOnly} onClick={() => addRow<EducationEntry>('education', { level: '', major: '', school: '', city: '', year: '' })}>{tSec('addEducation')}</AddButton>
            </div>
                      <ChangeHistoryPanel entries={changesBy('education')} title={tSec('educationHistory')} />
          </Section>

          <Section emoji="🏢" title={tSec('careerMovement')} subtitle="Career history & internal movement" colorClass="bg-gradient-to-r from-orange-500 to-amber-400">
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-sm font-black text-slate-700">{tSec('previousCareer')}</div>
                <div className="space-y-3">
                  {record.career.map((item, i) => (
                    <ArrayRow key={`career-${i}`}>
                      <div className="grid gap-3 md:grid-cols-4">
                        <Field readOnly={readOnly} label="Period" value={item.period} onChange={(v) => updateList<CareerEntry>('career', i, 'period', v)} />
                        <Field readOnly={readOnly} label="Company" value={item.company} onChange={(v) => updateList<CareerEntry>('career', i, 'company', v)} />
                        <Field readOnly={readOnly} label="Position" value={item.jobTitle} onChange={(v) => updateList<CareerEntry>('career', i, 'jobTitle', v)} />
                        <Field readOnly={readOnly} label="Reason" value={item.reason} onChange={(v) => updateList<CareerEntry>('career', i, 'reason', v)} />
                      </div>
                    </ArrayRow>
                  ))}
                  <AddButton hidden={readOnly} onClick={() => addRow<CareerEntry>('career', { period: '', company: '', jobTitle: '', reason: '' })}>{tSec('addCareer')}</AddButton>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-black text-slate-700">{tSec('departmentMovement')}</div>
                <div className="space-y-3">
                  {record.movements.map((item, i) => (
                    <ArrayRow key={`movement-${i}`}>
                      <div className="grid gap-3 md:grid-cols-4">
                        <Field readOnly={readOnly} label="Date" type="date" value={item.date} onChange={(v) => updateList<MovementEntry>('movements', i, 'date', v)} />
                        <Field readOnly={readOnly} label="From" value={item.previousDept} onChange={(v) => updateList<MovementEntry>('movements', i, 'previousDept', v)} />
                        <Field readOnly={readOnly} label="To" value={item.newDept} onChange={(v) => updateList<MovementEntry>('movements', i, 'newDept', v)} />
                        <Field readOnly={readOnly} label="Reason" value={item.reason} onChange={(v) => updateList<MovementEntry>('movements', i, 'reason', v)} />
                      </div>
                    </ArrayRow>
                  ))}
                  <AddButton hidden={readOnly} onClick={() => addRow<MovementEntry>('movements', { date: '', previousDept: '', newDept: '', reason: '' })}>{tSec('addMovement')}</AddButton>
                </div>
              </div>
            </div>
                      <ChangeHistoryPanel entries={changesBy('career')} title={tSec('careerHistory')} />
          </Section>

          <Section emoji="🏆" title={tSec('promotionReward')} subtitle="Promotion, reward & disciplinary record" colorClass="bg-gradient-to-r from-yellow-500 to-lime-400">
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-sm font-black text-slate-700">{tSec('promotions')}</div>
                <div className="space-y-3">
                  {record.promotions.map((item, i) => (
                    <ArrayRow key={`promotion-${i}`}>
                      <div className="grid gap-3 md:grid-cols-4">
                        <Field readOnly={readOnly} label="Date" type="date" value={item.date} onChange={(v) => updateList<PromotionEntry>('promotions', i, 'date', v)} />
                        <Field readOnly={readOnly} label="From" value={item.previousTitle} onChange={(v) => updateList<PromotionEntry>('promotions', i, 'previousTitle', v)} />
                        <Field readOnly={readOnly} label="To" value={item.newTitle} onChange={(v) => updateList<PromotionEntry>('promotions', i, 'newTitle', v)} />
                        <Field readOnly={readOnly} label="Reason" value={item.reason} onChange={(v) => updateList<PromotionEntry>('promotions', i, 'reason', v)} />
                      </div>
                    </ArrayRow>
                  ))}
                  <AddButton hidden={readOnly} onClick={() => addRow<PromotionEntry>('promotions', { date: '', previousTitle: '', newTitle: '', reason: '' })}>{tSec('addPromotion')}</AddButton>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-black text-slate-700">{tSec('rewards')}</div>
                <div className="space-y-3">
                  {record.rewards.map((item, i) => (
                    <ArrayRow key={`reward-${i}`}>
                      <div className="grid gap-3 md:grid-cols-4">
                        <Field readOnly={readOnly} label="Date" type="date" value={item.date} onChange={(v) => updateList<RewardEntry>('rewards', i, 'date', v)} />
                        <SelectField readOnly={readOnly} label="Type" value={item.type} onChange={(v) => updateList<RewardEntry>('rewards', i, 'type', v)} options={['Reward', 'Warning', 'Penalty', 'Memo']} />
                        <Field readOnly={readOnly} label="Title" value={item.title} onChange={(v) => updateList<RewardEntry>('rewards', i, 'title', v)} />
                        <Field readOnly={readOnly} label="Note" value={item.note} onChange={(v) => updateList<RewardEntry>('rewards', i, 'note', v)} />
                      </div>
                    </ArrayRow>
                  ))}
                  <AddButton hidden={readOnly} onClick={() => addRow<RewardEntry>('rewards', { date: '', type: 'Reward', title: '', note: '' })}>{tSec('addReward')}</AddButton>
                </div>
              </div>
            </div>
                      <ChangeHistoryPanel entries={changesBy('rewards')} title={tSec('promotionHistory')} />
          </Section>

          <Section emoji="💰" title={tSec('payroll')} subtitle="Payroll base data for AI Payroll" colorClass="bg-gradient-to-r from-indigo-500 to-blue-400">
            <div className="grid gap-4 md:grid-cols-2">
              <Field readOnly={readOnly} label="Basic Salary" value={employee.basicSalary} onChange={(v) => updateEmployee('basicSalary', v)} />
              <Field readOnly={readOnly} label="Transport Allowance" value={employee.transportAllowance} onChange={(v) => updateEmployee('transportAllowance', v)} />
              <Field readOnly={readOnly} label="Meal Allowance" value={employee.mealAllowance} onChange={(v) => updateEmployee('mealAllowance', v)} />
              <Field readOnly={readOnly} label="Position Allowance" value={employee.positionAllowance} onChange={(v) => updateEmployee('positionAllowance', v)} />
              <Field readOnly={readOnly} label="Other Allowance" value={employee.otherAllowance} onChange={(v) => updateEmployee('otherAllowance', v)} />
              <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 p-4 text-white shadow-lg">
                <div className="text-xs uppercase tracking-widest text-blue-100">Gross Salary</div>
                <div className="text-2xl font-black">{money(grossSalary)}</div>
              </div>
            </div>
                      <ChangeHistoryPanel entries={changesBy('payroll')} title={tSec('payrollHistory')} />
          </Section>

          <Section emoji="🛡️" title={tSec('taxBpjs')} subtitle="PPh21, NPWP, BPJS & insurance data" colorClass="bg-gradient-to-r from-cyan-500 to-blue-400">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField readOnly={readOnly} label="PPh21 Method" value={employee.pph21Method} onChange={(v) => updateEmployee('pph21Method', v)} options={['Gross', 'Gross-up', 'Nett']} />
              <Field readOnly={readOnly} label="PTKP" value={employee.ptkp} onChange={(v) => updateEmployee('ptkp', v)} />
              <SelectField readOnly={readOnly} label="BPJS Kesehatan" value={employee.bpjsKesehatan} onChange={(v) => updateEmployee('bpjsKesehatan', v)} options={['Active', 'Inactive', 'Not Registered']} />
              <Field readOnly={readOnly} label="BPJS Kesehatan No." value={employee.bpjsKesehatanNo} onChange={(v) => updateEmployee('bpjsKesehatanNo', v)} />
              <SelectField readOnly={readOnly} label="BPJS Ketenagakerjaan" value={employee.bpjsTk} onChange={(v) => updateEmployee('bpjsTk', v)} options={['Active', 'Inactive', 'Not Registered']} />
              <Field readOnly={readOnly} label="BPJS TK No." value={employee.bpjsTkNo} onChange={(v) => updateEmployee('bpjsTkNo', v)} />
              <Field readOnly={readOnly} label="Private Insurance" value={employee.privateInsurance} onChange={(v) => updateEmployee('privateInsurance', v)} />
            </div>
                      <ChangeHistoryPanel entries={changesBy('tax_bpjs')} title={tSec('taxBpjsHistory')} />
          </Section>

          <Section emoji="🏦" title={tSec('bank')} subtitle="Salary payment bank account" colorClass="bg-gradient-to-r from-slate-700 to-slate-500">
            <div className="grid gap-4 md:grid-cols-3">
              <Field readOnly={readOnly} label="Bank Name" value={employee.bankName} onChange={(v) => updateEmployee('bankName', v)} />
              <Field readOnly={readOnly} label="Account Number" value={employee.bankAccount} onChange={(v) => updateEmployee('bankAccount', v)} />
              <Field readOnly={readOnly} label="Account Holder" value={employee.bankHolder} onChange={(v) => updateEmployee('bankHolder', v)} />
            </div>
                      <ChangeHistoryPanel entries={changesBy('bank')} title={tSec('bankHistory')} />
          </Section>

          <Section emoji="📄" title={tSec('contract')} subtitle="Employment contract control" colorClass="bg-gradient-to-r from-fuchsia-500 to-purple-400">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField readOnly={readOnly} label="Contract Type" value={employee.contractType} onChange={(v) => updateEmployee('contractType', v)} options={['PKWTT', 'PKWT', 'Internship', 'Consultant', 'Daily Worker']} />
              <SelectField readOnly={readOnly} label="Contract Status" value={employee.contractStatus} onChange={(v) => updateEmployee('contractStatus', v)} options={['Active', 'Probation', 'Expired', 'Resigned', 'Terminated']} />
              <Field readOnly={readOnly} label="Contract Start" type="date" value={employee.contractStart} onChange={(v) => updateEmployee('contractStart', v)} />
              <Field readOnly={readOnly} label="Contract End" type="date" value={employee.contractEnd} onChange={(v) => updateEmployee('contractEnd', v)} />
            </div>
                      <ChangeHistoryPanel entries={changesBy('contract')} title={tSec('contractHistory')} />
          </Section>

          <Section emoji="✈️" title={tSec('expat')} subtitle="Optional expat data for work permit & tax residency" colorClass="bg-gradient-to-r from-red-500 to-orange-400">
            <div className="grid gap-4 md:grid-cols-2">
              <Field readOnly={readOnly} label="Passport No." value={employee.passportNo} onChange={(v) => updateEmployee('passportNo', v)} />
              <Field readOnly={readOnly} label="KITAS / KITAP No." value={employee.kitasNo} onChange={(v) => updateEmployee('kitasNo', v)} />
              <Field readOnly={readOnly} label="Work Permit Expiry" type="date" value={employee.workPermitExpiry} onChange={(v) => updateEmployee('workPermitExpiry', v)} />
              <SelectField readOnly={readOnly} label="Tax Residency" value={employee.taxResidency} onChange={(v) => updateEmployee('taxResidency', v)} options={['Indonesia Tax Resident', 'Non-Resident', 'To be reviewed']} />
            </div>
                      <ChangeHistoryPanel entries={changesBy('expat')} title={tSec('expatHistory')} />
          </Section>
        </div>

        <Section emoji="📝" title={tSec('notes')} subtitle="Internal HR notes" colorClass="bg-gradient-to-r from-indigo-600 to-fuchsia-500">
          <TextAreaField readOnly={readOnly} label="Notes" value={employee.notes} onChange={(v) => updateEmployee('notes', v)} />
        </Section>

        <Section emoji="🗂" title={tSec('allHistory')} subtitle="Full change history" colorClass="bg-gradient-to-r from-slate-800 to-slate-600">
          <ChangeHistoryPanel entries={changes} title={tSec('allHistory')} />
        </Section>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level component — handles screen switching, search, fetch, save.
// ─────────────────────────────────────────────────────────────────────────────
export default function EmployeeHrRecord() {
  const t = useTranslations('employeeHr');
  const {
    customerId,
    isConsultant,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    isSessionLoading: sessionLoading,
  } = useEffectiveCustomerId({ companyOnly: true });

  const [screen, setScreen] = useState<'search' | 'detail'>('search');
  const [searchBy, setSearchBy] = useState<'ID' | 'NAME'>('ID');
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<UiRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const [record, setRecord] = useState<UiRecord>(emptyRecord);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [isNew, setIsNew] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<ChangeLogEntry[]>([]);

  // Pull change history whenever a non-new employee detail is opened (or after save).
  useEffect(() => {
    const empId = record.employee.id;
    if (screen !== 'detail' || !empId || isNew) {
      setChanges([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/tax/employees/${empId}/changes`);
        const json = await res.json();
        if (json.success) setChanges(json.data as ChangeLogEntry[]);
      } catch { /* ignore */ }
    })();
  }, [screen, record.employee.id, isNew, refreshTick]);

  // Search effect — runs on keyword/searchBy change (debounced).
  useEffect(() => {
    if (!customerId) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ customerId });
        if (keyword.trim()) {
          params.set('searchBy', searchBy);
          params.set('keyword', keyword.trim());
        }
        const res = await fetch(`/api/tax/employees?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          const list: EmployeeRow[] = json.data?.employees ?? [];
          setResults(list.map(rowToUi));
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [customerId, keyword, searchBy, refreshTick]);

  const openDetail = async (rec: UiRecord, m: 'view' | 'edit') => {
    setIsNew(false);
    setSavedMessage('');
    if (rec.employee.id) {
      // Pull fresh detail to make sure JSONB sub-records are populated.
      try {
        const [detailRes, photoRes] = await Promise.all([
          fetch(`/api/tax/employees/${rec.employee.id}`),
          fetch(`/api/tax/employees/${rec.employee.id}/photo/sign`),
        ]);
        const detailJson = await detailRes.json();
        const photoJson = await photoRes.json().catch(() => null);
        if (detailJson.success && detailJson.data) {
          const ui = rowToUi(detailJson.data as EmployeeRow);
          // Swap stored storage path → signed URL so <img> renders correctly.
          if (photoJson?.data?.signedUrl) {
            ui.employee.photoDataUrl = photoJson.data.signedUrl;
          } else if (ui.employee.photoDataUrl && !ui.employee.photoDataUrl.startsWith('data:') && !ui.employee.photoDataUrl.startsWith('http')) {
            // path stored but no signed URL → blank
            ui.employee.photoDataUrl = '';
          }
          setRecord(ui);
        } else {
          setRecord(rec);
        }
      } catch {
        setRecord(rec);
      }
    } else {
      setRecord(rec);
    }
    setMode(m);
    setScreen('detail');
  };

  const openNew = () => {
    setIsNew(true);
    setMode('edit');
    setRecord(emptyRecord());
    setSavedMessage('');
    setScreen('detail');
  };

  const saveRecord = async () => {
    if (!customerId) return;
    if (!record.employee.fullName.trim()) {
      setSavedMessage(t('messages.fullNameRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/tax/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uiToApi(record, customerId)),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSavedMessage(json.error || t('messages.saveFailed'));
      } else {
        const saved = rowToUi(json.data as EmployeeRow);
        setRecord(saved);
        setIsNew(false);
        setMode('view');
        setSavedMessage(
          t('messages.saveSuccess', { name: saved.employee.employeeId || saved.employee.fullName }),
        );
        setRefreshTick((tick) => tick + 1);
      }
    } catch (e) {
      setSavedMessage(e instanceof Error ? e.message : t('messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    setScreen('search');
    setIsNew(false);
    setSavedMessage('');
  };

  // Only show the spinner while the session is genuinely loading. Once the
  // session is resolved we either render the customer picker (consultant) or
  // fall through to the screen (CUSTOMER with a real customerId).
  if (sessionLoading) {
    return (
      <div className="container mx-auto py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
        <p className="text-sm text-slate-500 mt-3">{t('messages.sessionLoading')}</p>
      </div>
    );
  }

  if (isConsultant && !customerId) {
    return (
      <div className="container mx-auto py-12 px-4 max-w-md text-center">
        <p className="text-sm text-slate-600 mb-3">
          {customers.length === 0 ? t('messages.noAssignedCustomers') : t('messages.selectCustomer')}
        </p>
        {customers.length > 0 && (
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">— {t('messages.selectCustomer')} —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name || c.full_name}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  if (!customerId) {
    return (
      <div className="container mx-auto py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
        <p className="text-sm text-slate-500 mt-3">{t('messages.sessionLoading')}</p>
      </div>
    );
  }

  // Consultant-only customer picker shown above the search box so the
  // consultant can swap between assigned COMPANY customers without leaving
  // the page. CUSTOMER role gets `null` and the section is skipped entirely.
  const customerPicker = isConsultant && customers.length > 0 ? (
    <section className="rounded-3xl bg-white p-5 shadow-xl shadow-slate-200/70">
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
          {t('messages.customerLabel')}
        </span>
        <select
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name || c.full_name}
            </option>
          ))}
        </select>
      </label>
    </section>
  ) : null;

  if (screen === 'search') {
    return (
      <SearchScreen
        searchBy={searchBy}
        setSearchBy={setSearchBy}
        keyword={keyword}
        setKeyword={setKeyword}
        results={results}
        openDetail={openDetail}
        openNew={openNew}
        loading={loading}
        customerId={customerId}
        onImported={() => setRefreshTick((t) => t + 1)}
        customerPicker={customerPicker}
      />
    );
  }

  return (
    <DetailScreen
      record={record}
      setRecord={setRecord}
      mode={mode}
      setMode={setMode}
      goBack={goBack}
      onSave={saveRecord}
      isNew={isNew}
      savedMessage={savedMessage}
      saving={saving}
      changes={changes}
    />
  );
}
