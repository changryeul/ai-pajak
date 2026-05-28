import { describe, it, expect } from 'vitest';
import {
  detectHeaderRow,
  mapColumns,
  classifyTaxType,
  parseAmount,
  parseIndoDate,
  classifyServiceType,
  ColumnMapError,
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
      mapColumns(['name']);
    } catch (e) {
      expect(e).toBeInstanceOf(ColumnMapError);
      expect((e as ColumnMapError).missing).toEqual(
        expect.arrayContaining(['Biz Name', 'Invoice Amount', 'Invoice Date', 'Type of Tax']),
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
