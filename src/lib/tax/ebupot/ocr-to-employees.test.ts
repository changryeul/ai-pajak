import { describe, expect, it } from 'vitest';
import { mapClosingOcrToEmployees } from './ocr-to-employees';

describe('mapClosingOcrToEmployees', () => {
  it('returns empty when extracted is null', () => {
    const res = mapClosingOcrToEmployees(null);
    expect(res.source).toBe('none');
    expect(res.employees).toEqual([]);
  });

  it('returns empty for non-PAYROLL category', () => {
    const res = mapClosingOcrToEmployees({
      category: 'SALES_LIST',
      confidence: 0.9,
      lineItems: [{ description: 'PT A', amount: 1000, date: null }],
    });
    expect(res.source).toBe('none');
    expect(res.employees).toEqual([]);
  });

  it('prefers payrollRows over lineItems', () => {
    const res = mapClosingOcrToEmployees({
      category: 'PAYROLL',
      confidence: 0.85,
      lineItems: [{ description: 'salary line', amount: 1, date: null }],
      payrollRows: [
        {
          employeeName: 'Andi',
          npwp: '001234567890123',
          nik: '3201010101010001',
          ptkpCode: 'K1',
          grossSalary: 120_000_000,
          jht: 2_400_000,
          jp: 1_200_000,
        },
      ],
    });
    expect(res.source).toBe('payrollRows');
    expect(res.employees).toHaveLength(1);
    expect(res.employees[0].name).toBe('Andi');
    expect(res.employees[0].npwp).toBe('001234567890123');
    expect(res.employees[0].ptkp).toBe('K1');
    expect(res.employees[0].salary).toBe(120_000_000);
    expect(res.lowConfidence).toBe(false);
  });

  it('falls back to lineItems for older PAYROLL OCR runs', () => {
    const res = mapClosingOcrToEmployees({
      category: 'PAYROLL',
      confidence: 0.7,
      lineItems: [
        { description: 'Budi (Engineer)', amount: 96_000_000, date: null },
        { description: 'Citra (Manager)', amount: 180_000_000, date: null },
      ],
    });
    expect(res.source).toBe('lineItems');
    expect(res.employees).toHaveLength(2);
    expect(res.employees[0].name).toBe('Budi (Engineer)');
    expect(res.employees[0].salary).toBe(96_000_000);
    expect(res.employees[0].npwp).toBe('');
    expect(res.employees[0].ptkp).toBe('TK0');
  });

  it('marks lowConfidence when below threshold', () => {
    const res = mapClosingOcrToEmployees({
      category: 'PAYROLL',
      confidence: 0.4,
      payrollRows: [
        { employeeName: 'Dewi', npwp: null, nik: null, ptkpCode: null, grossSalary: 60_000_000, jht: null, jp: null },
      ],
    });
    expect(res.source).toBe('payrollRows');
    expect(res.lowConfidence).toBe(true);
    expect(res.employees[0].ptkp).toBe('TK0');
    expect(res.employees[0].npwp).toBe('');
    expect(res.employees[0].jht).toBe(0);
  });

  it('skips payrollRows with blank employeeName', () => {
    const res = mapClosingOcrToEmployees({
      category: 'PAYROLL',
      confidence: 0.9,
      payrollRows: [
        { employeeName: '', npwp: null, nik: null, ptkpCode: null, grossSalary: 1, jht: null, jp: null },
        { employeeName: 'Eka', npwp: null, nik: null, ptkpCode: 'TK0', grossSalary: 50_000_000, jht: null, jp: null },
      ],
    });
    expect(res.employees).toHaveLength(1);
    expect(res.employees[0].name).toBe('Eka');
  });
});
