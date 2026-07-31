export type TaxView = 'pph21' | 'withholding' | 'umkm' | 'ppn' | 'annual' | 'employees' | 'billing';
export type StatusFilter = '' | 'unreviewed' | 'inReview' | 'request' | 'reviewed';

// djp_submission_queue.status → 목업 라벨
export const STATUS_LABEL_MAP: Record<string, StatusFilter> = {
  PENDING: 'unreviewed',
  DATA_REVIEW: 'inReview',
  PENDING_DOCS: 'request',
  PENDING_APPROVAL: 'reviewed',
};

export interface QueueListItem {
  id: string;
  customer_id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number | null;
  status: string;
  customer: { id: string; customer_name: string; npwp: string | null; customer_type: string } | null;
}

export interface Pph21Row {
  payslipId: string; employeeId: string; name: string; npwp: string | null;
  ptkp: string; terCategory: string; totalGross: number; bpjs: number; thr: number;
  pph21: number; payslipStatus: string;
  flags: { level: 'red' | 'amber' | 'green'; issues: string[]; label: string };
}
export interface Pph21Detail {
  queueId: string; customerId: string; period: string; status: string;
  summary: { employeeCount: number; totalGross: number; totalPph21: number; incompleteCount: number };
  rows: Pph21Row[];
}
