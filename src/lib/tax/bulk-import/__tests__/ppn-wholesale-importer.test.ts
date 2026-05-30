/**
 * Unit tests for PPN wholesale importer (VAT OUT + VAT IN bulk extraction).
 *
 * Mirrors pph23-wholesale-importer tests where applicable, plus tests for
 * the two-section-in-one-sheet pattern that's unique to PPN compliance files.
 */

import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx';
import {
  mapPpnColumns,
  findVatInHeader,
  importPpnWholesaleFile,
  PpnColumnMapError,
  HEADER_HINTS,
} from '../ppn-wholesale-importer';

// xlsx-backed File shim — same pattern as client-file-parser.test.ts.
function makeXlsxFile(aoa: unknown[][], name = 'test.xlsx'): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const nodeBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const u8 = Uint8Array.from(nodeBuf);
  return {
    name,
    arrayBuffer: async () => u8.buffer as ArrayBuffer,
    text: async () => '',
  } as unknown as File;
}

describe('mapPpnColumns', () => {
  it('maps the canonical 16-column BINTANG JAYA header', () => {
    const header = [
      'NO', 'NPWP', 'NAME', 'ADDRESS', 'DESC',
      'EFAKTUR NO', 'INVOICE NO', 'EFAKTUR DATE',
      'TAX BASE', 'OTHER TAX BASE', 'TAX RATE', 'VAT',
      'PPN Tidak Dipungut/Dikredit', 'NOTES', 'Manual', 'DPP Nilai Lain',
    ];
    const map = mapPpnColumns(header);
    expect(map.no).toBe(0);
    expect(map.npwp).toBe(1);
    expect(map.name).toBe(2);
    expect(map.desc).toBe(4);
    expect(map.efaktur_no).toBe(5);
    expect(map.efaktur_date).toBe(7);
    expect(map.tax_base).toBe(8);    // not OTHER TAX BASE
    expect(map.vat).toBe(11);
  });

  it('matches lowercase / mixed-case headers', () => {
    const map = mapPpnColumns(['no', 'npwp', 'Name', 'address', 'desc', 'Efaktur No', 'invoice no', 'efaktur date', 'tax base', 'other tax base', 'tax rate', 'vat']);
    expect(map.name).toBe(2);
    expect(map.tax_base).toBe(8);
    expect(map.vat).toBe(11);
  });

  it('matches PPN as a synonym for VAT', () => {
    const map = mapPpnColumns(['NPWP', 'NAME', 'EFAKTUR DATE', 'TAX BASE', 'PPN']);
    expect(map.vat).toBe(4);
  });

  it('throws PpnColumnMapError listing missing required columns', () => {
    expect(() => mapPpnColumns(['NO', 'NPWP'])).toThrow(PpnColumnMapError);
    try {
      mapPpnColumns(['NO', 'NPWP']);
    } catch (e) {
      expect(e).toBeInstanceOf(PpnColumnMapError);
      expect((e as PpnColumnMapError).missing).toEqual(
        expect.arrayContaining(['NAME', 'TAX BASE', 'EFAKTUR DATE']),
      );
    }
  });

  it('OTHER TAX BASE alone does not satisfy tax_base requirement', () => {
    expect(() =>
      mapPpnColumns(['NO', 'NPWP', 'NAME', 'EFAKTUR DATE', 'OTHER TAX BASE']),
    ).toThrow(PpnColumnMapError);
  });

  it('first TAX BASE wins when duplicates exist', () => {
    const map = mapPpnColumns(['NPWP', 'NAME', 'EFAKTUR DATE', 'TAX BASE', 'TAX BASE']);
    expect(map.tax_base).toBe(3);
  });
});

