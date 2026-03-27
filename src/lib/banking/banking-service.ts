/**
 * Banking Integration Service
 *
 * Connects to Indonesian banks for automatic revenue tracking.
 * Uses Brick (https://brick.io) as aggregation layer for Open Banking.
 *
 * Supported flows:
 * 1. OAuth connection via Brick widget
 * 2. Transaction fetch & categorization
 * 3. Monthly revenue calculation for PPh Final UMKM
 */

import type {
  BankProvider,
  BankConnection,
  BankTransaction,
  BankStatement,
  MonthlyRevenueSummary,
  AnnualRevenueSummary,
  TransactionCategory,
} from './types';

const BRICK_API_BASE = process.env.BRICK_API_URL || 'https://api.onebrick.io/v2';
const BRICK_PUBLIC_KEY = process.env.BRICK_PUBLIC_KEY || '';
const BRICK_SECRET_KEY = process.env.BRICK_SECRET_KEY || '';

/**
 * Banking Service
 */
export class BankingService {
  // ============================
  // Connection Management
  // ============================

  /**
   * Get Brick widget access token for bank connection
   */
  static async getWidgetToken(customerId: string): Promise<{ accessToken: string; redirectUrl: string }> {
    const response = await fetch(`${BRICK_API_BASE}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRICK_PUBLIC_KEY}`,
      },
      body: JSON.stringify({
        accessToken: BRICK_SECRET_KEY,
        userId: customerId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get widget token');
    }

    const data = await response.json();
    return {
      accessToken: data.data?.accessToken || data.accessToken,
      redirectUrl: data.data?.redirectUrl || '',
    };
  }

  /**
   * Exchange Brick access token after user connects bank
   */
  static async exchangeToken(publicToken: string): Promise<{
    accessToken: string;
    bankId: string;
    institutionId: string;
  }> {
    const response = await fetch(`${BRICK_API_BASE}/auth/token/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRICK_SECRET_KEY}`,
      },
      body: JSON.stringify({ publicToken }),
    });

    if (!response.ok) throw new Error('Token exchange failed');
    const data = await response.json();
    return data.data;
  }

  // ============================
  // Account & Transaction Data
  // ============================

  /**
   * Get bank account details
   */
  static async getAccounts(accessToken: string): Promise<Array<{
    accountId: string;
    accountNumber: string;
    accountName: string;
    provider: BankProvider;
    currency: string;
    balance: number;
  }>> {
    const response = await fetch(`${BRICK_API_BASE}/account/list`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error('Failed to get accounts');
    const data = await response.json();

    return (data.data || []).map((acc: Record<string, unknown>) => ({
      accountId: acc.accountId as string,
      accountNumber: acc.accountNumber as string,
      accountName: acc.accountName as string || acc.accountHolder as string || '',
      provider: mapInstitution(acc.institutionId as string),
      currency: (acc.currency as string) || 'IDR',
      balance: (acc.balances as Record<string, number>)?.current || acc.balance as number || 0,
    }));
  }

  /**
   * Get transactions for a date range
   */
  static async getTransactions(
    accessToken: string,
    startDate: string, // YYYY-MM-DD
    endDate: string,
  ): Promise<BankTransaction[]> {
    const params = new URLSearchParams({ from: startDate, to: endDate });
    const response = await fetch(`${BRICK_API_BASE}/transaction/list?${params}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error('Failed to get transactions');
    const data = await response.json();

    return (data.data || []).map((tx: Record<string, unknown>) => ({
      id: (tx.id || tx.transactionId || '') as string,
      date: (tx.dateTimestamp || tx.date || '') as string,
      description: (tx.description || tx.remark || '') as string,
      type: (tx.direction === 'in' || (tx.amount as number) > 0) ? 'CREDIT' : 'DEBIT',
      amount: Math.abs(tx.amount as number || 0),
      balance: (tx.balance as number) || 0,
      category: categorizeTransaction(
        (tx.description || '') as string,
        (tx.direction === 'in' || (tx.amount as number) > 0) ? 'CREDIT' : 'DEBIT',
        Math.abs(tx.amount as number || 0)
      ),
      reference: (tx.referenceNumber || tx.reference || '') as string,
    }));
  }

  /**
   * Get monthly bank statement
   */
  static async getMonthlyStatement(
    accessToken: string,
    period: string, // YYYY-MM
    accountInfo: { accountNumber: string; accountName: string; provider: BankProvider }
  ): Promise<BankStatement> {
    const [year, month] = period.split('-').map(Number);
    const startDate = `${period}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    const transactions = await this.getTransactions(accessToken, startDate, endDate);

    const totalCredit = transactions.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
    const totalDebit = transactions.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0);

    return {
      accountNumber: accountInfo.accountNumber,
      accountName: accountInfo.accountName,
      provider: accountInfo.provider,
      period,
      openingBalance: transactions.length > 0 ? transactions[0].balance - (transactions[0].type === 'CREDIT' ? transactions[0].amount : -transactions[0].amount) : 0,
      closingBalance: transactions.length > 0 ? transactions[transactions.length - 1].balance : 0,
      totalCredit,
      totalDebit,
      transactionCount: transactions.length,
      transactions,
    };
  }

  // ============================
  // Revenue Calculation
  // ============================

  /**
   * Calculate monthly revenue summary for PPh Final UMKM
   */
  static calculateMonthlyRevenue(statement: BankStatement): MonthlyRevenueSummary {
    const revenueTransactions = statement.transactions.filter(
      t => t.type === 'CREDIT' && (t.category === 'REVENUE' || t.category === 'TRANSFER_IN')
    );
    const expenseTransactions = statement.transactions.filter(
      t => t.type === 'DEBIT' && (t.category === 'EXPENSE' || t.category === 'SALARY')
    );

    const totalRevenue = revenueTransactions.reduce((s, t) => s + t.amount, 0);
    const totalExpense = expenseTransactions.reduce((s, t) => s + t.amount, 0);

    return {
      period: statement.period,
      totalRevenue,
      totalExpense,
      netIncome: totalRevenue - totalExpense,
      transactionCount: statement.transactionCount,
      pphFinal: Math.round(totalRevenue * 0.005), // 0.5% PPh Final
    };
  }

  /**
   * Calculate annual revenue summary with UMKM eligibility
   */
  static calculateAnnualRevenue(monthlySummaries: MonthlyRevenueSummary[], year: number): AnnualRevenueSummary {
    const totalRevenue = monthlySummaries.reduce((s, m) => s + m.totalRevenue, 0);
    const isUmkmEligible = totalRevenue <= 4_800_000_000;

    // PP 55/2022: First Rp 500M exempt from PPh Final
    const umkmExemption = isUmkmEligible ? Math.min(totalRevenue, 500_000_000) : 0;
    const taxableRevenue = Math.max(0, totalRevenue - umkmExemption);
    const effectivePphFinal = Math.round(taxableRevenue * 0.005);

    return {
      year,
      months: monthlySummaries,
      totalRevenue,
      totalPphFinal: monthlySummaries.reduce((s, m) => s + m.pphFinal, 0),
      isUmkmEligible,
      umkmExemption,
      effectivePphFinal,
    };
  }
}

