/**
 * Unit tests for the WHT one-sheet integrated parser.
 *
 * Builds synthetic xlsx in-memory so tests don't depend on the real JTC
 * fixture file. Mirrors the real 2-row header + 21-column layout (row 0-4
 * meta, row 5-6 header, row 7+ data).
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseWHTOneSheet,
  classifyWHTRow,
  parseAmount,
  parseJtcDate,
  type WHTLedgerRow,
} from '../wht-onesheet-parser';

// 21-cell main header (col A..U). Substrings the detector matches on
// (NO + NAMA + NPWP).
const MAIN_HEADER = [
  'NO',
  'ALAMAT',
  'NAMA',
  'NPWP',
  'DESKRIPSI TRANSAKSI',
  'NO. INVOICE',
  'NO. FAKTUR PAJAK',
  'TGL INVOICE/FAKTUR PAJAK',
  'TGL JTH TEMPO INV',
  'TGL PEMBAYARAN',
  'PPh 21/23/26 JASA/SEWA',
  'PPh 4(2) SEWA TNH & BANGUNAN',
  'DPP PPN',
  'PPN',
  'DPP PIHAK KETIGA',
  'PPh 21/23/26 & 4(2) YANG DI INVOICE',
  'BIAYA MATERAI',
  'BIAYA LAIN-LAIN',
  'JUMLAH YANG DIBAYARKAN KE VENDOR',
  'NOTES',
  null,
];

// 2nd header row (sub-headers / unit row in JTC template)
const SUB_HEADER = [
  null, null, null, null, null, null, null, '(MM/DD/YY)', '(MM/DD/YY)', '(MM/DD/YY)',
  null, null, null, null, null, null, null, null, null, null, null,
];

// Build a workbook with the JTC layout: 5 meta rows + 2 header rows + data.
function buildWorkbook(dataRows: unknown[][]): ArrayBuffer {
  const allRows: unknown[][] = [
    ['NAME', 'PT TEST'],
    ['NPWP', '01.234.567.8-901.000'],
    ['ADDRESS', 'Jakarta'],
    ['PERIODE', '2026-08'],
    ['TAX COMPLIANCE', 'WHT'],
    MAIN_HEADER,
    SUB_HEADER,
    ...dataRows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('parseAmount', () => {
  it('parses US-format with comma thousands + dot decimal', () => {
    expect(parseAmount('15,200,000.00')).toBe(15200000);
    expect(parseAmount('1,234.50')).toBe(1234.5);
  });

  it('parses Indo-format with dot thousands', () => {
    expect(parseAmount('15.200.000')).toBe(15200000);
    expect(parseAmount('1.234.567')).toBe(1234567);
  });

  it('strips Rp prefix', () => {
    expect(parseAmount('Rp 1.234.000')).toBe(1234000);
    expect(parseAmount('Rp1,234,000')).toBe(1234000);
  });

  it('handles negative / blank / null as 0', () => {
    expect(parseAmount('-1000')).toBe(0);
    expect(parseAmount('(1000)')).toBe(0);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount('-')).toBe(0);
  });

  it('passes through numeric inputs', () => {
    expect(parseAmount(15200000)).toBe(15200000);
    expect(parseAmount(0)).toBe(0);
    expect(parseAmount(-100)).toBe(0);
  });
});

describe('parseJtcDate', () => {
  it('parses MM/DD/YY (JTC convention)', () => {
    expect(parseJtcDate('11/7/25')).toBe('2025-11-07');
    expect(parseJtcDate('3/15/25')).toBe('2025-03-15');
  });

  it('swaps DD/MM/YY when first part > 12', () => {
    expect(parseJtcDate('25/3/25')).toBe('2025-03-25');
    expect(parseJtcDate('15/8/26')).toBe('2026-08-15');
  });

  it('handles full 4-digit year', () => {
    expect(parseJtcDate('11/7/2025')).toBe('2025-11-07');
  });

  it('passes ISO through', () => {
    expect(parseJtcDate('2026-08-15')).toBe('2026-08-15');
  });

  it('returns null for invalid', () => {
    expect(parseJtcDate('')).toBeNull();
    expect(parseJtcDate(null)).toBeNull();
    expect(parseJtcDate('not a date')).toBeNull();
    expect(parseJtcDate('13/13/25')).toBeNull();
  });

  it('handles Date objects', () => {
    expect(parseJtcDate(new Date('2026-08-15T00:00:00Z'))).toMatch(/^2026-08-1[45]$/);
  });
});

describe('classifyWHTRow', () => {
  function rowBase(overrides: Partial<WHTLedgerRow> = {}): WHTLedgerRow {
    return {
      no: 1,
      vendor: { alamat: 'JKT', nama: 'VENDOR A', npwp: '01.234.567.8-901.000' },
      invoice: { description: 'Service', invoiceNo: 'INV-001', fakturNo: '' },
      dates: { invoice: '2026-08-01', due: null, payment: null },
      type: { pphLabel: '', pph42Label: '' },
      vat: { dpp: 0, ppn: 0 },
      wht: { base: 1000000, amount: 20000 },
      materai: 0, miscFee: 0, vendorPaid: 0, notes: '',
      ...overrides,
    };
  }

  it('K=Jasa → pph23_jasa @ 2%', () => {
    const c = classifyWHTRow(rowBase({ type: { pphLabel: 'Jasa', pph42Label: '' } }));
    expect(c.classified).toBe('pph23_jasa');
    expect(c.expectedRate).toBe(0.02);
    expect(c.warnings).not.toContain('npwpMissing');
  });

  it('K=sewa → pph23_sewa @ 2%', () => {
    const c = classifyWHTRow(rowBase({ type: { pphLabel: 'sewa', pph42Label: '' } }));
    expect(c.classified).toBe('pph23_sewa');
    expect(c.expectedRate).toBe(0.02);
  });

  it('L non-empty → pph4_2_sewa @ 10%', () => {
    const c = classifyWHTRow(rowBase({
      type: { pphLabel: '', pph42Label: 'Sewa T&B' },
      wht: { base: 10000000, amount: 1000000 },
    }));
    expect(c.classified).toBe('pph4_2_sewa');
    expect(c.expectedRate).toBe(0.10);
  });

  it('K + L both filled → pph4_2_sewa + dualType warning', () => {
    const c = classifyWHTRow(rowBase({
      type: { pphLabel: 'Jasa', pph42Label: 'Sewa T&B' },
    }));
    expect(c.classified).toBe('pph4_2_sewa');
    expect(c.warnings).toContain('dualType');
  });

  it('K + L both empty → unknown', () => {
    const c = classifyWHTRow(rowBase({ type: { pphLabel: '', pph42Label: '' } }));
    expect(c.classified).toBe('unknown');
    expect(c.warnings).toContain('unknownType');
  });

  it('K=PPh26 → pph26 @ 20% (foreign vendor)', () => {
    const c = classifyWHTRow(rowBase({
      type: { pphLabel: 'PPh26', pph42Label: '' },
      wht: { base: 20000000, amount: 4000000 },
    }));
    expect(c.classified).toBe('pph26');
    expect(c.expectedRate).toBe(0.20);
    expect(c.warnings).not.toContain('unknownType');
  });

  it('K=pph 26 jasa konsultan → pph26 (priority over jasa keyword)', () => {
    const c = classifyWHTRow(rowBase({
      type: { pphLabel: 'pph 26 jasa konsultan', pph42Label: '' },
      wht: { base: 10000000, amount: 2000000 },
    }));
    expect(c.classified).toBe('pph26');
    expect(c.expectedRate).toBe(0.20);
  });

  it('K=PPh26 + no NPWP → no npwpMissing warning (foreign vendor expected)', () => {
    const c = classifyWHTRow(rowBase({
      vendor: { alamat: 'Singapore', nama: 'Global Tech Pte', npwp: '' },
      type: { pphLabel: 'PPh26', pph42Label: '' },
      wht: { base: 20000000, amount: 4000000 },
    }));
    expect(c.classified).toBe('pph26');
    expect(c.warnings).not.toContain('npwpMissing');
  });

  it('NPWP missing → npwpMissing warning', () => {
    const c = classifyWHTRow(rowBase({
      vendor: { alamat: '', nama: 'V', npwp: '' },
      type: { pphLabel: 'Jasa', pph42Label: '' },
    }));
    expect(c.warnings).toContain('npwpMissing');
    expect(c.classified).toBe('pph23_jasa'); // still classified
  });

  it('NPWP all zeros → npwpInvalid warning', () => {
    const c = classifyWHTRow(rowBase({
      vendor: { alamat: '', nama: 'V', npwp: '00.000.000.0-000.000' },
      type: { pphLabel: 'Jasa', pph42Label: '' },
    }));
    expect(c.warnings).toContain('npwpInvalid');
  });

  it('VAT (M/N) populated → vatInsert true', () => {
    const c = classifyWHTRow(rowBase({
      type: { pphLabel: 'Jasa', pph42Label: '' },
      vat: { dpp: 1000000, ppn: 120000 },
    }));
    expect(c.vatInsert).toBe(true);
  });

  it('amount drift > 5% → amountMismatch warning', () => {
    const c = classifyWHTRow(rowBase({
      type: { pphLabel: 'Jasa', pph42Label: '' },
      wht: { base: 1000000, amount: 50000 }, // expected 20K, actual 50K → big drift
    }));
    expect(c.warnings).toContain('amountMismatch');
  });

  it('amount drift < 5% → no warning', () => {
    const c = classifyWHTRow(rowBase({
      type: { pphLabel: 'Jasa', pph42Label: '' },
      wht: { base: 1000000, amount: 20500 }, // 2.5% drift → ok
    }));
    expect(c.warnings).not.toContain('amountMismatch');
  });
});

describe('parseWHTOneSheet', () => {
  it('parses 2-row header + data rows', () => {
    const buf = buildWorkbook([
      [1, 'JKT', 'VENDOR A', '01.234.567.8-901.000', 'Konsultasi', 'INV-001', 'FK-001',
        '8/15/26', '8/30/26', '8/20/26',
        'Jasa', '',
        1000000, 120000,
        1000000, 20000,
        0, 0, 1100000, 'note A'],
      [2, 'JKT', 'VENDOR B', '02.345.678.9-012.000', 'Sewa kendaraan', 'INV-002', '',
        '8/16/26', null, null,
        'sewa', '',
        0, 0,
        5000000, 100000,
        0, 0, 4900000, ''],
    ]);
    const summary = parseWHTOneSheet(buf);
    expect(summary.totalRows).toBe(2);
    expect(summary.rows[0].vendor.nama).toBe('VENDOR A');
    expect(summary.rows[0].classified).toBe('pph23_jasa');
    expect(summary.rows[0].vatInsert).toBe(true);
    expect(summary.rows[1].classified).toBe('pph23_sewa');
    expect(summary.rows[1].vatInsert).toBe(false);
    expect(summary.byType.pph23_jasa).toBe(1);
    expect(summary.byType.pph23_sewa).toBe(1);
  });

  it('handles PPh4(2) row (L non-empty)', () => {
    const buf = buildWorkbook([
      [1, 'JKT', 'LANDLORD', '03.456.789.0-123.000', 'Sewa kantor', 'INV-003', '',
        '8/15/26', null, null,
        '', 'Sewa Tanah & Bangunan',
        0, 0,
        10000000, 1000000,
        0, 0, 9000000, ''],
    ]);
    const summary = parseWHTOneSheet(buf);
    expect(summary.totalRows).toBe(1);
    expect(summary.rows[0].classified).toBe('pph4_2_sewa');
    expect(summary.rows[0].expectedRate).toBe(0.10);
  });

  it('skips rows with no NAMA', () => {
    const buf = buildWorkbook([
      [1, 'JKT', 'VENDOR A', '01.234.567.8-901.000', '', 'INV-001', '',
        '8/15/26', null, null, 'Jasa', '', 0, 0, 1000000, 20000, 0, 0, 0, ''],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [2, 'JKT', 'VENDOR C', '02.345.678.9-012.000', '', 'INV-005', '',
        '8/15/26', null, null, 'Jasa', '', 0, 0, 1000000, 20000, 0, 0, 0, ''],
    ]);
    const summary = parseWHTOneSheet(buf);
    expect(summary.totalRows).toBe(2);
    expect(summary.rows[0].vendor.nama).toBe('VENDOR A');
    expect(summary.rows[1].vendor.nama).toBe('VENDOR C');
  });

  it('throws when no header found', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['random', 'noise'],
      ['nothing', 'matching'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    expect(() => parseWHTOneSheet(buf)).toThrow();
  });

  it('falls back to first sheet when "Sheet1" missing', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      MAIN_HEADER,
      [1, 'JKT', 'VENDOR Z', '01.234.567.8-901.000', '', 'INV-Z', '',
        '8/15/26', null, null, 'Jasa', '', 0, 0, 500000, 10000, 0, 0, 0, ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OtherName');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const summary = parseWHTOneSheet(buf);
    expect(summary.totalRows).toBe(1);
    expect(summary.rows[0].vendor.nama).toBe('VENDOR Z');
  });

  it('aggregates byType counts', () => {
    const buf = buildWorkbook([
      [1, '', 'V1', '01.234.567.8-901.000', '', 'I1', '', '8/15/26', null, null, 'Jasa', '', 0, 0, 1000000, 20000, 0, 0, 0, ''],
      [2, '', 'V2', '01.234.567.8-901.000', '', 'I2', '', '8/15/26', null, null, 'Jasa', '', 0, 0, 1000000, 20000, 0, 0, 0, ''],
      [3, '', 'V3', '02.345.678.9-012.000', '', 'I3', '', '8/15/26', null, null, 'sewa', '', 0, 0, 1000000, 20000, 0, 0, 0, ''],
      [4, '', 'V4', '03.456.789.0-123.000', '', 'I4', '', '8/15/26', null, null, '', 'Sewa T&B', 0, 0, 5000000, 500000, 0, 0, 0, ''],
    ]);
    const summary = parseWHTOneSheet(buf);
    expect(summary.byType.pph23_jasa).toBe(2);
    expect(summary.byType.pph23_sewa).toBe(1);
    expect(summary.byType.pph4_2_sewa).toBe(1);
    expect(summary.totalRows).toBe(4);
  });
});
