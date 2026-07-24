import { describe, it, expect } from 'vitest';
import { reconcile, type CustomerFaktur, type CoretaxFaktur } from '../ppn-reconcile';

const cust = (id: string, fakturNumber: string | null, dpp: number, ppn: number, fakturType = 'KELUARAN'): CustomerFaktur =>
  ({ id, fakturType, fakturNumber, dpp, ppn });
const core = (fakturNumber: string, dpp: number, ppn: number, fakturType = 'KELUARAN'): CoretaxFaktur =>
  ({ fakturType, fakturNumber, dpp, ppn });

describe('ppn reconcile', () => {
  it('matches identical faktur', () => {
    const r = reconcile([cust('1', 'FP001', 1000, 110)], [core('FP001', 1000, 110)]);
    expect(r.updates[0].reconStatus).toBe('MATCH');
    expect(r.updates[0].coretaxDpp).toBe(1000);
    expect(r.summary.match).toBe(1);
  });

  it('flags DIFF when amounts differ', () => {
    const r = reconcile([cust('1', 'FP001', 1000, 110)], [core('FP001', 1200, 132)]);
    expect(r.updates[0].reconStatus).toBe('DIFF');
    expect(r.summary.diff).toBe(1);
  });

  it('flags MISSING_CORETAX when customer faktur absent from Coretax', () => {
    const r = reconcile([cust('1', 'FP001', 1000, 110)], []);
    expect(r.updates[0].reconStatus).toBe('MISSING_CORETAX');
    expect(r.summary.missingCoretax).toBe(1);
  });

  it('lists Coretax-only faktur as MISSING_CUSTOMER', () => {
    const r = reconcile([], [core('FP999', 500, 55)]);
    expect(r.coretaxOnly).toHaveLength(1);
    expect(r.coretaxOnly[0].fakturNumber).toBe('FP999');
    expect(r.summary.missingCustomer).toBe(1);
  });

  it('separates matching by faktur type (KELUARAN vs MASUKAN)', () => {
    const r = reconcile(
      [cust('1', 'FP001', 1000, 110, 'KELUARAN')],
      [core('FP001', 1000, 110, 'MASUKAN')],
    );
    // same number but different type → no match
    expect(r.updates[0].reconStatus).toBe('MISSING_CORETAX');
    expect(r.summary.missingCustomer).toBe(1);
  });

  it('absorbs rounding within Rp 1', () => {
    const r = reconcile([cust('1', 'FP001', 1000.4, 110.2)], [core('FP001', 1000, 110)]);
    expect(r.updates[0].reconStatus).toBe('MATCH');
  });

  it('treats numberless customer rows as MISSING_CORETAX', () => {
    const r = reconcile([cust('1', null, 1000, 110)], [core('FP001', 1000, 110)]);
    expect(r.updates[0].reconStatus).toBe('MISSING_CORETAX');
  });
});
