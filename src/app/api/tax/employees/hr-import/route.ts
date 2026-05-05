import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * POST /api/tax/employees/hr-import
 *
 * Bulk-import HR master records (Employee Master / 인사기록).
 * Accepts FormData: { file: CSV|XLSX|JSON, customerId }.
 *
 * Targets the AI Payroll HR layout (sample_employee_import.csv, 30 cols):
 *   Employee ID, Full Name, Preferred Name, Nationality, Gender,
 *   Date of Birth, NIK, NPWP, Phone, Email, Department, Position,
 *   Work Location, Join Date, Employment Status, PTKP, Basic Salary,
 *   Transport Allowance, Meal Allowance, Position Allowance,
 *   PPh21 Method, Bank Name, Bank Account, Account Holder,
 *   BPJS Kesehatan No, BPJS TK No, Contract Type, Contract Start,
 *   Passport No, KITAS
 *
 * Headers are matched case- and underscore-insensitive via the keyword
 * dictionary below, so customer-supplied templates with slightly different
 * column names ("Tanggal Lahir" → birth_date, "기본급" → basic_salary, …)
 * still resolve. Rows are upserted by (customer_id, employee_number) when
 * an Employee ID is present, otherwise by (customer_id, employee_name).
 */

type FieldKey =
  | 'employee_number' | 'employee_name' | 'preferred_name'
  | 'nationality' | 'gender' | 'birth_date'
  | 'employee_nik' | 'employee_npwp' | 'phone' | 'email'
  | 'department' | 'position' | 'work_location' | 'supervisor'
  | 'hire_date' | 'employment_status' | 'contract_status'
  | 'ptkp_category' | 'spouse_name' | 'dependents'
  | 'basic_salary' | 'transport_allowance' | 'meal_allowance'
  | 'position_allowance' | 'other_allowance'
  | 'pph21_method'
  | 'bank_name' | 'bank_account_no' | 'bank_account_name'
  | 'bpjs_kesehatan' | 'bpjs_kesehatan_no' | 'bpjs_tk' | 'bpjs_tk_no'
  | 'private_insurance'
  | 'contract_type' | 'contract_start_date' | 'contract_end_date'
  | 'passport_no' | 'kitas_no' | 'work_permit_expiry' | 'tax_residency'
  | 'place_of_birth' | 'blood_type' | 'marital_status'
  | 'address' | 'emergency_contact_name' | 'emergency_contact_phone'
  | 'notes';

const NUMERIC_FIELDS: ReadonlySet<FieldKey> = new Set<FieldKey>([
  'basic_salary', 'transport_allowance', 'meal_allowance',
  'position_allowance', 'other_allowance',
]);
const DATE_FIELDS: ReadonlySet<FieldKey> = new Set<FieldKey>([
  'birth_date', 'hire_date', 'contract_start_date', 'contract_end_date', 'work_permit_expiry',
]);

// Map of FieldKey → keywords. We compare on the canonical form (lowercase,
// underscores stripped, korean kept). The first matched row wins.
const FIELD_KEYWORDS: Record<FieldKey, string[]> = {
  employee_number: ['employeeid', 'empid', 'employeenumber', 'employee_no', 'no직원', '사번', 'staffid'],
  employee_name: ['fullname', 'employeename', 'name', 'namalengkap', '이름', '직원명'],
  preferred_name: ['preferredname', 'nickname', 'displayname', 'aliasname'],
  nationality: ['nationality', 'kewarganegaraan', '국적'],
  gender: ['gender', 'jeniskelamin', 'sex', '성별'],
  birth_date: ['dateofbirth', 'birthdate', 'dob', 'tanggallahir', '생년월일', '생일'],
  employee_nik: ['nik', 'ktp'],
  employee_npwp: ['npwp', 'taxid'],
  phone: ['phone', 'telephone', 'mobile', 'nohp', 'telepon', '전화', '휴대폰'],
  email: ['email', 'emailaddress', '이메일'],
  department: ['department', 'departemen', '부서', 'team', 'div'],
  position: ['position', 'jobtitle', 'jabatan', '직책', '직급'],
  work_location: ['worklocation', 'office', 'lokasikerja', 'kantor', '근무지', '사무실'],
  supervisor: ['supervisor', 'manager', 'atasan', '상사'],
  hire_date: ['joindate', 'hiredate', 'tanggalmasuk', '입사일'],
  employment_status: ['employmentstatus', 'statuskaryawan', 'workerstatus'],
  contract_status: ['contractstatus', 'statuskontrak'],
  ptkp_category: ['ptkp', 'ptkpcategory', 'ptkp_status', 'ptkpstatus'],
  spouse_name: ['spousename', 'namasuami', 'namaistri', '배우자'],
  dependents: ['dependents', 'tanggungan', '부양가족'],
  basic_salary: ['basicsalary', 'gajipokok', 'gapok', '기본급', 'basesalary'],
  transport_allowance: ['transportallowance', 'tunjangantransport', '교통비'],
  meal_allowance: ['mealallowance', 'tunjanganmakan', '식대'],
  position_allowance: ['positionallowance', 'tunjanganjabatan', '직책수당'],
  other_allowance: ['otherallowance', 'lainnya', '기타수당'],
  pph21_method: ['pph21method', 'pph21metode', 'metodepph21'],
  bank_name: ['bankname', 'namabank', '은행'],
  bank_account_no: ['bankaccount', 'accountnumber', 'rekening', 'norekening', '계좌번호'],
  bank_account_name: ['accountholder', 'namaakun', 'pemilikrekening', '예금주'],
  bpjs_kesehatan: ['bpjskesehatan', 'kesehatan', 'bpjshealth'],
  bpjs_kesehatan_no: ['bpjskesehatanno', 'kesehatanno', 'bpjshealthno'],
  bpjs_tk: ['bpjsketenagakerjaan', 'bpjstk', 'ketenagakerjaan'],
  bpjs_tk_no: ['bpjstkno', 'tkno', 'bpjsketenagakerjaanno'],
  private_insurance: ['privateinsurance', 'asuransiprivate', 'asuransi'],
  contract_type: ['contracttype', 'jeniskontrak', '계약유형'],
  contract_start_date: ['contractstart', 'mulaikontrak', 'startkontrak'],
  contract_end_date: ['contractend', 'akhirkontrak', 'endkontrak'],
  passport_no: ['passportno', 'passport', '여권'],
  kitas_no: ['kitas', 'kitap', 'kitasno', 'kitapno'],
  work_permit_expiry: ['workpermitexpiry', 'workpermit', 'imta'],
  tax_residency: ['taxresidency', 'residency'],
  place_of_birth: ['placeofbirth', 'tempatlahir', '출생지'],
  blood_type: ['bloodtype', 'golongandarah', '혈액형'],
  marital_status: ['maritalstatus', 'statuspernikahan', '결혼여부'],
  address: ['address', 'alamat', '주소'],
  emergency_contact_name: ['emergencyname', 'emergencycontact', 'kontakdarurat'],
  emergency_contact_phone: ['emergencyphone'],
  notes: ['notes', 'note', 'remark', 'memo', '비고', '메모'],
};

