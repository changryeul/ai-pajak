/**
 * Field → section mapping + diff helper for employee_payroll change logs.
 * The Employee Master UI renders 12 sections; we tag each changed field with
 * its section so each panel ("기본정보 변경 이력", "고용정보 변경 이력", …)
 * can filter the same log table.
 */

export type EmployeeSection =
  | 'basic'
  | 'employment'
  | 'family_ptkp'
  | 'education'
  | 'career'
  | 'movements'
  | 'promotions'
  | 'rewards'
  | 'payroll'
  | 'tax_bpjs'
  | 'bank'
  | 'contract'
  | 'expat'
  | 'notes'
  | 'employee';

const FIELD_SECTION: Record<string, EmployeeSection> = {
  // Basic identity & contact
  employee_name: 'basic',
  preferred_name: 'basic',
  employee_number: 'basic',
  nationality: 'basic',
  gender: 'basic',
  birth_date: 'basic',
  place_of_birth: 'basic',
  blood_type: 'basic',
  employee_nik: 'basic',
  employee_npwp: 'basic',
  phone: 'basic',
  email: 'basic',
  address: 'basic',
  emergency_contact_name: 'basic',
  emergency_contact_phone: 'basic',
  photo_url: 'basic',

  // Employment
  position: 'employment',
  department: 'employment',
  work_location: 'employment',
  supervisor: 'employment',
  hire_date: 'employment',
  resign_date: 'employment',
  employment_status: 'employment',
  contract_status: 'employment',
  probation_end: 'employment',
  worker_type: 'employment',

  // Family / PTKP
  marital_status: 'family_ptkp',
  ptkp_category: 'family_ptkp',
  spouse_name: 'family_ptkp',
  dependents: 'family_ptkp',
  family: 'family_ptkp',

  // JSONB sub-records keyed to their own section
  education: 'education',
  career: 'career',
  movements: 'movements',
  promotions: 'promotions',
  rewards: 'rewards',

  // Payroll
  basic_salary: 'payroll',
  transport_allowance: 'payroll',
  meal_allowance: 'payroll',
  position_allowance: 'payroll',
  other_allowance: 'payroll',
  gross_salary: 'payroll',
  jht_employee: 'payroll',
  jp_employee: 'payroll',
  other_deductions: 'payroll',

  // Tax / BPJS
  pph21_method: 'tax_bpjs',
  bpjs_kesehatan: 'tax_bpjs',
  bpjs_kesehatan_no: 'tax_bpjs',
  bpjs_tk: 'tax_bpjs',
  bpjs_tk_no: 'tax_bpjs',
  private_insurance: 'tax_bpjs',

  // Bank
  bank_name: 'bank',
  bank_account_no: 'bank',
  bank_account_name: 'bank',

  // Contract
  contract_type: 'contract',
  contract_start_date: 'contract',
  contract_end_date: 'contract',

  // Expat
  passport_no: 'expat',
  kitas_no: 'expat',
  work_permit_expiry: 'expat',
  tax_residency: 'expat',

  // Notes
  notes: 'notes',
};

const ALL_TRACKED_FIELDS = Object.keys(FIELD_SECTION);

const stringify = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  // JSON for arrays / objects (so we can compare and surface a "data updated" entry).
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const equal = (a: unknown, b: unknown): boolean => stringify(a) === stringify(b);

export interface EmployeeChangeEntry {
  section: EmployeeSection;
  field: string;
  old_value: string | null;
  new_value: string | null;
}

/**
 * Compare an existing employee row to its incoming patch (post-merge) and
 * return one EmployeeChangeEntry per field that actually changed.
 *
 * `previous` is the raw row we read back from the DB before applying the
 * update; `next` is the merged record we are about to write.
 */
export function diffEmployee(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown>,
): EmployeeChangeEntry[] {
  if (!previous) {
    // First-time registration — single marker row.
    return [{
      section: 'employee',
      field: 'Employee Record',
      old_value: null,
      new_value: '신규 등록',
    }];
  }

  const entries: EmployeeChangeEntry[] = [];
  for (const field of ALL_TRACKED_FIELDS) {
    if (!(field in next)) continue; // caller didn't include this field, leave it alone
    const oldVal = previous[field];
    const newVal = next[field];
    if (equal(oldVal, newVal)) continue;
    entries.push({
      section: FIELD_SECTION[field],
      field,
      old_value: stringify(oldVal),
      new_value: stringify(newVal),
    });
  }
  return entries;
}
