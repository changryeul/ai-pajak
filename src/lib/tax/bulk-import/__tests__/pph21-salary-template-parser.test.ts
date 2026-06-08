/**
 * Unit tests for the JTC PPh21 salary template parser.
 *
 * Builds a synthetic xlsx in-memory so the test doesn't depend on the
 * real fixture file (which can drift). The synthetic file mirrors the
 * real 3-row header + 24-column layout.
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseJTCSalaryTemplate,
  normalizePtkp,
  parseAmount,
  parseJoinDate,
  detectJtcHeader,
  ptkpSlashToCode,
} from '../pph21-salary-template-parser';

// 24-cell main header (col A..X). The substrings are what detectJtcHeader
// matches on. Real file uses much longer human-readable strings but the
// regex hints are the same.
const MAIN_HEADER = [
  'NO.',
  'Bentuk ketenagakerjaan (Employment status)',
  'NAMA PEGAWAI (EMPLOYEE NAME)',
  'JENIS KELAMIN (GENDER)',
  'STATUS PAJAK (TAX STATUS)',
  'NPWP',
  'TANGGAL MULAI BEKERJA',
  'GAJI',
  'TUNJANGAN',
  'BONUS/THR',
  'NATURA',
  'PINJAMAN GAJI',
  'POTONGAN GAJI',
  'BPJS Kesehatan',
  'JKK',
  'JKM',
  'JHT',
  'JP',
  'JKP',
  'BPJS Kesehatan',
  'JHT',
  'JP',
  'JKP',
  null,
];

const SECTION_DIVIDER = [
  null, null, null, null, null, null, null, null, null, null, null, null, null,
  'PORSI YANG DITANGGUNG PERUSAHAAN', null, null, null, null, null,
  'PORSI YANG DITANGGUNG KARYAWAN', null, null, null, null,
];

const SUB_HEADER = [
  null, null, null, null, null, null, null, null, null, null, null, null, null,
  'BPJS Kesehatan', 'JKK', 'JKM', 'JHT', 'JP', 'JKP',
  'BPJS Kesehatan', 'JHT', 'JP', 'JKP',
  null,
];

/** Build an xlsx ArrayBuffer with the given data rows under our 3-row header. */
function buildWorkbook(dataRows: unknown[][]): ArrayBuffer {
  const aoa = [MAIN_HEADER, SECTION_DIVIDER, SUB_HEADER, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PEGAWAI TETAP');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer;
}

describe('normalizePtkp', () => {
  it('accepts slash form unchanged', () => {
    expect(normalizePtkp('TK/0')).toBe('TK/0');
    expect(normalizePtkp('K/3')).toBe('K/3');
  });

  it('inserts slash for no-slash form (backward compat)', () => {
    expect(normalizePtkp('TK0')).toBe('TK/0');
    expect(normalizePtkp('K1')).toBe('K/1');
    expect(normalizePtkp('tk2')).toBe('TK/2');
  });

  it('strips whitespace and uppercases', () => {
    expect(normalizePtkp(' tk 1 ')).toBe('TK/1');
  });

  it('returns null for invalid codes', () => {
    expect(normalizePtkp('XX/0')).toBeNull();
    expect(normalizePtkp('TK/4')).toBeNull();
    expect(normalizePtkp('')).toBeNull();
    expect(normalizePtkp(null)).toBeNull();
    // KI is out-of-scope for JTC v1 (left to manual entry)
    expect(normalizePtkp('KI/0')).toBeNull();
  });
});

describe('parseAmount', () => {
  it('strips Rp prefix', () => {
    expect(parseAmount('Rp 8.000.000')).toBe(8_000_000);
    expect(parseAmount('Rp.5000000')).toBe(5_000_000);
  });

  it('handles Indo thousand separators (.)', () => {
    expect(parseAmount('8.000.000')).toBe(8_000_000);
  });

  it('handles US thousand separators (,)', () => {
    expect(parseAmount('8,000,000')).toBe(8_000_000);
  });

  it('handles raw JS numbers (xlsx raw:true path)', () => {
    expect(parseAmount(8_000_000)).toBe(8_000_000);
    expect(parseAmount(3_242_750.0000001)).toBe(3_242_750); // float artifact → round
  });

  it('returns 0 for empty / dash / negative', () => {
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('-')).toBe(0);
    expect(parseAmount(-500)).toBe(0);
  });
});