describe('findVatInHeader', () => {
  const headerRow = ['NO', 'NPWP', 'NAME', 'EFAKTUR DATE', 'TAX BASE', 'VAT']; // satisfies ≥2 hints

  it('finds the IN column header after a "VAT IN" title row', () => {
    const rows = [
      ['VAT OUT'],
      headerRow,                              // OUT header at idx 1
      ['1', '...', 'PT A', '2026-01-05', '100000', '11000'],
      [''],
      ['VAT IN / PPN MASUKAN', '', ''],       // title at idx 4
      headerRow,                              // IN header at idx 5
      ['1', '...', 'PT B', '2026-01-10', '50000', '5500'],
    ];
    expect(findVatInHeader(rows, 1)).toBe(5);
  });

  it('case-insensitive — matches "Vat In" / "vat in" / "PPN MASUKAN"', () => {
    expect(findVatInHeader(
      [headerRow, ['Vat In'], headerRow], 0,
    )).toBe(2);
    expect(findVatInHeader(
      [headerRow, ['vat in - title'], headerRow], 0,
    )).toBe(2);
    expect(findVatInHeader(
      [headerRow, ['ppn masukan'], headerRow], 0,
    )).toBe(2);
  });

  it('returns null when no second section exists', () => {
    const rows = [
      headerRow,
      ['1', '...', 'PT A', '2026-01-05', '100000', '11000'],
      ['TOTAL', '', '', '', '500000', '55000'],
    ];
    expect(findVatInHeader(rows, 0)).toBeNull();
  });

  it('returns null when title is present but no column header follows within lookahead', () => {
    const rows = [
      headerRow,
      ['VAT IN'],
      ['random', 'unrelated'],
      ['another', 'row'],
      ['VAT', 'is', 'mentioned', 'but', 'no', 'header'],
    ];
    expect(findVatInHeader(rows, 0)).toBeNull();
  });

  it('uses passed hints parameter', () => {
    const customHints = [/^foo$/i, /^bar$/i];
    const rows = [
      ['something'],
      ['VAT IN'],
      ['foo', 'bar'],
    ];
    expect(findVatInHeader(rows, 0, customHints)).toBe(2);
  });

  it('exports HEADER_HINTS for reuse', () => {
    expect(Array.isArray(HEADER_HINTS)).toBe(true);
    expect(HEADER_HINTS.length).toBeGreaterThan(3);
  });
});

