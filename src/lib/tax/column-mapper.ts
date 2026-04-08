/**
 * Auto Column Mapper for Employee Payroll Import
 *
 * Maps customer Excel column headers (Indonesian/English/Korean)
 * to internal field names using fuzzy keyword matching.
 */

export interface ColumnMapping {
  sourceColumn: string;   // Customer's original header
  targetField: string;    // Our internal field name
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

export const TARGET_FIELDS = [
  { field: 'employee_name', label: '직원명', required: true },
  { field: 'employee_npwp', label: 'NPWP', required: false },
  { field: 'employee_nik', label: 'NIK', required: false },
  { field: 'ptkp_category', label: 'PTKP', required: false },
  { field: 'gross_salary', label: '기본급', required: true },
  { field: 'position_allowance', label: '직책수당', required: false },
  { field: 'overtime_pay', label: '초과근무', required: false },
  { field: 'meal_allowance', label: '식대', required: false },
  { field: 'transport_allowance', label: '교통비', required: false },
  { field: 'other_allowances', label: '기타수당', required: false },
  { field: 'bonus', label: '보너스', required: false },
  { field: 'thr', label: 'THR', required: false },
  { field: 'jht_employee', label: 'JHT', required: false },
  { field: 'jp_employee', label: 'JP', required: false },
  { field: 'bpjs_kesehatan', label: 'BPJS KES', required: false },
  { field: 'other_deductions', label: '기타공제', required: false },
  { field: 'worker_type', label: '직원유형', required: false },
];

// Keyword → field mapping (multilingual)
const KEYWORD_MAP: Record<string, string[]> = {
  employee_name: ['nama', 'name', 'karyawan', 'pegawai', '이름', '직원명', 'employee', 'staff'],
  employee_npwp: ['npwp', 'tax_id', 'tax id', '세금번호'],
  employee_nik: ['nik', 'ktp', 'id number', '주민번호'],
  ptkp_category: ['ptkp', 'status', 'tax status', '과세상태'],
  gross_salary: ['gaji', 'salary', 'basic', 'pokok', 'base', '기본급', '급여', 'gapok', 'gross'],
  position_allowance: ['jabatan', 'position', 'tunjangan jabatan', '직책', '직책수당'],
  overtime_pay: ['lembur', 'overtime', '초과근무', '잔업'],
  meal_allowance: ['makan', 'meal', '식대', '식비', 'uang makan'],
  transport_allowance: ['transport', 'transportasi', '교통', '교통비'],
  other_allowances: ['tunjangan lain', 'other allowance', '기타수당', 'allowance'],
  bonus: ['bonus', '보너스', 'insentif', 'incentive'],
  thr: ['thr', 'hari raya', '명절'],
  jht_employee: ['jht', 'hari tua', '퇴직적립'],
  jp_employee: ['jp', 'pensiun', 'pension', '연금'],
  bpjs_kesehatan: ['bpjs', 'kesehatan', 'health', '건강보험'],
  other_deductions: ['potongan', 'deduction', '공제', '기타공제'],
  worker_type: ['type', 'tipe', 'jenis', '유형', 'worker', 'status karyawan'],
};

/**
 * Auto-map source columns to target fields
 */
export function autoMapColumns(sourceHeaders: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const usedTargets = new Set<string>();

  for (const header of sourceHeaders) {
    const lower = header.toLowerCase().trim();
    let bestMatch: { field: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } | null = null;

    // Exact match first
    for (const [field, keywords] of Object.entries(KEYWORD_MAP)) {
      if (usedTargets.has(field)) continue;
      if (keywords.some(kw => lower === kw)) {
        bestMatch = { field, confidence: 'HIGH' };
        break;
      }
    }

    // Partial match
    if (!bestMatch) {
      for (const [field, keywords] of Object.entries(KEYWORD_MAP)) {
        if (usedTargets.has(field)) continue;
        if (keywords.some(kw => lower.includes(kw) || kw.includes(lower))) {
          bestMatch = { field, confidence: 'MEDIUM' };
          break;
        }
      }
    }

    if (bestMatch) {
      mappings.push({ sourceColumn: header, targetField: bestMatch.field, confidence: bestMatch.confidence });
      usedTargets.add(bestMatch.field);
    } else {
      mappings.push({ sourceColumn: header, targetField: '', confidence: 'NONE' });
    }
  }

  return mappings;
}

/**
 * Apply mapping to convert source rows to target format
 */
export function applyMapping(
  rows: string[][],
  headers: string[],
  mappings: ColumnMapping[]
): Array<Record<string, string>> {
  return rows.map(row => {
    const result: Record<string, string> = {};
    mappings.forEach(m => {
      if (m.targetField) {
        const idx = headers.indexOf(m.sourceColumn);
        if (idx >= 0) {
          result[m.targetField] = (row[idx] || '').replace(/['"]/g, '').trim();
        }
      }
    });
    return result;
  });
}
