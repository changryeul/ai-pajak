/**
 * Accurate Online Integration Types
 *
 * Type definitions for Accurate Online accounting software integration.
 * Accurate Online API: https://accurate.id/api-accurate-online/
 */

// ============================
// Auth
// ============================

export interface AccurateAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface AccurateAuthToken {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: Date;
  scope: string;
}

export interface AccurateSession {
  host: string; // API host for the user's database
  session: string; // Database session ID
}

// ============================
// Company / Database
// ============================

export interface AccurateDatabase {
  id: number;
  alias: string;
  companyName: string;
  description: string;
}

// ============================
// Employee / Payroll
// ============================

export interface AccurateEmployee {
  id: number;
  employeeNo: string;
  name: string;
  email?: string;
  phone?: string;
  npwp?: string;
  nik?: string;
  address?: string;
  department?: string;
  position?: string;
  joinDate?: string;
  ptkpStatus?: string;
  bankAccount?: string;
  bankName?: string;
  isActive: boolean;
}

export interface AccuratePayrollItem {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeNo: string;
  period: string; // YYYY-MM
  basicSalary: number;
  allowances: number;
  overtime: number;
  bonus: number;
  thr: number;
  grossIncome: number;
  bpjsKetenagakerjaan: number;
  bpjsKesehatan: number;
  pensionContribution: number;
  positionCost: number;
  pph21: number;
  netIncome: number;
  takeHomePay: number;
}

export interface AccuratePayrollSummary {
  period: string;
  totalEmployees: number;
  totalGrossIncome: number;
  totalPph21: number;
  totalBpjs: number;
  totalTakeHomePay: number;
  items: AccuratePayrollItem[];
}

// ============================
// Financial Statements
// ============================

export interface AccurateFinancialStatement {
  type: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';
  period: string; // YYYY or YYYY-MM
  currency: string;
  items: AccurateFinancialItem[];
  totals: Record<string, number>;
}

export interface AccurateFinancialItem {
  accountNo: string;
  accountName: string;
  category: string;
  amount: number;
  previousAmount?: number;
}

// ============================
// Invoices / Transactions
// ============================

export interface AccurateInvoice {
  id: number;
  invoiceNo: string;
  customerName: string;
  customerNpwp?: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'OVERDUE' | 'VOID';
  items: AccurateInvoiceItem[];
}

export interface AccurateInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate: number;
  taxAmount: number;
}

// ============================
// Sync Status
// ============================

export type SyncStatus = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'FAILED';

export interface AccurateSyncResult {
  status: SyncStatus;
  syncedAt: string;
  dataType: 'EMPLOYEES' | 'PAYROLL' | 'INVOICES' | 'FINANCIAL_STATEMENTS';
  recordsCount: number;
  errors: string[];
}

// ============================
// Connection
// ============================

export interface AccurateConnection {
  id: string;
  customerId: string;
  companyName: string;
  databaseId: number;
  databaseAlias: string;
  isActive: boolean;
  lastSyncAt?: string;
  syncStatus: SyncStatus;
  connectedAt: string;
}
