export interface PayslipReviewInput {
  employeeNpwp: string | null;
  bpjsKesehatan: number;
  bpjsKetenagakerjaan: number;
  payslipStatus: string; // DRAFT | FINALIZED | FILED
}

export type ReviewLevel = 'red' | 'amber' | 'green';

export interface Pph21EmployeeFlags {
  level: ReviewLevel;
  issues: string[];   // machine tokens: 'NPWP' | 'BPJS'
  label: string;      // human label for the 이슈 column
}

const isBlank = (v: string | null): boolean => !v || v.trim().length === 0;

export function evaluatePph21EmployeeFlags(input: PayslipReviewInput): Pph21EmployeeFlags {
  const issues: string[] = [];
  if (isBlank(input.employeeNpwp)) issues.push('NPWP');
  if (input.bpjsKesehatan <= 0 && input.bpjsKetenagakerjaan <= 0) issues.push('BPJS');

  if (issues.length > 0) {
    const label =
      issues.length === 2 ? 'NPWP·BPJS 필요'
      : issues[0] === 'NPWP' ? 'NPWP 확인 필요'
      : 'BPJS 필요';
    return { level: 'red', issues, label };
  }

  if (input.payslipStatus === 'FINALIZED' || input.payslipStatus === 'FILED') {
    return { level: 'green', issues: [], label: '확인 완료' };
  }
  return { level: 'amber', issues: [], label: '검토 필요' };
}