// ============================
// Helpers
// ============================

function mapInstitution(institutionId: string): BankProvider {
  const map: Record<string, BankProvider> = {
    'bca': 'BCA', 'bca_corporate': 'BCA',
    'mandiri': 'MANDIRI', 'mandiri_corporate': 'MANDIRI',
    'bni': 'BNI', 'bni_corporate': 'BNI',
    'bri': 'BRI', 'bri_corporate': 'BRI',
    'cimb': 'CIMB', 'danamon': 'DANAMON',
    'permata': 'PERMATA',
  };
  return map[institutionId?.toLowerCase()] || 'OTHER';
}

/**
 * Auto-categorize transactions based on description
 */
function categorizeTransaction(
  description: string,
  type: 'CREDIT' | 'DEBIT',
  amount: number
): TransactionCategory {
  const desc = description.toLowerCase();

  // Revenue indicators
  if (type === 'CREDIT') {
    if (desc.includes('shopee') || desc.includes('tokopedia') || desc.includes('tiktok') ||
        desc.includes('lazada') || desc.includes('bukalapak') || desc.includes('blibli')) {
      return 'REVENUE';
    }
    if (desc.includes('payment') || desc.includes('pembayaran') || desc.includes('penjualan') ||
        desc.includes('invoice') || desc.includes('faktur')) {
      return 'REVENUE';
    }
    if (desc.includes('transfer') || desc.includes('trf') || desc.includes('cr')) {
      return amount >= 1_000_000 ? 'REVENUE' : 'TRANSFER_IN';
    }
    return 'TRANSFER_IN';
  }

  // Expense indicators
  if (type === 'DEBIT') {
    if (desc.includes('gaji') || desc.includes('salary') || desc.includes('payroll')) {
      return 'SALARY';
    }
    if (desc.includes('pajak') || desc.includes('tax') || desc.includes('mpn') || desc.includes('djp')) {
      return 'TAX_PAYMENT';
    }
    if (desc.includes('sewa') || desc.includes('listrik') || desc.includes('telkom') ||
        desc.includes('internet') || desc.includes('pdam')) {
      return 'EXPENSE';
    }
    if (desc.includes('pinjaman') || desc.includes('loan') || desc.includes('kredit')) {
      return 'LOAN';
    }
    return 'EXPENSE';
  }

  return 'OTHER';
}

export default BankingService;
