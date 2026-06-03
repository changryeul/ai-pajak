import { describe, it, expect } from 'vitest';
import {
  classifyPph26TaxType,
  importPph26WholesaleFile,
  Pph26ColumnMapError,
} from '../pph26-wholesale-importer';
// detectHeaderRow + mapColumns + parseAmount + parseIndoDate are covered
// upstream in pph23-wholesale-importer.test.ts — the PPh26 importer re-uses
// the exact same helpers, so we don't duplicate those assertions here.

describe('classifyPph26TaxType', () => {
  it('PPH 26 alone (no subtype) → OTHER', () => {
    expect(classifyPph26TaxType('PPH 26')).toBe('OTHER');
  });
  it('PPH 26 with Dividen sub → DIVIDEND', () => {
    expect(classifyPph26TaxType('PPH 26', 'Dividen Q1')).toBe('DIVIDEND');
  });
  it('PPH 26 with Bunga sub → INTEREST', () => {
    expect(classifyPph26TaxType('PPH 26', 'Bunga pinjaman')).toBe('INTEREST');
  });
  it('PPH 26 with interest sub → INTEREST', () => {
    expect(classifyPph26TaxType('PPH 26', 'loan interest')).toBe('INTEREST');
  });
  it('PPH 26 with Royalti sub → ROYALTY', () => {
    expect(classifyPph26TaxType('PPH 26', 'Royalti software')).toBe('ROYALTY');
  });
  it('PPH 26 with royalty sub (en) → ROYALTY', () => {
    expect(classifyPph26TaxType('PPH 26', 'software royalty')).toBe('ROYALTY');
  });
  it('PPH 26 with Jasa Teknik sub → SERVICE', () => {
    expect(classifyPph26TaxType('PPH 26', 'Jasa Teknik luar negeri')).toBe('SERVICE');
  });
  it('PPH 26 with Manajemen sub → SERVICE', () => {
    expect(classifyPph26TaxType('PPH 26', 'Jasa Manajemen')).toBe('SERVICE');
  });
  it('PPh 26 (mixed case) → still keep', () => {
    expect(classifyPph26TaxType('PPh 26', 'Dividen Q4')).toBe('DIVIDEND');
  });

  // Skip reasons
  it('PPH 23 Jasa → skip pph23', () => {
    expect(classifyPph26TaxType('PPH 23 Jasa', 'Konsultan')).toBe('pph23');
  });
  it('PPH 23 alone → skip pph23', () => {
    expect(classifyPph26TaxType('PPH 23')).toBe('pph23');
  });
  it('PPH 4 AYAT 2 → skip pph4_2', () => {
    expect(classifyPph26TaxType('PPH 4 AYAT 2 konstruksi pelaksanaan')).toBe('pph4_2');
  });
  it('PPH 21 Bukan Pegawai → skip pph21', () => {
    expect(classifyPph26TaxType('PPH 21 Bukan Pegawai 50%')).toBe('pph21');
  });
  it('empty → unknown', () => {
    expect(classifyPph26TaxType('')).toBe('unknown');
  });
  it('garbage → unknown', () => {
    expect(classifyPph26TaxType('SOME OTHER TAX')).toBe('unknown');
  });
  it('PP 26 (missing H) → unknown', () => {
    expect(classifyPph26TaxType('PP 26')).toBe('unknown');
  });
});

