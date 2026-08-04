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

// taxView(사이드바) → djp_submission_queue.tax_type
export const TAX_VIEW_TO_TYPE: Record<string, string> = {
  pph21: 'PPh21',
  withholding: 'PPh23',
  ppn: 'PPN',
  umkm: 'PPh_FINAL',
  annual: 'SPT_TAHUNAN',
  // 직원 마스터는 고객 단위 — worklist 는 PPh21 큐 행을 공유한다.
  employees: 'PPh21',
};

export interface EmployeeHrRow {
  id: string;
  name: string;
  employeeNumber: string | null;
  npwp: string | null;
  nik: string | null;
  ptkp: string | null;
  hireDate: string | null;
  isActive: boolean;
  grossSalary: number;
  position: string | null;
  department: string | null;
  flags: { level: 'red' | 'amber' | 'green'; issues: string[]; label: string };
}
export interface EmployeeHrChange {
  id: string;
  employeeName: string;
  section: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}
export interface EmployeeHrDetail {
  queueId: string; customerId: string; period: string; status: string;
  summary: { employeeCount: number; activeCount: number; noNpwpCount: number; issueCount: number };
  rows: EmployeeHrRow[];
  changeLog: EmployeeHrChange[];
}

export interface AnnualDocRow {
  id: string;
  docType: string;
  fileName: string;
  uploadedAt: string;
  sizeBytes: number | null;
}
export interface AnnualDetail {
  queueId: string; customerId: string; fiscalYear: number; status: string;
  summary: {
    closingType: 'UMKM' | 'PPH25' | null;
    serviceLabel: string | null;
    fiscalYear: number;
    currentStep: string | null;
    sessionStatus: string | null;
    signedStatementsUploaded: boolean;
    documentCount: number;
    submissionStatus: string | null;
    submissionChannel: string | null;
    submittedAt: string | null;
    bpeNumber: string | null;
    ntpn: string | null;
  };
  flags: { level: 'red' | 'amber' | 'green'; issues: string[]; label: string };
  rows: AnnualDocRow[];
}

export interface UmkmRow {
  id: string;
  taxType: 'PPh_FINAL' | 'PPh25';
  amountDue: number;
  amountPaid: number;
  penaltyAmount: number;
  kodeBilling: string | null;
  paymentStatus: string | null;
  paymentDeadline: string | null;
  reportingDeadline: string | null;
  flags: { level: 'red' | 'amber' | 'green'; issues: string[]; label: string };
}
export interface UmkmDetail {
  queueId: string; customerId: string; period: string; status: string;
  summary: { recordCount: number; totalDue: number; totalPaid: number; totalPenalty: number; incompleteCount: number };
  rows: UmkmRow[];
}

export interface PpnRow {
  id: string;
  fakturType: 'KELUARAN' | 'MASUKAN';
  fakturNumber: string | null;
  fakturDate: string | null;
  counterpartyName: string;
  counterpartyNpwp: string | null;
  dpp: number;
  ppn: number;
  isLuxury: boolean;
  reconStatus: string | null;
  flags: { level: 'red' | 'amber' | 'green'; issues: string[]; label: string };
}
export interface PpnDetail {
  queueId: string; customerId: string; period: string; status: string;
  summary: { fakturCount: number; totalDpp: number; totalPpn: number; incompleteCount: number };
  rows: PpnRow[];
}

export interface WithholdingRow {
  id: string;
  regime: 'PPH23' | 'PPH4_2';
  counterpartyName: string;
  counterpartyNpwp: string | null;
  transactionDate: string | null;
  description: string;
  incomeType: string;
  grossAmount: number;
  taxRate: number;
  taxAmount: number;
  hasInvoicePhoto: boolean;
  flags: { level: 'red' | 'amber' | 'green'; issues: string[]; label: string };
}
export interface WithholdingDetail {
  queueId: string; customerId: string; period: string; status: string;
  summary: { txnCount: number; totalGross: number; totalTax: number; incompleteCount: number };
  rows: WithholdingRow[];
}
