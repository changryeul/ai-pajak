export interface WithholdingReviewInput {
  counterpartyNpwp: string | null;
  counterpartyId: string | null;
  taxAmount: number;
  taxRate: number;
  hasInvoicePhoto: boolean;
}

export type ReviewLevel = 'red' | 'amber' | 'green';

export interface WithholdingFlags {
  level: ReviewLevel;
  issues: string[]; // fixed order tokens: 'NPWP' | '증빙' | '세액' | '거래처'
  label: string;
}

const isBlank = (v: string | null): boolean => !v || v.trim().length === 0;

export function evaluateWithholdingFlags(input: WithholdingReviewInput): WithholdingFlags {
  const issues: string[] = [];
  if (isBlank(input.counterpartyNpwp)) issues.push('NPWP');
  if (!input.hasInvoicePhoto) issues.push('증빙');
  if (input.taxAmount <= 0 || input.taxRate <= 0) issues.push('세액');
  if (isBlank(input.counterpartyId)) issues.push('거래처');

  if (issues.length > 0) {
    return { level: 'red', issues, label: `${issues.join('·')} 확인 필요` };
  }
  return { level: 'green', issues: [], label: '확인 완료' };
}
