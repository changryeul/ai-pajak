/**
 * Financial Statement Generator
 *
 * Converts journal entries into financial statements:
 *   Journal → General Ledger → Trial Balance → Neraca + Laba Rugi
 *
 * Based on SAK EMKM (Indonesian Small Business Accounting Standard)
 * Double-entry bookkeeping with debit/credit validation.
 */

// ── Types ──

export interface JournalLine {
  account_code: string;
  account_name?: string;
  debit: number;
  credit: number;
}

export interface LedgerEntry {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: 'DEBIT' | 'CREDIT';
  totalDebit: number;
  totalCredit: number;
  balance: number; // Positive = normal, Negative = abnormal
}

export interface TrialBalance {
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  generatedAt: string;
}

export interface BalanceSheet {
  // Aktiva (Assets)
  assets: {
    current: FinancialItem[];    // Aktiva Lancar
    fixed: FinancialItem[];      // Aktiva Tetap
    other: FinancialItem[];      // Aktiva Lain-lain
    totalAssets: number;
  };
  // Kewajiban & Modal (Liabilities & Equity)
  liabilities: {
    current: FinancialItem[];    // Kewajiban Jangka Pendek
    longTerm: FinancialItem[];   // Kewajiban Jangka Panjang
    totalLiabilities: number;
  };
  equity: {
    items: FinancialItem[];
    netIncome: number;           // Laba Tahun Berjalan (from Income Statement)
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;           // Assets = Liabilities + Equity
  generatedAt: string;
}

export interface IncomeStatement {
  revenue: FinancialItem[];         // Pendapatan
  cogs: FinancialItem[];            // Harga Pokok
  grossProfit: number;              // Laba Kotor
  operatingExpenses: FinancialItem[]; // Biaya Operasional
  operatingIncome: number;          // Laba Operasional
  otherIncome: FinancialItem[];     // Pendapatan/Biaya Lain-lain
  incomeBeforeTax: number;          // Laba Sebelum Pajak
  taxExpense: FinancialItem[];      // Beban Pajak
  netIncome: number;                // Laba Bersih
  generatedAt: string;
}

export interface FinancialItem {
  code: string;
  name: string;
  amount: number;
}

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COGS' | 'EXPENSE' | 'OTHER_INCOME' | 'TAX';

interface AccountInfo {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: 'DEBIT' | 'CREDIT';
}

// ── Standard Chart of Accounts (same as DB seed) ──
const COA: AccountInfo[] = [
  { code: '1100', name: 'Kas', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1200', name: 'Bank', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1300', name: 'Piutang Usaha', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1400', name: 'Persediaan', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1500', name: 'Biaya Dibayar Dimuka', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1600', name: 'Aktiva Tetap', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1700', name: 'Akumulasi Penyusutan', type: 'ASSET', normalBalance: 'CREDIT' },
  { code: '1800', name: 'Aktiva Lain-lain', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '2100', name: 'Hutang Usaha', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2200', name: 'Hutang Pajak', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2300', name: 'Hutang Bank', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2400', name: 'Hutang Lain-lain', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '3100', name: 'Modal Disetor', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '3200', name: 'Laba Ditahan', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '3300', name: 'Laba Tahun Berjalan', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '4100', name: 'Pendapatan Usaha', type: 'REVENUE', normalBalance: 'CREDIT' },
  { code: '4200', name: 'Pendapatan Jasa', type: 'REVENUE', normalBalance: 'CREDIT' },
  { code: '4300', name: 'Pendapatan Lain-lain', type: 'OTHER_INCOME', normalBalance: 'CREDIT' },
  { code: '5100', name: 'Harga Pokok Penjualan', type: 'COGS', normalBalance: 'DEBIT' },
  { code: '5200', name: 'Biaya Langsung Jasa', type: 'COGS', normalBalance: 'DEBIT' },
  { code: '6100', name: 'Gaji & Upah', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6200', name: 'Sewa', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6300', name: 'Listrik, Air & Telepon', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6400', name: 'Penyusutan', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6500', name: 'Transportasi', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6600', name: 'Peralatan Kantor', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6700', name: 'Biaya Asuransi', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6800', name: 'Biaya Pemasaran', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6900', name: 'Biaya Lain-lain', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '7100', name: 'Pendapatan Bunga', type: 'OTHER_INCOME', normalBalance: 'CREDIT' },
  { code: '7200', name: 'Biaya Bunga', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '7300', name: 'Laba/Rugi Selisih Kurs', type: 'OTHER_INCOME', normalBalance: 'CREDIT' },
  { code: '8100', name: 'Beban Pajak Penghasilan', type: 'TAX', normalBalance: 'DEBIT' },
];

function getAccountInfo(code: string): AccountInfo {
  return COA.find(a => a.code === code) || {
    code, name: `Unknown (${code})`,
    type: code.startsWith('1') ? 'ASSET' : code.startsWith('2') ? 'LIABILITY' :
          code.startsWith('3') ? 'EQUITY' : code.startsWith('4') ? 'REVENUE' :
          code.startsWith('5') ? 'COGS' : code.startsWith('6') ? 'EXPENSE' :
          code.startsWith('7') ? 'OTHER_INCOME' : 'TAX',
    normalBalance: code.startsWith('1') || code.startsWith('5') || code.startsWith('6') || code.startsWith('7') && code >= '7200' || code.startsWith('8') ? 'DEBIT' : 'CREDIT',
  };
}

// ══════════════════════════════════════════════════════
// STEP 1: Journal Lines → General Ledger (총계정원장)
// ══════════════════════════════════════════════════════
export function buildGeneralLedger(lines: JournalLine[]): LedgerEntry[] {
  const ledger = new Map<string, { totalDebit: number; totalCredit: number }>();

  for (const line of lines) {
    const existing = ledger.get(line.account_code) || { totalDebit: 0, totalCredit: 0 };
    existing.totalDebit += Number(line.debit) || 0;
    existing.totalCredit += Number(line.credit) || 0;
    ledger.set(line.account_code, existing);
  }

  const entries: LedgerEntry[] = [];
  for (const [code, totals] of ledger) {
    const info = getAccountInfo(code);
    const balance = info.normalBalance === 'DEBIT'
      ? totals.totalDebit - totals.totalCredit
      : totals.totalCredit - totals.totalDebit;

    entries.push({
      accountCode: code,
      accountName: info.name,
      accountType: info.type,
      normalBalance: info.normalBalance,
      totalDebit: totals.totalDebit,
      totalCredit: totals.totalCredit,
      balance,
    });
  }

  return entries.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

// ══════════════════════════════════════════════════════
// STEP 2: General Ledger → Trial Balance (Neraca Saldo)
// ══════════════════════════════════════════════════════
export function buildTrialBalance(ledger: LedgerEntry[]): TrialBalance {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of ledger) {
    if (entry.normalBalance === 'DEBIT') {
      totalDebit += entry.balance;
    } else {
      totalCredit += entry.balance;
    }
  }

  return {
    entries: ledger,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 1, // Rp 1 tolerance
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════
// STEP 3: Trial Balance → Income Statement (Laba Rugi)
// ══════════════════════════════════════════════════════
export function buildIncomeStatement(ledger: LedgerEntry[]): IncomeStatement {
  const toItem = (e: LedgerEntry): FinancialItem => ({
    code: e.accountCode, name: e.accountName, amount: e.balance,
  });

  const revenue = ledger.filter(e => e.accountType === 'REVENUE' && e.balance > 0).map(toItem);
  const cogs = ledger.filter(e => e.accountType === 'COGS' && e.balance > 0).map(toItem);
  const operatingExpenses = ledger.filter(e => e.accountType === 'EXPENSE' && e.balance > 0).map(toItem);
  const otherIncome = ledger.filter(e => e.accountType === 'OTHER_INCOME').map(toItem);
  const taxExpense = ledger.filter(e => e.accountType === 'TAX' && e.balance > 0).map(toItem);

  const totalRevenue = revenue.reduce((s, i) => s + i.amount, 0);
  const totalCogs = cogs.reduce((s, i) => s + i.amount, 0);
  const grossProfit = totalRevenue - totalCogs;

  const totalOpex = operatingExpenses.reduce((s, i) => s + i.amount, 0);
  const operatingIncome = grossProfit - totalOpex;

  const totalOther = otherIncome.reduce((s, i) => s + i.amount, 0);
  const incomeBeforeTax = operatingIncome + totalOther;

  const totalTax = taxExpense.reduce((s, i) => s + i.amount, 0);
  const netIncome = incomeBeforeTax - totalTax;

  return {
    revenue, cogs, grossProfit,
    operatingExpenses, operatingIncome,
    otherIncome, incomeBeforeTax,
    taxExpense, netIncome,
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════
// STEP 4: Trial Balance + Net Income → Balance Sheet (Neraca)
// ══════════════════════════════════════════════════════
export function buildBalanceSheet(ledger: LedgerEntry[], netIncome: number): BalanceSheet {
  const toItem = (e: LedgerEntry): FinancialItem => ({
    code: e.accountCode, name: e.accountName, amount: e.balance,
  });

  // Assets
  const currentAssets = ledger
    .filter(e => e.accountType === 'ASSET' && e.accountCode < '1600')
    .map(toItem);
  const fixedAssets = ledger
    .filter(e => e.accountType === 'ASSET' && e.accountCode >= '1600' && e.accountCode < '1800')
    .map(toItem);
  const otherAssets = ledger
    .filter(e => e.accountType === 'ASSET' && e.accountCode >= '1800')
    .map(toItem);
  const totalAssets = [...currentAssets, ...fixedAssets, ...otherAssets]
    .reduce((s, i) => s + i.amount, 0);

  // Liabilities
  const currentLiabilities = ledger
    .filter(e => e.accountType === 'LIABILITY' && e.accountCode < '2300')
    .map(toItem);
  const longTermLiabilities = ledger
    .filter(e => e.accountType === 'LIABILITY' && e.accountCode >= '2300')
    .map(toItem);
  const totalLiabilities = [...currentLiabilities, ...longTermLiabilities]
    .reduce((s, i) => s + i.amount, 0);

  // Equity (exclude 3300 — replaced by calculated netIncome)
  const equityItems = ledger
    .filter(e => e.accountType === 'EQUITY' && e.accountCode !== '3300')
    .map(toItem);
  const totalEquityBase = equityItems.reduce((s, i) => s + i.amount, 0);
  const totalEquity = totalEquityBase + netIncome;

  return {
    assets: { current: currentAssets, fixed: fixedAssets, other: otherAssets, totalAssets },
    liabilities: { current: currentLiabilities, longTerm: longTermLiabilities, totalLiabilities },
    equity: { items: equityItems, netIncome, totalEquity },
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════
// FULL PIPELINE: Journal Lines → All Statements
// ══════════════════════════════════════════════════════
export function generateFinancialStatements(journalLines: JournalLine[]): {
  ledger: LedgerEntry[];
  trialBalance: TrialBalance;
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  validation: { isValid: boolean; errors: string[] };
} {
  // Validate: total debits must equal total credits
  const totalDebit = journalLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = journalLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const errors: string[] = [];

  if (Math.abs(totalDebit - totalCredit) > 1) {
    errors.push(`차변/대변 불일치: 차변 ${totalDebit.toLocaleString()}, 대변 ${totalCredit.toLocaleString()}, 차이 ${Math.abs(totalDebit - totalCredit).toLocaleString()}`);
  }

  const ledger = buildGeneralLedger(journalLines);
  const trialBalance = buildTrialBalance(ledger);
  const incomeStatement = buildIncomeStatement(ledger);
  const balanceSheet = buildBalanceSheet(ledger, incomeStatement.netIncome);

  if (!trialBalance.isBalanced) {
    errors.push('시산표 불균형: 차변 합계와 대변 합계가 일치하지 않습니다');
  }
  if (!balanceSheet.isBalanced) {
    errors.push(`대차대조표 불균형: 자산 ${balanceSheet.assets.totalAssets.toLocaleString()} ≠ 부채+자본 ${balanceSheet.totalLiabilitiesAndEquity.toLocaleString()}`);
  }

  return {
    ledger, trialBalance, incomeStatement, balanceSheet,
    validation: { isValid: errors.length === 0, errors },
  };
}

/** Get standard Chart of Accounts */
export function getChartOfAccounts(): AccountInfo[] {
  return COA;
}
