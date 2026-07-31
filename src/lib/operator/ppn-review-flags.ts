export interface PpnReviewInput {
  reconStatus: string | null; // MATCH | DIFF | MISSING_CORETAX | MISSING_CUSTOMER | PENDING | null
  fakturNumber: string | null;
  counterpartyNpwp: string | null;
}

export type ReviewLevel = 'red' | 'amber' | 'green';

export interface PpnFlags {
  level: ReviewLevel;
  issues: string[]; // fixed order tokens: 'Coretax' | 'faktur' | 'NPWP'
  label: string;
}

const isBlank = (v: string | null): boolean => !v || v.trim().length === 0;
const CORETAX_ISSUE = new Set(['DIFF', 'MISSING_CORETAX', 'MISSING_CUSTOMER']);

export function evaluatePpnFlags(input: PpnReviewInput): PpnFlags {
  const issues: string[] = [];
  if (input.reconStatus && CORETAX_ISSUE.has(input.reconStatus)) issues.push('Coretax');
  if (isBlank(input.fakturNumber)) issues.push('faktur');
  if (isBlank(input.counterpartyNpwp)) issues.push('NPWP');

  if (issues.length > 0) {
    return { level: 'red', issues, label: `${issues.join('·')} 확인 필요` };
  }
  return { level: 'green', issues: [], label: '확인 완료' };
}