const canonicalize = (s: string) => s.replace(/[\s_\-./]/g, '').toLowerCase();

function buildHeaderMap(headers: string[]): Map<number, FieldKey> {
  const taken = new Set<FieldKey>();
  const map = new Map<number, FieldKey>();
  const canon = headers.map(canonicalize);
  for (let i = 0; i < canon.length; i++) {
    const h = canon[i];
    if (!h) continue;
    let bestField: FieldKey | null = null;
    let bestScore = 0;
    for (const [field, keywords] of Object.entries(FIELD_KEYWORDS) as [FieldKey, string[]][]) {
      if (taken.has(field)) continue;
      for (const kw of keywords) {
        const ck = canonicalize(kw);
        if (h === ck) { bestField = field; bestScore = 3; break; }
        if (h.includes(ck) || ck.includes(h)) {
          if (bestScore < 2) { bestField = field; bestScore = 2; }
        }
      }
      if (bestScore === 3) break;
    }
    if (bestField) {
      map.set(i, bestField);
      taken.add(bestField);
    }
  }
  return map;
}

// Parse YYYY-MM-DD or DD/MM/YYYY or M/D/YYYY → YYYY-MM-DD; numeric Excel serials
// (rare but possible) are not handled here — XLSX returns parsed dates as JS Date objects.
function normalizeDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    const yyyy = raw.getFullYear();
    const mm = String(raw.getMonth() + 1).padStart(2, '0');
    const dd = String(raw.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const [y, m, d] = s.split(/[-T]/);
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, d, mm, y] = m;  // assume DD/MM/YYYY (Indonesian/Korean convention)
    return `${y}-${mm.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function normalizeNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw).replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

interface ImportSummary {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  unmappedHeaders: string[];
  mappedHeaders: { column: string; field: FieldKey }[];
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const customerId = formData.get('customerId') as string;

  if (!file || !customerId) {
    return NextResponse.json({ error: 'file and customerId required' }, { status: 400 });
  }

  // Decode → 2-D matrix [headers, ...rows]
  const buffer = Buffer.from(await file.arrayBuffer());
  let rows: unknown[][] = [];
  const fileName = file.name.toLowerCase();

  try {
    if (fileName.endsWith('.json')) {
      // JSON: array of objects → infer headers from first object
      const txt = buffer.toString('utf8');
      const arr: Array<Record<string, unknown>> = JSON.parse(txt);
      if (!Array.isArray(arr) || arr.length === 0) {
        return NextResponse.json({ error: 'JSON must be a non-empty array of objects' }, { status: 400 });
      }
      const headers = Object.keys(arr[0]);
      rows = [headers, ...arr.map(o => headers.map(h => o[h]))];
    } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
      // CSV: decode as UTF-8 explicitly, strip BOM, then let xlsx parse from
      // the decoded string. Passing the raw buffer makes xlsx fall back to
      // cp1252, which mojibake-s any non-Latin headers (한글/中文/etc).
      let txt = buffer.toString('utf8');
      if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
      const wb = XLSX.read(txt, { type: 'string', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
    } else {
      // XLSX/XLS binary — UTF-16 internally, no encoding ambiguity.
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to parse file' },
      { status: 400 },
    );
  }

  if (rows.length < 2) {
    return NextResponse.json({ error: '데이터가 없습니다 (헤더 + 1행 이상 필요).' }, { status: 400 });
  }

  const headers = rows[0].map(h => String(h ?? '').trim());
  const headerMap = buildHeaderMap(headers);

  const mappedHeaders: { column: string; field: FieldKey }[] = [];
  const unmappedHeaders: string[] = [];
  headers.forEach((h, i) => {
    const f = headerMap.get(i);
    if (f) mappedHeaders.push({ column: h, field: f });
    else if (h) unmappedHeaders.push(h);
  });

  // Required: at least full_name OR employee_number. We also need at least one
  // of those mapped to insert anything meaningful.
  const hasName = mappedHeaders.some(m => m.field === 'employee_name');
  const hasId = mappedHeaders.some(m => m.field === 'employee_number');
  if (!hasName && !hasId) {
    return NextResponse.json(
      {
        error: '직원 식별 컬럼을 찾을 수 없습니다. "Employee ID" 또는 "Full Name" 중 하나는 필요합니다.',
        data: { mappedHeaders, unmappedHeaders, headers },
      },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const summary: ImportSummary = {
    totalRows: rows.length - 1,
    imported: 0, updated: 0, skipped: 0,
    errors: [], unmappedHeaders, mappedHeaders,
  };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const isAllEmpty = row.every(v => v === '' || v == null);
    if (isAllEmpty) { summary.skipped++; continue; }

    const record: Record<string, unknown> = { customer_id: customerId, is_active: true };
    for (const [idx, field] of headerMap.entries()) {
      const raw = row[idx];
      if (raw === '' || raw == null) continue;
      if (NUMERIC_FIELDS.has(field)) {
        const n = normalizeNumber(raw);
        if (n != null) record[field] = n;
      } else if (DATE_FIELDS.has(field)) {
        const d = normalizeDate(raw);
        if (d) record[field] = d;
      } else {
        record[field] = String(raw).trim();
      }
    }

    // Compute gross_salary from components (if not explicitly mapped).
    const basic = Number(record.basic_salary || 0);
    const transport = Number(record.transport_allowance || 0);
    const meal = Number(record.meal_allowance || 0);
    const pos = Number(record.position_allowance || 0);
    const other = Number(record.other_allowance || 0);
    const computedGross = basic + transport + meal + pos + other;
    if (computedGross > 0) record.gross_salary = computedGross;

    // worker_type default
    record.worker_type = record.worker_type || 'REGULAR';
    // ptkp_category default
    if (!record.ptkp_category) record.ptkp_category = 'TK0';

    const empName = String(record.employee_name || '').trim();
    const empNumber = String(record.employee_number || '').trim();
    if (!empName && !empNumber) {
      summary.errors.push({ row: r + 1, message: '이름/사번 모두 비어있음' });
      summary.skipped++;
      continue;
    }

    try {
      // Upsert priority: employee_number > employee_name (within customer)
      let existingId: string | null = null;
      if (empNumber) {
        const { data } = await admin
          .from('employee_payroll')
          .select('id')
          .eq('customer_id', customerId)
          .eq('employee_number', empNumber)
          .eq('is_active', true)
          .maybeSingle();
        existingId = data?.id ?? null;
      }
      if (!existingId && empName) {
        const { data } = await admin
          .from('employee_payroll')
          .select('id')
          .eq('customer_id', customerId)
          .eq('employee_name', empName)
          .eq('is_active', true)
          .maybeSingle();
        existingId = data?.id ?? null;
      }

      if (existingId) {
        const { error } = await admin.from('employee_payroll').update(record).eq('id', existingId);
        if (error) {
          summary.errors.push({ row: r + 1, message: error.message });
          summary.skipped++;
        } else {
          summary.updated++;
        }
      } else {
        // employee_name is required by check_constraints (NOT NULL); fall back to ID if name absent.
        if (!record.employee_name) record.employee_name = empNumber;
        const { error } = await admin.from('employee_payroll').insert(record);
        if (error) {
          summary.errors.push({ row: r + 1, message: error.message });
          summary.skipped++;
        } else {
          summary.imported++;
        }
      }
    } catch (e) {
      summary.errors.push({ row: r + 1, message: e instanceof Error ? e.message : 'unknown' });
      summary.skipped++;
    }
  }

  loggers.api.info(
    {
      customerId,
      total: summary.totalRows,
      imported: summary.imported,
      updated: summary.updated,
      skipped: summary.skipped,
      errors: summary.errors.length,
    },
    'HR import completed',
  );

  return NextResponse.json({
    success: true,
    data: summary,
    message: `신규 ${summary.imported}명, 갱신 ${summary.updated}명, 스킵 ${summary.skipped}명`,
  });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(
    request as RequestWithSession,
    handlePost,
  );
}
