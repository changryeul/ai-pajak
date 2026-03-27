/**
 * Banking Integration Types
 *
 * Supports Indonesian banks via Open Banking API (SNAP - Standar Nasional Open API Pembayaran)
 * and Brick/Finku aggregation services.
 */

export type BankProvider =
  | 'BCA'
  | 'MANDIRI'
  | 'BNI'
  | 'BRI'
  | 'CIMB'
  | 'DANAMON'
  | 'PERMATA'
  | 'OTHER';

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'ERROR';

export interface BankConnection {
  id: string;
  customerId: string;
  provider: BankProvider;
  accountNumber: string; // masked: ****1234
  accountName: string;
  connectionStatus: ConnectionStatus;
  lastSyncAt?: string;
  connectedAt: string;
  expiresAt?: string;
}

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balance: number;
  category?: TransactionCategory;
  reference?: string;
}

export type TransactionCategory =
  | 'REVENUE'        // Pendapatan usaha
  | 'EXPENSE'        // Pengeluaran usaha
  | 'SALARY'         // Gaji
  | 'TAX_PAYMENT'    // Pembayaran pajak
  | 'TRANSFER_IN'    // Transfer masuk
  | 'TRANSFER_OUT'   // Transfer keluar
  | 'LOAN'           // Pinjaman
  | 'OTHER';

export interface BankStatement {
  accountNumber: string;
  accountName: string;
  provider: BankProvider;
  period: string; // YYYY-MM
  openingBalance: number;
  closingBalance: number;
  totalCredit: number;
  totalDebit: number;
  transactionCount: number;
  transactions: BankTransaction[];
}

export interface MonthlyRevenueSummary {
  period: string; // YYYY-MM
  totalRevenue: number; // Total CREDIT categorized as REVENUE
  totalExpense: number;
  netIncome: number;
  transactionCount: number;
  pphFinal: number; // 0.5% of revenue (PPh Final UMKM)
}

export interface AnnualRevenueSummary {
  year: number;
  months: MonthlyRevenueSummary[];
  totalRevenue: number;
  totalPphFinal: number;
  isUmkmEligible: boolean; // Revenue < Rp 4.8B
  umkmExemption: number; // First Rp 500M exempt
  effectivePphFinal: number;
}
