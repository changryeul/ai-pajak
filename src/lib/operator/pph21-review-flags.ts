export interface PayslipReviewInput {
  employeeNpwp: string | null;
  // 직원부담 BPJS 공제
  bpjsKesehatan: number;
  bpjsKetenagakerjaan: number;
  // 직원부담 BPJS Ketenagakerjaan 상세(JHT/JP) — gross 방식에서 여기 들어갈 수 있음
  jhtEmployee?: number;
  jpEmployee?: number;
  // 회사부담 BPJS — Gross-up(회사가 세금·BPJS 부담) 시 직원부담은 0이고 여기만 채워짐.
  // 회사부담분이 있으면 BPJS 는 "설정됨"으로 보고 플래그를 띄우지 않는다.
  bpjsCompany?: number;
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
  // BPJS 는 직원부담·회사부담(gross-up) 어디에도 값이 없을 때만 "필요"로 표기.
  // Gross-up(회사가 세금·BPJS 부담)은 직원부담이 0이어도 회사부담분이 채워지므로 정상.
  const bpjsTotal =
    (input.bpjsKesehatan || 0) + (input.bpjsKetenagakerjaan || 0)
    + (input.jhtEmployee || 0) + (input.jpEmployee || 0)
    + (input.bpjsCompany || 0);
  if (bpjsTotal <= 0) issues.push('BPJS');

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
