/**
 * Bank Statement → Journal Entry Auto-Converter
 *
 * Converts bank transaction descriptions into journal entries
 * by matching keywords to chart of accounts.
 *
 * Rules (priority order):
 * 1. Tax payments (PPh/PPN) → 2200 Hutang Pajak
 * 2. Salary/payroll → 6100 Gaji & Upah
 * 3. BPJS → 6100 or 2200
 * 4. Rent → 6200 Sewa
 * 5. Utilities → 6300 Listrik/Air/Telepon
 * 6. Revenue (transfer masuk) → 4100/4200 Pendapatan
 * 7. Default expense → 6900 Biaya Lain-lain
 */

export interface BankTransaction {
  date: string;
  description: string;
  debit: number;   // money out (expense)
  credit: number;  // money in (income)
  balance?: number;
  reference?: string;
}

export interface GeneratedJournal {
  entryDate: string;
  description: string;
  lines: Array<{ account_code: string; account_name: string; debit: number; credit: number }>;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  matchedRule: string;
}

interface MatchRule {
  keywords: string[];
  accountCode: string;
  accountName: string;
  type: 'EXPENSE' | 'REVENUE' | 'TAX' | 'TRANSFER';
  confidence: 'HIGH' | 'MEDIUM';
}

const RULES: MatchRule[] = [
  // Tax payments
  { keywords: ['pph 21', 'pph21', 'pajak penghasilan 21'], accountCode: '2200', accountName: 'Hutang Pajak (PPh 21)', type: 'TAX', confidence: 'HIGH' },
  { keywords: ['pph 23', 'pph23', 'pajak penghasilan 23'], accountCode: '2200', accountName: 'Hutang Pajak (PPh 23)', type: 'TAX', confidence: 'HIGH' },
  { keywords: ['pph 25', 'pph25'], accountCode: '2200', accountName: 'Hutang Pajak (PPh 25)', type: 'TAX', confidence: 'HIGH' },
  { keywords: ['ppn', 'pajak pertambahan'], accountCode: '2200', accountName: 'Hutang Pajak (PPN)', type: 'TAX', confidence: 'HIGH' },
  { keywords: ['setor pajak', 'ntpn', 'tax payment'], accountCode: '2200', accountName: 'Hutang Pajak', type: 'TAX', confidence: 'HIGH' },
  // Salary
  { keywords: ['gaji', 'salary', 'payroll', 'upah', '급여'], accountCode: '6100', accountName: 'Gaji & Upah', type: 'EXPENSE', confidence: 'HIGH' },
  // BPJS
  { keywords: ['bpjs', 'kesehatan', 'ketenagakerjaan', 'jht', 'jp'], accountCode: '6100', accountName: 'BPJS (via Gaji)', type: 'EXPENSE', confidence: 'HIGH' },
  // Rent
  { keywords: ['sewa', 'rent', 'kantor', 'office rent', '임대'], accountCode: '6200', accountName: 'Sewa', type: 'EXPENSE', confidence: 'HIGH' },
  // Utilities
  { keywords: ['listrik', 'pln', 'air', 'pam', 'internet', 'telepon', 'telkom', 'indihome'], accountCode: '6300', accountName: 'Listrik, Air & Telepon', type: 'EXPENSE', confidence: 'HIGH' },
  // Transportation
  { keywords: ['transport', 'grab', 'gojek', 'taxi', 'bensin', 'tol', 'parkir'], accountCode: '6500', accountName: 'Transportasi', type: 'EXPENSE', confidence: 'MEDIUM' },
  // Office supplies
  { keywords: ['atk', 'peralatan', 'supplies', 'alat tulis'], accountCode: '6600', accountName: 'Peralatan Kantor', type: 'EXPENSE', confidence: 'MEDIUM' },
  // Marketing
  { keywords: ['iklan', 'marketing', 'promosi', 'ads', 'google ads', 'meta ads'], accountCode: '6800', accountName: 'Biaya Pemasaran', type: 'EXPENSE', confidence: 'MEDIUM' },
  // Interest
  { keywords: ['bunga', 'interest', 'deposito'], accountCode: '7100', accountName: 'Pendapatan Bunga', type: 'REVENUE', confidence: 'HIGH' },
  // Loan
  { keywords: ['pinjaman', 'kredit', 'angsuran', 'cicilan'], accountCode: '2300', accountName: 'Hutang Bank', type: 'TRANSFER', confidence: 'MEDIUM' },
];

function matchRule(description: string): MatchRule | null {
  const lower = description.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule;
    }
  }
  return null;
}

/**
 * Convert a single bank transaction to a journal entry
 */
export function bankTxToJournal(tx: BankTransaction): GeneratedJournal {
  const rule = matchRule(tx.description);
  const isExpense = tx.debit > 0;
  const amount = isExpense ? tx.debit : tx.credit;

  if (rule) {
    const lines = isExpense
      ? [
          { account_code: rule.accountCode, account_name: rule.accountName, debit: amount, credit: 0 },
          { account_code: '1200', account_name: 'Bank', debit: 0, credit: amount },
        ]
      : [
          { account_code: '1200', account_name: 'Bank', debit: amount, credit: 0 },
          { account_code: rule.type === 'REVENUE' ? rule.accountCode : '4100', account_name: rule.type === 'REVENUE' ? rule.accountName : 'Pendapatan Usaha', debit: 0, credit: amount },
        ];

    return {
      entryDate: tx.date,
      description: tx.description,
      lines,
      confidence: rule.confidence,
      matchedRule: `${rule.accountCode} ${rule.accountName}`,
    };
  }

  // Default: unknown expense/revenue
  const lines = isExpense
    ? [
        { account_code: '6900', account_name: 'Biaya Lain-lain', debit: amount, credit: 0 },
        { account_code: '1200', account_name: 'Bank', debit: 0, credit: amount },
      ]
    : [
        { account_code: '1200', account_name: 'Bank', debit: amount, credit: 0 },
        { account_code: '4100', account_name: 'Pendapatan Usaha', debit: 0, credit: amount },
      ];

  return {
    entryDate: tx.date,
    description: tx.description,
    lines,
    confidence: 'LOW',
    matchedRule: isExpense ? '6900 Biaya Lain-lain (default)' : '4100 Pendapatan (default)',
  };
}

/**
 * Convert multiple bank transactions to journal entries
 */
export function convertBankStatementToJournals(transactions: BankTransaction[]): {
  journals: GeneratedJournal[];
  summary: { total: number; high: number; medium: number; low: number };
} {
  const journals = transactions.filter(tx => tx.debit > 0 || tx.credit > 0).map(bankTxToJournal);
  return {
    journals,
    summary: {
      total: journals.length,
      high: journals.filter(j => j.confidence === 'HIGH').length,
      medium: journals.filter(j => j.confidence === 'MEDIUM').length,
      low: journals.filter(j => j.confidence === 'LOW').length,
    },
  };
}
