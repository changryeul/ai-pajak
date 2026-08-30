import { describe, it, expect } from 'vitest';
import { evaluatePph21EmployeeFlags, type PayslipReviewInput } from '../pph21-review-flags';

const base: PayslipReviewInput = {
  employeeNpwp: '70.505.712.3-016.000',
  bpjsKesehatan: 100000,
  bpjsKetenagakerjaan: 50000,
  payslipStatus: 'DRAFT',
};

describe('evaluatePph21EmployeeFlags', () => {
  it('flags missing NPWP as red', () => {
    const r = evaluatePph21EmployeeFlags({ ...base, employeeNpwp: null });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('NPWP');
    expect(r.label).toBe('NPWP 확인 필요');
  });

  it('flags missing BPJS as red', () => {
    const r = evaluatePph21EmployeeFlags({ ...base, bpjsKesehatan: 0, bpjsKetenagakerjaan: 0 });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('BPJS');
    expect(r.label).toBe('BPJS 필요');
  });

  it('combines NPWP and BPJS into one label', () => {
    const r = evaluatePph21EmployeeFlags({ ...base, employeeNpwp: '   ', bpjsKesehatan: 0, bpjsKetenagakerjaan: 0 });
    expect(r.level).toBe('red');
    expect(r.label).toBe('NPWP·BPJS 필요');
  });

  it('does NOT flag BPJS when company bears it (Gross-up) — employee 0, company > 0', () => {
    const r = evaluatePph21EmployeeFlags({
      ...base, bpjsKesehatan: 0, bpjsKetenagakerjaan: 0, jhtEmployee: 0, jpEmployee: 0, bpjsCompany: 331845,
    });
    expect(r.issues).not.toContain('BPJS');
    expect(r.level).toBe('amber'); // NPWP 있고 BPJS 인정 → DRAFT 검토 필요
  });

  it('flags BPJS only when neither employee nor company BPJS exists', () => {
    const r = evaluatePph21EmployeeFlags({
      ...base, bpjsKesehatan: 0, bpjsKetenagakerjaan: 0, jhtEmployee: 0, jpEmployee: 0, bpjsCompany: 0,
    });
    expect(r.issues).toContain('BPJS');
    expect(r.label).toBe('BPJS 필요');
  });

  it('marks FINALIZED clean payslip as green 확인 완료', () => {
    const r = evaluatePph21EmployeeFlags({ ...base, payslipStatus: 'FINALIZED' });
    expect(r.level).toBe('green');
    expect(r.label).toBe('확인 완료');
    expect(r.issues).toEqual([]);
  });

  it('marks FILED clean payslip as green 확인 완료', () => {
    const r = evaluatePph21EmployeeFlags({ ...base, payslipStatus: 'FILED' });
    expect(r.level).toBe('green');
    expect(r.label).toBe('확인 완료');
    expect(r.issues).toEqual([]);
  });

  it('marks DRAFT clean payslip as amber 검토 필요', () => {
    const r = evaluatePph21EmployeeFlags(base);
    expect(r.level).toBe('amber');
    expect(r.label).toBe('검토 필요');
  });
});
