export interface UmkmReviewInput {
  status: string | null; // UNPAID | PAID | OVERDUE | PARTIAL
  amountDue: number;
}

export type ReviewLevel = 'red' | 'amber' | 'green';

export interface UmkmFlags {
  level: ReviewLevel;
  issues: string[]; // fixed order tokens: '미납' | '연체' | '부분납' | '미계산'
  label: string;
}

const STATUS_TOKEN: Record<string, string> = {
  UNPAID: '미납',
  OVERDUE: '연체',
  PARTIAL: '부분납',
};

export function evaluateUmkmFlags(input: UmkmReviewInput): UmkmFlags {
  const issues: string[] = [];
  const statusToken = input.status ? STATUS_TOKEN[input.status] : undefined;
  if (statusToken) issues.push(statusToken);
  if (input.amountDue <= 0) issues.push('미계산');

  if (issues.length > 0) {
    return { level: 'red', issues, label: `${issues.join('·')} 확인 필요` };
  }
  return { level: 'green', issues: [], label: '확인 완료' };
}
