/**
 * JTC PPh21 Salary Template parser — 24 column xlsx.
 *
 * Source: `1. (JAKARTA TAX CONSULTING)_TEMPLATE-SALARY_One Sheet.xlsx`
 * Static fixture: `public/templates/pph21-salary-template-jtc.xlsx`
 *
 * Sheet `PEGAWAI TETAP` layout:
 *   row 0  — main headers (A..X)
 *   row 1  — section divider (PENAMBAH / PENGURANG band labels under cols N..W)
 *   row 2  — sub-headers (BPJS Kesehatan, JKK, JKM, JHT, JP, JKP for each band)
 *   row 3+ — data rows; continuation rows where NAMA is empty are skipped
 *
 * Column index map (0-based):
 *   A=0  NO.
 *   B=1  Bentuk ketenagakerjaan (1=Tetap, 2=Tidak Tetap, 3=Berhenti / Bukan Pegawai)
 *   C=2  NAMA PEGAWAI
 *   D=3  JENIS KELAMIN (M/F)
 *   E=4  STATUS PAJAK (TK/0, TK/1, ... K/3) — also accepts no-slash (TK0, K1)
 *   F=5  NPWP
 *   G=6  TANGGAL MULAI BEKERJA (join date)
 *   H=7  GAJI (basic monthly salary)
 *   I=8  TUNJANGAN
 *   J=9  BONUS/THR
 *   K=10 NATURA
 *   L=11 PINJAMAN GAJI
 *   M=12 POTONGAN GAJI
 *   N=13 PENAMBAH.BPJS_Kesehatan (회사 부담)
 *   O=14 PENAMBAH.JKK
 *   P=15 PENAMBAH.JKM
 *   Q=16 PENAMBAH.JHT
 *   R=17 PENAMBAH.JP
 *   S=18 PENAMBAH.JKP
 *   T=19 PENGURANG.BPJS_Kesehatan (직원 부담)
 *   U=20 PENGURANG.JHT
 *   V=21 PENGURANG.JP
 *   W=22 PENGURANG.JKP
 *   X=23 (unused, ignored)
 */

export interface JTCSalaryRow {
  no: number;
  employmentStatus: 1 | 2 | 3;
  name: string;
  gender: 'M' | 'F' | null;
  /** Normalized to slash form ('TK/0', 'K/1', ...). */
  ptkpCategory: string;
  npwp: string;
  /** ISO yyyy-mm-dd when parseable, else null. */
  joinDate: string | null;
  gaji: number;
  tunjangan: number;
  bonusThr: number;
  natura: number;
  pinjamanGaji: number;
  potonganGaji: number;
  penambah: {
    bpjsKesehatan: number;
    jkk: number;
    jkm: number;
    jht: number;
    jp: number;
    jkp: number;
  };
  pengurang: {
    bpjsKesehatan: number;
    jht: number;
    jp: number;
    jkp: number;
  };
}

export interface ParseJTCSalarySummary {
  rows: JTCSalaryRow[];
  /** employmentStatus !== 1 — stored but no full PPh21 calc in v1. */
  skippedNonTetap: number;
  /** PTKP missing/invalid, name missing on a row that had a NO. */
  skippedInvalid: number;
  /** Continuation rows (NAMA null) silently skipped — informational only. */
  skippedContinuation: number;
  warnings: string[];
}

const VALID_PTKP_SLASH = new Set([
  'TK/0', 'TK/1', 'TK/2', 'TK/3',
  'K/0', 'K/1', 'K/2', 'K/3',
]);

const HEADER_HINTS = {
  no: /^no\.?$/i,
  bentuk: /bentuk\s*ketenagakerjaan|employment\s*status/i,
  nama: /nama\s*pegawai|employee\s*name/i,
  gender: /jenis\s*kelamin|gender/i,
  status: /status\s*pajak|tax\s*status/i,
};

const PEGAWAI_TETAP_SHEET = 'PEGAWAI TETAP';

/**
 * Strip Rp, Indonesian thousand separators, and stray commas to get a
 * JS number. Handles both `8.000.000` (Indo) and `8,000,000` (US).
 * Returns 0 for null/empty/negative/NaN.
 */
export function parseAmount(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return 0;
    return raw > 0 ? Math.round(raw) : 0;
  }
  let s = String(raw).trim();
  if (!s || s === '-') return 0;
  // Drop currency markers
  s = s.replace(/Rp\.?/gi, '').replace(/\s+/g, '');
  // If both . and , present, assume Indo (.=thousand, ,=decimal). Else any
  // single grouping char becomes empty — we round to int anyway (IDR).
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(/,/g, '.');
  } else {
    s = s.replace(/[.,]/g, '');
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return n > 0 ? Math.round(n) : 0;
}

/**
 * Normalize PTKP code. Accepts 'TK0', 'TK/0', 'tk0', 'k 1', etc.
 * Returns canonical slash form 'TK/0' or null if invalid.
 */
export function normalizePtkp(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return null;
  // Insert slash if missing: TK0 -> TK/0, K1 -> K/1
  if (!s.includes('/')) {
    const m = s.match(/^(TK|K|KI)(\d)$/);
    if (m) {
      s = `${m[1]}/${m[2]}`;
    }
  }
  // KI is not in JTC valid set (v1) — fall through to invalid.
  return VALID_PTKP_SLASH.has(s) ? s : null;
}

/**
 * Parse join date. Accepts Date object (Excel cellDates), ISO string,
 * 'dd/mm/yyyy', 'dd-mm-yyyy'. Returns ISO yyyy-mm-dd or null.
 */
