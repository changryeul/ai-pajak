import { describe, it, expect } from 'vitest';
import { evaluateWithholdingFlags, type WithholdingReviewInput } from '../withholding-review-flags';

const clean: WithholdingReviewInput = {
  counterpartyNpwp: '01.234.567.8-901.000',
  counterpartyId: 'cp-1',
  taxAmount: 150000,
  taxRate: 0.02,
  hasInvoicePhoto: true,
};

describe('evaluateWithholdingFlags', () => {
  it('marks a fully clean transaction green', () => {
    const r = evaluateWithholdingFlags(clean);
    expect(r.level).toBe('green');
    expect(r.issues).toEqual([]);
    expect(r.label).toBe('확인 완료');
  });

  it('flags missing counterparty NPWP as red', () => {
    const r = evaluateWithholdingFlags({ ...clean, counterpartyNpwp: '  ' });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('NPWP');
    expect(r.label).toBe('NPWP 확인 필요');
  });

  it('flags missing invoice photo as red', () => {
    const r = evaluateWithholdingFlags({ ...clean, hasInvoicePhoto: false });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('증빙');
    expect(r.label).toBe('증빙 확인 필요');
  });

  it('flags zero tax amount or rate as red', () => {
    expect(evaluateWithholdingFlags({ ...clean, taxAmount: 0 }).issues).toContain('세액');
    expect(evaluateWithholdingFlags({ ...clean, taxRate: 0 }).issues).toContain('세액');
  });

  it('flags unmatched counterparty as red', () => {
    const r = evaluateWithholdingFlags({ ...clean, counterpartyId: null });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('거래처');
  });

  it('combines multiple issues into one label in fixed order', () => {
    const r = evaluateWithholdingFlags({
      ...clean, counterpartyNpwp: null, hasInvoicePhoto: false, taxAmount: 0, counterpartyId: null,
    });
    expect(r.level).toBe('red');
    expect(r.issues).toEqual(['NPWP', '증빙', '세액', '거래처']);
    expect(r.label).toBe('NPWP·증빙·세액·거래처 확인 필요');
  });
});