describe('importPpnWholesaleFile (end-to-end)', () => {
  const OUT_HEADER = ['NO', 'NPWP', 'NAME', 'ADDRESS', 'DESC', 'EFAKTUR NO', 'INVOICE NO', 'EFAKTUR DATE', 'TAX BASE', 'OTHER TAX BASE', 'TAX RATE', 'VAT'];

  it('extracts OUT + IN from a 2-section sheet with correct counts', async () => {
    const aoa: unknown[][] = [
      ['VAT OUT / PPN KELUARAN'],
      OUT_HEADER,
      [1, '01.000.001.0-001.000', 'PT BUYER A', 'Jakarta', 'Sale 1', 'FK-001', 'INV-1', '2026-01-05', 1000000, 0, 0.11, 110000],
      [2, '01.000.002.0-002.000', 'PT BUYER B', 'Jakarta', 'Sale 2', 'FK-002', 'INV-2', '2026-01-10', 2000000, 0, 0.11, 220000],
      [3, '01.000.003.0-003.000', 'PT BUYER C', 'Jakarta', 'Sale 3', 'FK-003', 'INV-3', '2026-01-15', 3000000, 0, 0.11, 330000],
      [4, '01.000.004.0-004.000', 'PT BUYER D', 'Jakarta', 'Sale 4', 'FK-004', 'INV-4', '2026-01-20', 4000000, 0, 0.11, 440000],
      [5, '01.000.005.0-005.000', 'PT BUYER E', 'Jakarta', 'Sale 5', 'FK-005', 'INV-5', '2026-01-25', 5000000, 0, 0.11, 550000],
      ['', '', '', '', '', '', '', 'TOTAL', 15000000, 0, 0, 1650000],
      [''],
      ['VAT IN / PPN MASUKAN'],
      OUT_HEADER, // same header columns
      [1, '02.000.001.0-001.000', 'PT VENDOR A', 'Jakarta', 'Purchase 1', 'FK-100', 'INV-100', '2026-01-06', 500000, 0, 0.11, 55000],
      [2, '02.000.002.0-002.000', 'PT VENDOR B', 'Jakarta', 'Purchase 2', 'FK-101', 'INV-101', '2026-01-12', 700000, 0, 0.11, 77000],
      [3, '02.000.003.0-003.000', 'PT VENDOR C', 'Jakarta', 'Purchase 3', 'FK-102', 'INV-102', '2026-01-18', 800000, 0, 0.11, 88000],
      ['', '', '', '', '', '', '', 'TOTAL', 2000000, 0, 0, 220000],
    ];
    const summary = await importPpnWholesaleFile(makeXlsxFile(aoa));
    expect(summary.outImported).toBe(5);
    expect(summary.inImported).toBe(3);
    expect(summary.errors).toEqual([]);
    expect(summary.skippedByValidation).toBe(0);
    expect(summary.skippedFooters).toBeGreaterThanOrEqual(2); // 2 TOTAL footers + maybe a blank

    // CSV header matches canonical schema
    const outLines = summary.outCsv.split('\n');
    expect(outLines[0]).toBe('faktur_date,faktur_number,counterparty_name,counterparty_npwp,dpp,ppn,description');
    expect(outLines[1]).toContain('2026-01-05');
    expect(outLines[1]).toContain('PT BUYER A');
    expect(outLines[1]).toContain('1000000');
    expect(outLines[1]).toContain('110000');

    const inLines = summary.inCsv.split('\n');
    expect(inLines[0]).toBe('faktur_date,faktur_number,counterparty_name,counterparty_npwp,dpp,ppn,description');
    expect(inLines.length).toBe(4); // header + 3 data rows
  });

  it('handles OUT-only sheet (no VAT IN section) → inImported=0 + inCsv has header only', async () => {
    const aoa: unknown[][] = [
      ['VAT OUT'],
      OUT_HEADER,
      [1, '01.000.001.0-001.000', 'PT BUYER A', 'JKT', 'Sale', 'FK-1', 'INV-1', '2026-02-05', 100000, 0, 0.11, 11000],
      [2, '01.000.002.0-002.000', 'PT BUYER B', 'JKT', 'Sale', 'FK-2', 'INV-2', '2026-02-10', 200000, 0, 0.11, 22000],
    ];
    const summary = await importPpnWholesaleFile(makeXlsxFile(aoa));
    expect(summary.outImported).toBe(2);
    expect(summary.inImported).toBe(0);
    expect(summary.inCsv.split('\n').length).toBe(1); // header only, no data
  });

  it('skips footers (TOTAL/NIHIL/KURANG/LEBIH/NOTES) without flagging as validation errors', async () => {
    const aoa: unknown[][] = [
      OUT_HEADER,
      [1, '01.000.001.0-001.000', 'PT A', 'JKT', 'Sale', 'FK-1', 'INV-1', '2026-03-05', 100000, 0, 0.11, 11000],
      ['', '', '', '', '', '', '', 'TOTAL VAT OUT', 100000, 0, 0, 11000],
      ['VAT IN / PPN MASUKAN'],
      OUT_HEADER,
      [1, '02.000.001.0-001.000', 'PT B', 'JKT', 'Purchase', 'FK-100', 'INV-100', '2026-03-06', 50000, 0, 0.11, 5500],
      ['', '', '', '', '', '', '', 'TOTAL VAT IN', 50000, 0, 0, 5500],
      [''],
      ['Notes:', 'Period 2026-03'],
      ['', 'KURANG BAYAR', '', '', '', '', '', '', '', '', '', 5500],
    ];
    const summary = await importPpnWholesaleFile(makeXlsxFile(aoa));
    expect(summary.outImported).toBe(1);
    expect(summary.inImported).toBe(1);
    expect(summary.skippedByValidation).toBe(0);
    expect(summary.errors).toEqual([]);
  });

  it('reports validation errors (missing name / bad date / bad amount) with section tag', async () => {
    const aoa: unknown[][] = [
      OUT_HEADER,
      [1, 'NPWP-1', '', 'JKT', 'Sale', 'FK-1', 'INV-1', '2026-04-05', 100000, 0, 0.11, 11000], // missing name
      [2, 'NPWP-2', 'PT BAD AMOUNT', 'JKT', 'Sale', 'FK-2', 'INV-2', '2026-04-10', 'abc', 0, 0.11, 11000],
      [3, 'NPWP-3', 'PT BAD DATE', 'JKT', 'Sale', 'FK-3', 'INV-3', 'not-a-date', 100000, 0, 0.11, 11000],
      [4, 'NPWP-4', 'PT GOOD', 'JKT', 'Sale', 'FK-4', 'INV-4', '2026-04-20', 500000, 0, 0.11, 55000],
    ];
    const summary = await importPpnWholesaleFile(makeXlsxFile(aoa));
    expect(summary.outImported).toBe(1); // only PT GOOD
    expect(summary.skippedByValidation).toBe(3);
    expect(summary.errors.length).toBe(3);
    expect(summary.errors.every((e) => e.section === 'OUT')).toBe(true);
    const reasons = summary.errors.map((e) => e.reason).join(' | ');
    expect(reasons).toContain('missing counterparty_name');
    expect(reasons).toContain('invalid tax_base');
    expect(reasons).toContain('invalid date');
  });

  it('throws PpnColumnMapError when required columns are missing entirely', async () => {
    const aoa: unknown[][] = [
      ['foo', 'bar'],
      ['1', '2'],
    ];
    await expect(importPpnWholesaleFile(makeXlsxFile(aoa))).rejects.toThrow(PpnColumnMapError);
  });

  it('handles meta rows (NAME / NPWP / PERIOD) above the OUT header', async () => {
    const aoa: unknown[][] = [
      ['NAME', 'PT BINTANG JAYA'],
      ['NPWP', '99.999.999.9-999.000'],
      ['PERIOD', '2026-05'],
      [''],
      OUT_HEADER,
      [1, '01.000.001.0-001.000', 'PT A', 'JKT', 'Sale', 'FK-1', 'INV-1', '2026-05-05', 100000, 0, 0.11, 11000],
    ];
    const summary = await importPpnWholesaleFile(makeXlsxFile(aoa));
    expect(summary.outImported).toBe(1);
    expect(summary.errors).toEqual([]);
  });

  it('preserves VAT (PPN) value from file as-is (not recalculated)', async () => {
    // 12% rate file — bulk importer must NOT force 11%
    const aoa: unknown[][] = [
      OUT_HEADER,
      [1, '01.000.001.0-001.000', 'PT A', 'JKT', 'Sale', 'FK-1', 'INV-1', '2026-06-05', 1000000, 0, 0.12, 120000],
      [2, '01.000.002.0-002.000', 'PT B', 'JKT', 'Sale', 'FK-2', 'INV-2', '2026-06-10', 2000000, 0, 0.12, 240000],
    ];
    const summary = await importPpnWholesaleFile(makeXlsxFile(aoa));
    expect(summary.outImported).toBe(2);
    const lines = summary.outCsv.split('\n');
    expect(lines[1]).toContain('120000');
    expect(lines[2]).toContain('240000');
  });

  it('handles empty VAT column → ppn cell is empty string (server fallback fills)', async () => {
    const aoa: unknown[][] = [
      OUT_HEADER,
      [1, '01.000.001.0-001.000', 'PT A', 'JKT', 'Sale', 'FK-1', 'INV-1', '2026-07-05', 1000000, 0, 0.11, ''],
    ];
    const summary = await importPpnWholesaleFile(makeXlsxFile(aoa));
    expect(summary.outImported).toBe(1);
    const lines = summary.outCsv.split('\n');
    // CSV row should still emit DPP correctly; PPN cell empty
    expect(lines[1]).toContain('1000000');
  });
});