describe('parseJoinDate', () => {
  it('returns ISO for Date objects', () => {
    expect(parseJoinDate(new Date(2024, 0, 15))).toBe('2024-01-15');
  });
  it('passes ISO strings through', () => {
    expect(parseJoinDate('2024-03-22')).toBe('2024-03-22');
  });
  it('parses dd/mm/yyyy', () => {
    expect(parseJoinDate('15/01/2024')).toBe('2024-01-15');
  });
  it('returns null for unparseable', () => {
    expect(parseJoinDate('garbage')).toBeNull();
    expect(parseJoinDate(null)).toBeNull();
  });
});

describe('detectJtcHeader', () => {
  it('matches the real header', () => {
    expect(detectJtcHeader(MAIN_HEADER)).toBe(true);
  });
  it('rejects junk', () => {
    expect(detectJtcHeader(['a', 'b', 'c', 'd', 'e'])).toBe(false);
    expect(detectJtcHeader([])).toBe(false);
  });
});

describe('ptkpSlashToCode', () => {
  it('drops the slash for DB enum form', () => {
    expect(ptkpSlashToCode('TK/0')).toBe('TK0');
    expect(ptkpSlashToCode('K/1')).toBe('K1');
  });
});

describe('parseJTCSalaryTemplate', () => {
  it('parses a single Tetap employee', async () => {
    const buf = buildWorkbook([
      [1, 1, 'FITRIA', 'F', 'TK/0', '01.234.567.8-901.000', new Date(2024, 0, 15),
        8_000_000, 1_500_000, 500_000, 0, 0, 0,
        320_000, 19_200, 24_000, 296_000, 160_000, 0,
        80_000, 160_000, 80_000, 0, null],
    ]);
    const r = await parseJTCSalaryTemplate(buf);
    expect(r.rows).toHaveLength(1);
    expect(r.skippedNonTetap).toBe(0);
    expect(r.skippedInvalid).toBe(0);
    expect(r.rows[0]).toMatchObject({
      no: 1,
      employmentStatus: 1,
      name: 'FITRIA',
      gender: 'F',
      ptkpCategory: 'TK/0',
      gaji: 8_000_000,
      tunjangan: 1_500_000,
      bonusThr: 500_000,
      penambah: { bpjsKesehatan: 320_000, jkk: 19_200 },
      pengurang: { bpjsKesehatan: 80_000, jht: 160_000 },
    });
  });

  it('skips continuation rows (NAMA empty but NO present)', async () => {
    const buf = buildWorkbook([
      [1, 1, 'FITRIA', 'F', 'TK/0', '', null, 8_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
      [2, 1, null,    null, null,    '', null, null,      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [3, 1, null,    null, null,    '', null, null,      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    ]);
    const r = await parseJTCSalaryTemplate(buf);
    expect(r.rows).toHaveLength(1);
    expect(r.skippedContinuation).toBe(2);
  });

  it('counts non-Tetap rows separately (status 2 / 3 stored)', async () => {
    const buf = buildWorkbook([
      [1, 1, 'TETAP1',  'M', 'TK/0', '', null, 5_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
      [2, 2, 'TIDAK1',  'F', 'K/1',  '', null, 3_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
      [3, 3, 'BERHENTI','M', 'TK/0', '', null, 2_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
    ]);
    const r = await parseJTCSalaryTemplate(buf);
    expect(r.rows).toHaveLength(3);
    expect(r.skippedNonTetap).toBe(2);
  });

  it('normalizes no-slash PTKP (TK0 → TK/0)', async () => {
    const buf = buildWorkbook([
      [1, 1, 'BOB', 'M', 'TK0', '', null, 5_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
      [2, 1, 'CAT', 'F', 'K1',  '', null, 6_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
    ]);
    const r = await parseJTCSalaryTemplate(buf);
    expect(r.rows[0].ptkpCategory).toBe('TK/0');
    expect(r.rows[1].ptkpCategory).toBe('K/1');
  });

  it('rejects invalid employment status with a warning', async () => {
    const buf = buildWorkbook([
      [1, 9, 'BAD', 'M', 'TK/0', '', null, 5_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
    ]);
    const r = await parseJTCSalaryTemplate(buf);
    expect(r.rows).toHaveLength(0);
    expect(r.skippedInvalid).toBe(1);
    expect(r.warnings[0]).toContain('Bentuk ketenagakerjaan');
  });

  it('rejects invalid PTKP with a warning', async () => {
    const buf = buildWorkbook([
      [1, 1, 'BAD', 'M', 'XX/9', '', null, 5_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
    ]);
    const r = await parseJTCSalaryTemplate(buf);
    expect(r.rows).toHaveLength(0);
    expect(r.skippedInvalid).toBe(1);
    expect(r.warnings[0]).toContain('STATUS PAJAK');
  });

  it('separates penambah (회사) vs pengurang (직원) BPJS', async () => {
    const buf = buildWorkbook([
      [1, 1, 'EMP', 'M', 'K/0', '', null,
        10_000_000, 0, 0, 0, 0, 0,
        // PENAMBAH (cols N..S)
        400_000, 24_000, 30_000, 370_000, 200_000, 0,
        // PENGURANG (cols T..W)
        100_000, 200_000, 100_000, 0, null],
    ]);
    const r = await parseJTCSalaryTemplate(buf);
    expect(r.rows[0].penambah).toEqual({
      bpjsKesehatan: 400_000, jkk: 24_000, jkm: 30_000,
      jht: 370_000, jp: 200_000, jkp: 0,
    });
    expect(r.rows[0].pengurang).toEqual({
      bpjsKesehatan: 100_000, jht: 200_000, jp: 100_000, jkp: 0,
    });
  });

  it('skips fully blank rows (no NO column)', async () => {
    const buf = buildWorkbook([
      [1, 1, 'EMP', 'M', 'TK/0', '', null, 5_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [],
    ]);
    const r = await parseJTCSalaryTemplate(buf);
    expect(r.rows).toHaveLength(1);
    expect(r.skippedContinuation).toBe(0);
  });

  it('throws when the file has no recognizable JTC header', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['some', 'random', 'sheet']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const ab = buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer;
    await expect(parseJTCSalaryTemplate(ab)).rejects.toThrow(/JTC 템플릿 헤더/);
  });

  it('parses Indo thousand-separated string amounts', async () => {
    const buf = buildWorkbook([
      [1, 1, 'EMP', 'M', 'TK/0', '', null, '8.000.000', '1.500.000', 'Rp 500.000', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
    ]);
    const r = await parseJTCSalaryTemplate(buf);
    expect(r.rows[0].gaji).toBe(8_000_000);
    expect(r.rows[0].tunjangan).toBe(1_500_000);
    expect(r.rows[0].bonusThr).toBe(500_000);
  });

  it('handles a mix of valid + skipped + non-Tetap in one file', async () => {
    const buf = buildWorkbook([
      [1, 1, 'OK1', 'M', 'TK/0', '', null, 5_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
      [2, 1, null, null, null,    '', null, null,      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], // continuation
      [3, 2, 'TIDAK','F', 'K/0',  '', null, 3_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null],
      [4, 9, 'BAD',  'M', 'TK/0', '', null, 5_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null], // invalid status
    ]);
    const r = await parseJTCSalaryTemplate(buf);
    expect(r.rows).toHaveLength(2);
    expect(r.skippedContinuation).toBe(1);
    expect(r.skippedNonTetap).toBe(1);
    expect(r.skippedInvalid).toBe(1);
  });
});
