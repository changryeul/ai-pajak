import { describe, it, expect } from 'vitest';
import { evaluateEmployeeHrFlags } from '../employee-hr-flags';

const base = {
  ptkpCategory: 'K1',
  npwp: '012345678901234',
  nik: '3171234567890001',
  grossSalary: 10_000_000,
  hireDate: '2024-01-01',
  isActive: true,
};

describe('evaluateEmployeeHrFlags', () => {
  it('green for a complete active employee', () => {
    const f = evaluateEmployeeHrFlags(base);
    expect(f.level).toBe('green');
    expect(f.issues).toEqual([]);
    expect(f.label).toBe('정상');
  });

  it('accepts slashed PTKP notation (K/1, TK-2, KI 3)', () => {
    for (const p of ['K/1', 'TK-2', 'KI 3', 'tk0']) {
      expect(evaluateEmployeeHrFlags({ ...base, ptkpCategory: p }).level).toBe('green');
    }
  });

  it('red for invalid PTKP raw value', () => {
    const f = evaluateEmployeeHrFlags({ ...base, ptkpCategory: 'X9' });
    expect(f.level).toBe('red');
    expect(f.issues[0]).toContain('유효하지 않은 PTKP');
  });

  it('red for missing PTKP', () => {
    const f = evaluateEmployeeHrFlags({ ...base, ptkpCategory: null });
    expect(f.level).toBe('red');
    expect(f.issues).toContain('PTKP 미입력');
  });

  it('red for active employee with zero salary', () => {
    const f = evaluateEmployeeHrFlags({ ...base, grossSalary: 0 });
    expect(f.level).toBe('red');
    expect(f.issues).toContain('급여 미입력');
  });

  it('amber for missing NPWP (surcharge target)', () => {
    const f = evaluateEmployeeHrFlags({ ...base, npwp: null });
    expect(f.level).toBe('amber');
    expect(f.issues).toContain('무-NPWP (20% 가산)');
  });

  it('amber for missing NIK', () => {
    const f = evaluateEmployeeHrFlags({ ...base, nik: '' });
    expect(f.level).toBe('amber');
    expect(f.issues).toContain('NIK 미입력');
  });

  it('inactive employee skips salary/npwp/hire-date checks', () => {
    const f = evaluateEmployeeHrFlags({
      ...base, isActive: false, grossSalary: 0, npwp: null, hireDate: null,
    });
    expect(f.level).toBe('green');
  });

  it('red wins over amber, label is first issue', () => {
    const f = evaluateEmployeeHrFlags({ ...base, grossSalary: 0, npwp: null });
    expect(f.level).toBe('red');
    expect(f.label).toBe('급여 미입력');
  });
});
