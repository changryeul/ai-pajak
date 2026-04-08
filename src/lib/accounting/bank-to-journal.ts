/**
 * Bank Statement → Journal Entry Auto-Converter
 *
 * Resolution priority:
 *   1. Customer memory (learned from previous corrections) → confidence LEARNED
 *   2. Built-in keyword rules (15+ patterns) → confidence HIGH/MEDIUM
 *   3. Default fallback (6900/4100) → confidence LOW
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
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'LEARNED';
  matchedRule: string;
  source: 'MEMORY' | 'RULE' | 'DEFAULT';
}

/** Learned mapping from customer corrections */
export interface CoaMemoryEntry {
  description_pattern: string;
  account_code: string;
  account_name: string;
  transaction_type: 'DEBIT' | 'CREDIT';
}

/**
 * Extract keywords from description for pattern matching
 * Normalizes: lowercase, remove numbers/special chars, trim
 */
export function extractPattern(description: string): string {
  return description
    .toLowerCase()
    .replace(/[0-9.,\-\/\\()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 2) // skip short words
    .slice(0, 5) // max 5 keywords
    .sort()
    .join(' ');
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
 * @param memory - learned mappings for this customer (optional)
 */
export function bankTxToJournal(tx: BankTransaction, memory?: CoaMemoryEntry[]): GeneratedJournal {
  const isExpense = tx.debit > 0;
  const amount = isExpense ? tx.debit : tx.credit;
  const txType = isExpense ? 'DEBIT' : 'CREDIT';

  // Priority 1: Check customer memory
  if (memory && memory.length > 0) {
    const pattern = extractPattern(tx.description);
    const learned = memory.find(m =>
      m.transaction_type === txType && pattern.includes(extractPattern(m.description_pattern))
    );
    if (!learned) {
      // Try reverse: memory pattern included in description
      const learned2 = memory.find(m =>
        m.transaction_type === txType && extractPattern(m.description_pattern).split(' ').every(kw => pattern.includes(kw))
      );
      if (learned2) {
        const lines = isExpense
          ? [
              { account_code: learned2.account_code, account_name: learned2.account_name, debit: amount, credit: 0 },
              { account_code: '1200', account_name: 'Bank', debit: 0, credit: amount },
            ]
          : [
              { account_code: '1200', account_name: 'Bank', debit: amount, credit: 0 },
              { account_code: learned2.account_code, account_name: learned2.account_name, debit: 0, credit: amount },
            ];
        return { entryDate: tx.date, description: tx.description, lines, confidence: 'LEARNED', matchedRule: `${learned2.account_code} ${learned2.account_name} (학습됨)`, source: 'MEMORY' };
      }
    }
    if (learned) {
      const lines = isExpense
        ? [
            { account_code: learned.account_code, account_name: learned.account_name, debit: amount, credit: 0 },
            { account_code: '1200', account_name: 'Bank', debit: 0, credit: amount },
          ]
        : [
            { account_code: '1200', account_name: 'Bank', debit: amount, credit: 0 },
            { account_code: learned.account_code, account_name: learned.account_name, debit: 0, credit: amount },
          ];
      return { entryDate: tx.date, description: tx.description, lines, confidence: 'LEARNED', matchedRule: `${learned.account_code} ${learned.account_name} (학습됨)`, source: 'MEMORY' };
    }
  }

  // Priority 2: Built-in keyword rules
  const rule = matchRule(tx.description);

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
      source: 'RULE' as const,
    };
  }

  // Priority 3: Default fallback
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
    source: 'DEFAULT' as const,
  };
}

/**
 * Convert multiple bank transactions to journal entries
 */
export function convertBankStatementToJournals(transactions: BankTransaction[], memory?: CoaMemoryEntry[]): {
  journals: GeneratedJournal[];
  summary: { total: number; learned: number; high: number; medium: number; low: number };
} {
  const journals = transactions.filter(tx => tx.debit > 0 || tx.credit > 0).map(tx => bankTxToJournal(tx, memory));
  return {
    journals,
    summary: {
      total: journals.length,
      learned: journals.filter(j => j.confidence === 'LEARNED').length,
      high: journals.filter(j => j.confidence === 'HIGH').length,
      medium: journals.filter(j => j.confidence === 'MEDIUM').length,
      low: journals.filter(j => j.confidence === 'LOW').length,
    },
  };
}