export function parseJoinDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // ISO first
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${m}-${d}`;
  }
  return null;
}

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function asGender(v: unknown): 'M' | 'F' | null {
  const s = asString(v).toUpperCase();
  if (s === 'M' || s === 'L' || s === 'MALE' || s === 'LAKI' || s === 'LAKI-LAKI') return 'M';
  if (s === 'F' || s === 'P' || s === 'FEMALE' || s === 'PEREMPUAN') return 'F';
  return null;
}

/**
 * Verify the first row looks like the JTC header. Cheap sanity check so
 * we fail loudly if someone uploads a totally different file.
 */
export function detectJtcHeader(firstRow: unknown[]): boolean {
  if (!firstRow || firstRow.length < 5) return false;
  const cells = firstRow.slice(0, 5).map((c) => asString(c));
  return (
    HEADER_HINTS.no.test(cells[0]) &&
    HEADER_HINTS.bentuk.test(cells[1]) &&
    HEADER_HINTS.nama.test(cells[2]) &&
    HEADER_HINTS.gender.test(cells[3]) &&
    HEADER_HINTS.status.test(cells[4])
  );
}

export interface ParseOptions {
  /** Override starting data row (default 3 — after the 3-row JTC header). */
  dataStartRow?: number;
}

/**
 * Parse a JTC PPh21 salary xlsx buffer into structured rows.
 *
 * Async because we dynamic-import `xlsx` (keeps it out of the main bundle
 * when this module isn't loaded — same pattern as client-file-parser.ts).
 */
export async function parseJTCSalaryTemplate(
  buffer: ArrayBuffer,
  opts: ParseOptions = {},
): Promise<ParseJTCSalarySummary> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  // Prefer 'PEGAWAI TETAP'; fall back to first sheet if missing (older / renamed files).
  const sheetName = wb.SheetNames.includes(PEGAWAI_TETAP_SHEET)
    ? PEGAWAI_TETAP_SHEET
    : wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('xlsx 파일에 시트가 없습니다');
  }
  const ws = wb.Sheets[sheetName];
  // header:1 → array-of-arrays; defval:null → keep undefined as null so we
  // can detect continuation rows cleanly.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (aoa.length === 0) {
    throw new Error('xlsx 파일이 비어 있습니다');
  }

  if (!detectJtcHeader(aoa[0])) {
    throw new Error(
      `JTC 템플릿 헤더를 인식할 수 없습니다. ` +
      `첫 행에 NO. / Bentuk ketenagakerjaan / NAMA PEGAWAI / JENIS KELAMIN / STATUS PAJAK 컬럼이 있어야 합니다.`,
    );
  }

  const dataStart = opts.dataStartRow ?? 3;
  const rows: JTCSalaryRow[] = [];
  const warnings: string[] = [];
  let skippedNonTetap = 0;
  let skippedInvalid = 0;
  let skippedContinuation = 0;

  for (let i = dataStart; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row || row.length === 0) continue;

    // NO column must be a positive number — skip totally blank rows.
    const no = asNumber(row[0]);
    if (no === null || no <= 0) continue;

    // NAMA empty → continuation row (template ships 5 blank slots per status).
    const name = asString(row[2]);
    if (!name) {
      skippedContinuation++;
      continue;
    }

    // Employment status must be 1 / 2 / 3.
    const statusRaw = asNumber(row[1]);
    if (statusRaw !== 1 && statusRaw !== 2 && statusRaw !== 3) {
      skippedInvalid++;
      warnings.push(`행 ${i + 1} (${name}): Bentuk ketenagakerjaan 1/2/3 만 허용 (입력=${row[1]})`);
      continue;
    }
    const employmentStatus = statusRaw as 1 | 2 | 3;

    // PTKP normalize + validate.
    const ptkp = normalizePtkp(row[4]);
    if (!ptkp) {
      skippedInvalid++;
      warnings.push(`행 ${i + 1} (${name}): STATUS PAJAK 미인식 (입력=${row[4]})`);
      continue;
    }

    if (employmentStatus !== 1) {
      skippedNonTetap++;
    }

    rows.push({
      no,
      employmentStatus,
      name,
      gender: asGender(row[3]),
      ptkpCategory: ptkp,
      npwp: asString(row[5]),
      joinDate: parseJoinDate(row[6]),
      gaji: parseAmount(row[7]),
      tunjangan: parseAmount(row[8]),
      bonusThr: parseAmount(row[9]),
      natura: parseAmount(row[10]),
      pinjamanGaji: parseAmount(row[11]),
      potonganGaji: parseAmount(row[12]),
      penambah: {
        bpjsKesehatan: parseAmount(row[13]),
        jkk: parseAmount(row[14]),
        jkm: parseAmount(row[15]),
        jht: parseAmount(row[16]),
        jp: parseAmount(row[17]),
        jkp: parseAmount(row[18]),
      },
      pengurang: {
        bpjsKesehatan: parseAmount(row[19]),
        jht: parseAmount(row[20]),
        jp: parseAmount(row[21]),
        jkp: parseAmount(row[22]),
      },
    });
  }

  return { rows, skippedNonTetap, skippedInvalid, skippedContinuation, warnings };
}

/**
 * Convert canonical slash PTKP ('TK/0') to the no-slash form ('TK0') used
 * by the PPh21Data type + DB enum.
 */
export function ptkpSlashToCode(slash: string): string {
  return slash.replace('/', '');
}
