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

// 팝업 상세의 수정 이력 항목 (row-review PATCH 가 누적)
export interface OperatorEditEntry { from: unknown; to: unknown; by: string; role: 'COUNSELOR' | 'SUPERVISOR'; at: string }
export type OperatorEdits = Record<string, OperatorEditEntry>;

export interface Pph21Row {
  payslipId: string; employeeId: string; name: string; npwp: string | null;
  ptkp: string; terCategory: string; totalGross: number; bpjs: number; thr: number;
  pph21: number; payslipStatus: string;
  // 직원 정보 (읽기 카드 — 수정요청 45 고객화면 parity)
  employeeNumber: string | null; nik: string | null; employmentStatus: string | null;
  workerType: string | null; position: string | null; department: string | null;
  // 근태
  workingDays: number; absentDays: number; overtimeHours: number;
  // 기본급 + 수당
  baseSalary: number; overtimePay: number; mealAllowance: number; transportAllowance: number;
  positionAllowance: number; otherAllowances: number; laptopAllowance: number;
  medicalAllowance: number; taxAllowance: number; annualLeavePay: number;
  // 특수 지급
  severanceAllowance: number; pkwtCompensation: number;
  // 보너스
  bonusOnly: number; thrOnly: number; commission: number;
  // 공제
  bpjsKesehatan: number; bpjsKetenagakerjaan: number; jhtEmployee: number; jpEmployee: number;
  loanDeduction: number; otherDeductions: number;
  // 자동 계산 / 회사 부담
  netSalary: number; bpjsKesCompany: number; jkkCompany: number; jkmCompany: number;
  jhtCompany: number; jpCompany: number;
  reviewedAt: string | null;
  operatorEdits: OperatorEdits | null;
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

// 세목 탭 (수정요청 58 — 워크큐/발행보드/인박스 공용 사이드바에서 동일하게 사용).
export const TAX_TABS: Array<{ key: TaxView; label: string; icon: string }> = [
  { key: 'pph21', label: '개인소득세', icon: '🧑‍💼' },
  { key: 'withholding', label: '원천세', icon: '✂️' },
  { key: 'umkm', label: '선납법인세', icon: '🏢' },
  { key: 'ppn', label: '부가세', icon: '🧾' },
  { key: 'annual', label: '연 신고', icon: '📅' },
];

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
  dppNilaiLain: number;   // 수정요청 60 — 고객 PPN 화면 parity
  ppn: number;
  isLuxury: boolean;
  reconStatus: string | null;
  reviewedAt: string | null;
  operatorEdits: OperatorEdits | null;
  flags: { level: 'red' | 'amber' | 'green'; issues: string[]; label: string };
}
export interface PpnDetail {
  queueId: string; customerId: string; period: string; status: string;
  summary: { fakturCount: number; totalDpp: number; totalPpn: number; incompleteCount: number };
  rows: PpnRow[];
  coretax?: { id: string | null; hint: string | null }; // 수정요청 48·49 — Coretax 접속 자격증명
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
  invoiceNumber: string | null;
  serviceType: string | null;
  // 수정요청 59 — 고객 PPh23 화면 parity
  counterpartyAddress: string | null;
  invoiceDate: string | null;
  paymentDate: string | null;
  notes: string | null;
  buktiPotongNumber: string | null;
  buktiPotongDate: string | null;
  reviewedAt: string | null;
  operatorEdits: OperatorEdits | null;
  flags: { level: 'red' | 'amber' | 'green'; issues: string[]; label: string };
}
export interface WithholdingDetail {
  queueId: string; customerId: string; period: string; status: string;
  summary: { txnCount: number; totalGross: number; totalTax: number; incompleteCount: number };
  rows: WithholdingRow[];
}

// 검토 상태 표기 (수정요청 7·14·20번): 완료 / 미확인 / 이슈.
// green = 확인 완료, amber = 아직 확인 안 됨, red = 이슈 있음.
export const reviewStateText = (level: string): string =>
  level === 'green' ? '완료' : level === 'red' ? '이슈' : '미확인';
