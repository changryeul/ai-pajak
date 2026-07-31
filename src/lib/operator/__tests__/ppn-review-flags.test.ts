import { describe, it, expect } from 'vitest';
import { evaluatePpnFlags, type PpnReviewInput } from '../ppn-review-flags';

const clean: PpnReviewInput = {
  reconStatus: 'MATCH',
  fakturNumber: '010.000-24.00000001',
  counterpartyNpwp: '01.234.567.8-901.000',
};

describe('evaluatePpnFlags', () => {
  it('marks a matched, complete faktur green', () => {
    const r = evaluatePpnFlags(clean);
    expect(r.level).toBe('green');
    expect(r.issues).toEqual([]);
    expect(r.label).toBe('확인 완료');
  });

  it('does not flag Coretax when not yet reconciled (PENDING/null)', () => {
    expect(evaluatePpnFlags({ ...clean, reconStatus: 'PENDING' }).level).toBe('green');
    expect(evaluatePpnFlags({ ...clean, reconStatus: null }).level).toBe('green');
  });

  it('flags DIFF as red Coretax', () => {
    const r = evaluatePpnFlags({ ...clean, reconStatus: 'DIFF' });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('Coretax');
    expect(r.label).toBe('Coretax 확인 필요');
  });

  it('flags MISSING_CORETAX and MISSING_CUSTOMER as red Coretax', () => {
    expect(evaluatePpnFlags({ ...clean, reconStatus: 'MISSING_CORETAX' }).issues).toContain('Coretax');
    expect(evaluatePpnFlags({ ...clean, reconStatus: 'MISSING_CUSTOMER' }).issues).toContain('Coretax');
  });

  it('flags missing faktur number and missing NPWP', () => {
    expect(evaluatePpnFlags({ ...clean, fakturNumber: '  ' }).issues).toContain('faktur');
    expect(evaluatePpnFlags({ ...clean, counterpartyNpwp: null }).issues).toContain('NPWP');
  });

  it('combines multiple issues into one label in fixed order', () => {
    const r = evaluatePpnFlags({ reconStatus: 'DIFF', fakturNumber: null, counterpartyNpwp: '' });
    expect(r.level).toBe('red');
    expect(r.issues).toEqual(['Coretax', 'faktur', 'NPWP']);
    expect(r.label).toBe('Coretax·faktur·NPWP 확인 필요');
  });
});
