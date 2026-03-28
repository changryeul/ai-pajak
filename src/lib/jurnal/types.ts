/**
 * Jurnal.id (Mekari) Integration Types
 *
 * Jurnal.id is Indonesia's leading cloud accounting software.
 * Part of Mekari ecosystem (Jurnal, Talenta, KlikPajak, Qontak).
 * API: https://api.jurnal.id/core/api/v1
 */

export interface JurnalAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface JurnalAuthToken {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: Date;
  companyId: number;
  companyName: string;
}

export interface JurnalCompany {
  id: number;
  name: string;
  industry: string;
  taxNumber?: string; // NPWP
  address?: string;
  currency: string;
}

export interface JurnalAccount {
  id: number;
  name: string;
  number: string;
  category: string;
  balance: number;
}

export interface JurnalContact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  taxNumber?: string; // NPWP
  type: 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE';
  balance: number;
}

export interface JurnalTransaction {
  id: number;
  transactionNo: string;
  transactionDate: string;
  dueDate?: string;
  contactName: string;
  contactId: number;
  category: string;
  amount: number;
  status: string;
  memo?: string;
  lineItems: JurnalLineItem[];
}

export interface JurnalLineItem {
  accountId: number;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  taxName?: string;
  taxRate?: number;
  taxAmount?: number;
}

export interface JurnalFinancialReport {
  reportType: 'PROFIT_LOSS' | 'BALANCE_SHEET' | 'CASH_FLOW' | 'TRIAL_BALANCE';
  startDate: string;
  endDate: string;
  currency: string;
  sections: JurnalReportSection[];
  totals: Record<string, number>;
}

export interface JurnalReportSection {
  name: string;
  accounts: Array<{
    accountNumber: string;
    accountName: string;
    amount: number;
  }>;
  subtotal: number;
}

export interface JurnalSalesInvoice {
  id: number;
  invoiceNo: string;
  customerName: string;
  customerTaxNumber?: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';
  items: Array<{
    productName: string;
    quantity: number;
    rate: number;
    amount: number;
    taxRate: number;
    taxAmount: number;
  }>;
}

export interface JurnalPayrollData {
  employeeId: number;
  employeeName: string;
  period: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  grossPay: number;
  tax: number;
  netPay: number;
}

export type JurnalSyncStatus = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'FAILED';

export interface JurnalConnection {
  companyId: number;
  companyName: string;
  isActive: boolean;
  lastSyncAt?: string;
  syncStatus: JurnalSyncStatus;
}
