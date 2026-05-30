import { describe, it, expect } from 'vitest';
import {
  detectHeaderRow,
  mapColumns,
  classifyTaxType,
  parseAmount,
  parseIndoDate,
  classifyServiceType,
  ColumnMapError,
  importWholesaleFile,
} from '../pph23-wholesale-importer';

describe('detectHeaderRow', () => {
  it('returns 0 when no hints match', () => {
    expect(detectHeaderRow([['foo', 'bar'], ['x', 'y']])).toBe(0);
  });

  it('finds header at row 2 in a 3-row meta layout', () => {
    const rows = [
      ['Input Data', '', 'expected'],
      ['Opp Company Info', 'My Co', 'VAT'],
      ['Biz Name', 'NPWP', 'Invoice Amount'],
      ['PT X', '01.000', '100000'],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it('requires at least 2 hints', () => {
    expect(detectHeaderRow([['x', 'y'], ['Biz Name', 'foo']])).toBe(0);
  });
});

describe('mapColumns', () => {
  it('maps the sample wholesale header correctly', () => {
    const header = [
      'Biz Name', 'Type of', 'NPWP', 'Biz Type', 'Biz No',
      'Biz Name', 'NPWP', 'Biz Type', 'Biz No',
      'Transaction Desc', 'Sub Transaction', 'Invoice Amount IDR',
      'Invoice Date', 'Invoice No', 'Tax Base IDR', 'Tax Method',
      'IDR', 'Type of Tax', 'Tax Rate', 'IDR', 'Type of Tax', 'Tax Rate',
    ];
    const map = mapColumns(header);
    expect(map.opp_biz_name).toBe(0);
    expect(map.opp_npwp).toBe(2);
    expect(map.invoice_amount).toBe(11);
    expect(map.invoice_date).toBe(12);
    expect(map.invoice_no).toBe(13);
    expect(map.transaction_desc).toBe(9);
    expect(map.sub_transaction).toBe(10);
    expect(map.type_of_tax).toBe(20);
  });

  it('throws ColumnMapError with missing list', () => {
    expect(() => mapColumns(['name', 'foo'])).toThrow(ColumnMapError);
    try {
      // 'name' alone now satisfies the biz-name slot (synonym added for real
      // customer files that use NAME instead of Biz Name) — so missing list
      // is the other 3 required columns.
      mapColumns(['name']);
    } catch (e) {
      expect(e).toBeInstanceOf(ColumnMapError);
      expect((e as ColumnMapError).missing).toEqual(
        expect.arrayContaining(['Invoice Amount', 'Invoice Date', 'Type of Tax']),
      );
    }
  });
});

describe('classifyTaxType', () => {
  it('PPH 23 Jasa', () => expect(classifyTaxType('PPH 23 Jasa')).toBe('pph23_jasa'));
  it('PPH 23 Sewa', () => expect(classifyTaxType('PPH 23 Sewa')).toBe('pph23_sewa'));
  it('PPH 23 alone (no subtype)', () => expect(classifyTaxType('PPH 23')).toBe('pph23_jasa'));
  it('PPH 4 AYAT 2 konstruksi', () => expect(classifyTaxType('PPH 4 AYAT 2 konstruksi pelaksanaan')).toBe('pph4_2'));
  it('PPh 26', () => expect(classifyTaxType('PPh 26')).toBe('pph26'));
  it('PPH 21 Bukan Pegawai', () => expect(classifyTaxType('PPH 21 Bukan Pegawai 50%')).toBe('pph21bp'));
  it('empty', () => expect(classifyTaxType('')).toBe('unknown'));
  it('garbage', () => expect(classifyTaxType('SOME OTHER TAX')).toBe('unknown'));
  it('PP 26 (missing H) → unknown', () => expect(classifyTaxType('PP 26')).toBe('unknown'));
});

describe('parseAmount', () => {
  it('strips spaces + commas', () => expect(parseAmount(' 16,902,630 ')).toBe(16902630));
  it('strips Indo-style periods', () => expect(parseAmount('16.902.630')).toBe(16902630));
  it('plain digits', () => expect(parseAmount('16902630')).toBe(16902630));
  it('zero', () => expect(parseAmount('0')).toBe(0));
  it('empty -> NaN', () => expect(Number.isNaN(parseAmount(''))).toBe(true));
  it('letters -> NaN', () => expect(Number.isNaN(parseAmount('abc'))).toBe(true));
  it('mixed -> NaN', () => expect(Number.isNaN(parseAmount('123abc'))).toBe(true));
});

describe('parseIndoDate', () => {
  it('DD-MMM-YY', () => expect(parseIndoDate('20-Jan-22')).toBe('2022-01-20'));
  it('DD-MMM-YYYY', () => expect(parseIndoDate('20-Jan-2022')).toBe('2022-01-20'));
  it('DD/MM/YYYY', () => expect(parseIndoDate('20/1/2022')).toBe('2022-01-20'));
  it('DD-MM-YYYY', () => expect(parseIndoDate('20-01-2022')).toBe('2022-01-20'));
  it('DD/MM/YY <=30', () => expect(parseIndoDate('20/1/25')).toBe('2025-01-20'));
  it('DD/MM/YY >30 -> 19YY', () => expect(parseIndoDate('20/1/85')).toBe('1985-01-20'));
  it('ISO passthrough', () => expect(parseIndoDate('2022-01-20')).toBe('2022-01-20'));
  it('invalid day -> null', () => expect(parseIndoDate('32-Jan-22')).toBeNull());
  it('invalid month -> null', () => expect(parseIndoDate('20/13/22')).toBeNull());
  it('garbage -> null', () => expect(parseIndoDate('not a date')).toBeNull());
  it('empty -> null', () => expect(parseIndoDate('')).toBeNull());
});

describe('classifyServiceType', () => {
  it('Sewa', () => expect(classifyServiceType('PPH 23 Sewa', '', '')).toBe('SEWA'));
  it('Jasa Manajemen via sub', () => expect(classifyServiceType('PPH 23 Jasa', 'Jasa Management', '')).toBe('JASA_MANAJEMEN'));
  it('Jasa Konsultan via sub', () => expect(classifyServiceType('PPH 23 Jasa', 'Jasa Konsultan', '')).toBe('JASA_KONSULTAN'));
  it('Jasa Teknik via desc (internet)', () => expect(classifyServiceType('PPH 23 Jasa', 'Jasa internet', 'Pembayaran Tagihan Internet')).toBe('JASA_TEKNIK'));
  it('Jasa Teknik via desc (telekom)', () => expect(classifyServiceType('PPH 23 Jasa', '', 'Jasa Telekomunikasi')).toBe('JASA_TEKNIK'));
  it('Jasa Lainnya fallback', () => expect(classifyServiceType('PPH 23 Jasa', 'Unknown service', 'desc')).toBe('JASA_LAINNYA'));
  it('Jasa Lainnya with empty inputs', () => expect(classifyServiceType('PPH 23 Jasa', '', '')).toBe('JASA_LAINNYA'));
});

describe('importWholesaleFile (end-to-end)', () => {
  class NodeFile {
    name: string;
    private buf: Uint8Array;
    constructor(content: string, name: string) {
      this.buf = new TextEncoder().encode(content);
      this.name = name;
    }
    async text() { return new TextDecoder().decode(this.buf); }
    async arrayBuffer() { return this.buf.buffer.slice(this.buf.byteOffset, this.buf.byteOffset + this.buf.byteLength); }
  }

  function makeFile(csv: string, name = 'fixture.csv'): File {
    return new NodeFile(csv, name) as unknown as File;
  }

  it('imports a mixed-tax-type fixture and reports accurate counts', async () => {
    // Header at row 0, no meta — exercises detectHeaderRow fallback to 0.
    const csv = [
      'Biz Name,NPWP,Sub Transaction,Transaction Desc,Invoice Amount,Invoice Date,Invoice No,Type of Tax',
      // 3 valid PPh23 rows
      'PT TELEKOM,01.000.013.1-093.000,Jasa internet,Internet Jan 2022,553874,20-Jan-22,INV-001,PPH 23 Jasa',
      'PT KONSULTAN,02.000.022.2-022.000,Jasa Konsultan,Strategy advice,10000000,15-Feb-22,INV-002,PPH 23 Jasa',
      'CV SEWA GEDUNG,03.000.033.3-033.000,Sewa,Office rent,5000000,01-Mar-22,INV-003,PPH 23 Sewa',
      // 2 skipped by tax type
      'PT KONSTRUKSI,04.000.044.4-044.000,Konstruksi,Bangunan,20000000,10-Apr-22,INV-004,PPH 4 AYAT 2 konstruksi pelaksanaan',
      'PT NONRESIDENT,05.000.055.5-055.000,Royalti,License fee,7500000,20-May-22,INV-005,PPh 26',
      // 3 skipped by validation
      ',06.000.066.6-066.000,Jasa,Missing name,1000000,20-Jun-22,INV-006,PPH 23 Jasa',
      'PT BAD AMOUNT,07.000.077.7-077.000,Jasa,Bad amount,abc,20-Jul-22,INV-007,PPH 23 Jasa',
      'PT BAD DATE,08.000.088.8-088.000,Jasa,Bad date,1000000,not-a-date,INV-008,PPH 23 Jasa',
    ].join('\n');

    const summary = await importWholesaleFile(makeFile(csv));
    expect(summary.imported).toBe(3);
    expect(summary.skippedByTaxType).toBe(2);
    expect(summary.skippedByValidation).toBe(3);
    expect(summary.errors.map(e => e.reason).sort()).toEqual([
      'invalid date format: not-a-date',
      'invalid gross_amount',
      'missing counterparty_name',
    ].sort());

    // csvContent header is the canonical PPh23 schema
    const csvLines = summary.csvContent.split('\n');
    expect(csvLines[0]).toBe('transaction_date,service_type,gross_amount,counterparty_name,counterparty_npwp,invoice_number,description');
    // First data row reflects normalization: date converted, amount as number string, service_type classified
    expect(csvLines[1]).toContain('2022-01-20');
    expect(csvLines[1]).toContain('JASA_TEKNIK'); // 'internet' keyword
    expect(csvLines[1]).toContain('553874');
    expect(csvLines[1]).toContain('PT TELEKOM');
    // Sewa row classifies as SEWA regardless of sub-transaction
    expect(csvLines.some(l => l.includes('SEWA') && l.includes('CV SEWA GEDUNG'))).toBe(true);
    // Konsultan row
    expect(csvLines.some(l => l.includes('JASA_KONSULTAN') && l.includes('PT KONSULTAN'))).toBe(true);
  });

  it('returns empty summary when fixture has only non-PPh23 rows', async () => {
    const csv = [
      'Biz Name,NPWP,Sub Transaction,Transaction Desc,Invoice Amount,Invoice Date,Invoice No,Type of Tax',
      'PT KONSTRUKSI,04.000.044.4-044.000,Konstruksi,Bangunan,20000000,10-Apr-22,INV-004,PPH 4 AYAT 2 konstruksi pelaksanaan',
      'PT NONRESIDENT,05.000.055.5-055.000,Royalti,License fee,7500000,20-May-22,INV-005,PPh 26',
    ].join('\n');

    const summary = await importWholesaleFile(makeFile(csv));
    expect(summary.imported).toBe(0);
    expect(summary.skippedByTaxType).toBe(2);
    expect(summary.skippedByValidation).toBe(0);
    expect(summary.csvContent.split('\n').length).toBe(1); // header only, no data lines
  });

  it('throws ColumnMapError when required columns missing', async () => {
    const csv = 'foo,bar\n1,2\n';
    await expect(importWholesaleFile(makeFile(csv))).rejects.toThrow(ColumnMapError);
  });
});