describe('importPph26WholesaleFile (end-to-end)', () => {
  class NodeFile {
    name: string;
    private buf: Uint8Array;
    constructor(content: string, name: string) {
      this.buf = new TextEncoder().encode(content);
      this.name = name;
    }
    async text() {
      return new TextDecoder().decode(this.buf);
    }
    async arrayBuffer() {
      return this.buf.buffer.slice(
        this.buf.byteOffset,
        this.buf.byteOffset + this.buf.byteLength,
      );
    }
  }

  function makeFile(csv: string, name = 'fixture.csv'): File {
    return new NodeFile(csv, name) as unknown as File;
  }

  it('imports PPh26 rows and skips other tax types with accurate counts', async () => {
    // 4 PPh26 (1 each: dividend/interest/royalty/service)
    // 2 skipped by tax type (PPh23 + PPh4(2))
    // 3 skipped by validation (missing name / bad amount / bad date)
    const csv = [
      'Biz Name,NPWP,Sub Transaction,Transaction Desc,Invoice Amount,Invoice Date,Invoice No,Type of Tax',
      // 4 valid PPh26 rows
      'GOOGLE LLC,,Dividen,Quarterly dividend,10000000,20-Jan-22,INV-001,PPH 26',
      'BANK OF TOKYO,,Bunga,Loan interest,5000000,15-Feb-22,INV-002,PPH 26',
      'MICROSOFT INC,,Royalti,Software royalty,7500000,01-Mar-22,INV-003,PPH 26',
      'PT XYZ SINGAPORE,,Jasa Teknik,Engineering service,3000000,10-Apr-22,INV-004,PPH 26',
      // 2 skipped by tax type
      'PT KONSULTAN,01.234.567.8-901.234,Jasa Konsultan,Local consulting,2000000,15-Apr-22,INV-005,PPH 23 Jasa',
      'PT KONSTRUKSI,02.000.044.4-044.000,Konstruksi,Bangunan,8000000,10-May-22,INV-006,PPH 4 AYAT 2 konstruksi pelaksanaan',
      // 3 skipped by validation
      ',,Dividen,Missing name,1000000,20-Jun-22,INV-007,PPH 26',
      'PT BAD AMOUNT,,Bunga,Bad amount,abc,20-Jul-22,INV-008,PPH 26',
      'PT BAD DATE,,Royalti,Bad date,1000000,not-a-date,INV-009,PPH 26',
    ].join('\n');

    const summary = await importPph26WholesaleFile(makeFile(csv));
    expect(summary.imported).toBe(4);
    expect(summary.skippedByTaxType).toBe(2);
    expect(summary.skippedByValidation).toBe(3);
    expect(summary.errors.map((e) => e.reason).sort()).toEqual(
      [
        'invalid date format: not-a-date',
        'invalid gross_amount',
        'missing counterparty_name',
      ].sort(),
    );

    const csvLines = summary.csvContent.split('\n');
    expect(csvLines[0]).toBe(
      'transaction_date,income_type,gross_amount,counterparty_name,counterparty_npwp,invoice_number,description',
    );
    // First data row: GOOGLE LLC Dividen
    expect(csvLines[1]).toContain('2022-01-20');
    expect(csvLines[1]).toContain('DIVIDEND');
    expect(csvLines[1]).toContain('10000000');
    expect(csvLines[1]).toContain('GOOGLE LLC');
    // Verify each kind appears in output
    expect(csvLines.some((l) => l.includes('INTEREST') && l.includes('BANK OF TOKYO'))).toBe(
      true,
    );
    expect(csvLines.some((l) => l.includes('ROYALTY') && l.includes('MICROSOFT INC'))).toBe(
      true,
    );
    expect(
      csvLines.some((l) => l.includes('SERVICE') && l.includes('PT XYZ SINGAPORE')),
    ).toBe(true);
  });

  it('returns empty summary when fixture has only non-PPh26 rows', async () => {
    const csv = [
      'Biz Name,NPWP,Sub Transaction,Transaction Desc,Invoice Amount,Invoice Date,Invoice No,Type of Tax',
      'PT KONSULTAN,01.234.567.8-901.234,Jasa Konsultan,Strategy advice,10000000,15-Feb-22,INV-002,PPH 23 Jasa',
      'PT KONSTRUKSI,04.000.044.4-044.000,Konstruksi,Bangunan,20000000,10-Apr-22,INV-004,PPH 4 AYAT 2 konstruksi pelaksanaan',
    ].join('\n');

    const summary = await importPph26WholesaleFile(makeFile(csv));
    expect(summary.imported).toBe(0);
    expect(summary.skippedByTaxType).toBe(2);
    expect(summary.skippedByValidation).toBe(0);
    expect(summary.csvContent.split('\n').length).toBe(1); // header only
  });

  it('classifies PPh26 row with no recognisable sub-transaction as OTHER', async () => {
    const csv = [
      'Biz Name,NPWP,Sub Transaction,Transaction Desc,Invoice Amount,Invoice Date,Invoice No,Type of Tax',
      'OFFSHORE LLC,,Misc payment,Some unknown,5000000,20-Jan-22,INV-X,PPH 26',
    ].join('\n');

    const summary = await importPph26WholesaleFile(makeFile(csv));
    expect(summary.imported).toBe(1);
    expect(summary.csvContent).toContain('OTHER');
    expect(summary.csvContent).toContain('OFFSHORE LLC');
  });

  it('throws Pph26ColumnMapError when required columns missing', async () => {
    const csv = 'foo,bar\n1,2\n';
    await expect(importPph26WholesaleFile(makeFile(csv))).rejects.toThrow(
      Pph26ColumnMapError,
    );
  });
});
