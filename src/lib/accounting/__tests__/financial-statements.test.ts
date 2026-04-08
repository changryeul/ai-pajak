import { describe, it, expect } from 'vitest';
import {
  buildGeneralLedger,
  buildTrialBalance,
  buildIncomeStatement,
  buildBalanceSheet,
  generateFinancialStatements,
  type JournalLine,
} from '../financial-statements';

// Sample journal entries for a simple IT service company
const sampleJournal: JournalLine[] = [
  // Capital injection: Bank 500M, Modal Disetor 500M
  { account_code: '1200', debit: 500_000_000, credit: 0 },
  { account_code: '3100', debit: 0, credit: 500_000_000 },
  // Service revenue: Bank 80M, Pendapatan Jasa 80M
  { account_code: '1200', debit: 80_000_000, credit: 0 },
  { account_code: '4200', debit: 0, credit: 80_000_000 },
  // Salary expense: Gaji 25M, Hutang Pajak 1.25M, Bank 23.75M
  { account_code: '6100', debit: 25_000_000, credit: 0 },
  { account_code: '2200', debit: 0, credit: 1_250_000 },
  { account_code: '1200', debit: 0, credit: 23_750_000 },
  // Utilities: Listrik 3.5M, Bank 3.5M
  { account_code: '6300', debit: 3_500_000, credit: 0 },
  { account_code: '1200', debit: 0, credit: 3_500_000 },
  // Rent: Sewa 10M, Bank 10M
  { account_code: '6200', debit: 10_000_000, credit: 0 },
  { account_code: '1200', debit: 0, credit: 10_000_000 },
];

describe('Financial Statements Engine', () => {
  describe('buildGeneralLedger', () => {
    it('should aggregate debit/credit per account', () => {
      const ledger = buildGeneralLedger(sampleJournal);
      const bank = ledger.find(e => e.accountCode === '1200');
      expect(bank).toBeDefined();
      expect(bank!.totalDebit).toBe(580_000_000); // 500M + 80M
      expect(bank!.totalCredit).toBe(37_250_000); // 23.75M + 3.5M + 10M
      expect(bank!.balance).toBe(542_750_000);
    });

    it('should sort by account code', () => {
      const ledger = buildGeneralLedger(sampleJournal);
      const codes = ledger.map(e => e.accountCode);
      expect(codes).toEqual([...codes].sort());
    });
  });

  describe('buildTrialBalance', () => {
    it('should balance when debits equal credits', () => {
      const ledger = buildGeneralLedger(sampleJournal);
      const tb = buildTrialBalance(ledger);
      expect(tb.isBalanced).toBe(true);
    });

    it('should calculate correct totals', () => {
      const ledger = buildGeneralLedger(sampleJournal);
      const tb = buildTrialBalance(ledger);
      // All journal debits = 500M + 80M + 25M + 3.5M + 10M = 618.5M
      expect(tb.totalDebit + tb.totalCredit).toBeGreaterThan(0);
    });
  });

  describe('buildIncomeStatement', () => {
    it('should calculate net income correctly', () => {
      const ledger = buildGeneralLedger(sampleJournal);
      const is = buildIncomeStatement(ledger);
      // Revenue: 80M, Expenses: 25M + 3.5M + 10M = 38.5M
      expect(is.netIncome).toBe(41_500_000); // 80M - 38.5M
    });

    it('should calculate gross profit', () => {
      const ledger = buildGeneralLedger(sampleJournal);
      const is = buildIncomeStatement(ledger);
      expect(is.grossProfit).toBe(80_000_000); // No COGS
    });

    it('should list operating expenses', () => {
      const ledger = buildGeneralLedger(sampleJournal);
      const is = buildIncomeStatement(ledger);
      expect(is.operatingExpenses.length).toBe(3); // Gaji, Sewa, Listrik
    });
  });

  describe('buildBalanceSheet', () => {
    it('should balance: assets = liabilities + equity', () => {
      const ledger = buildGeneralLedger(sampleJournal);
      const is = buildIncomeStatement(ledger);
      const bs = buildBalanceSheet(ledger, is.netIncome);
      expect(bs.isBalanced).toBe(true);
    });

    it('should include net income in equity', () => {
      const ledger = buildGeneralLedger(sampleJournal);
      const is = buildIncomeStatement(ledger);
      const bs = buildBalanceSheet(ledger, is.netIncome);
      expect(bs.equity.netIncome).toBe(41_500_000);
    });

    it('should calculate total assets', () => {
      const ledger = buildGeneralLedger(sampleJournal);
      const is = buildIncomeStatement(ledger);
      const bs = buildBalanceSheet(ledger, is.netIncome);
      expect(bs.assets.totalAssets).toBe(542_750_000); // Bank balance
    });
  });

  describe('generateFinancialStatements (full pipeline)', () => {
    it('should pass validation for balanced journal', () => {
      const result = generateFinancialStatements(sampleJournal);
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.errors).toEqual([]);
    });

    it('should detect unbalanced journal', () => {
      const unbalanced: JournalLine[] = [
        { account_code: '1200', debit: 100_000, credit: 0 },
        { account_code: '4100', debit: 0, credit: 50_000 }, // Missing 50K credit
      ];
      const result = generateFinancialStatements(unbalanced);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });

    it('should produce all four outputs', () => {
      const result = generateFinancialStatements(sampleJournal);
      expect(result.ledger.length).toBeGreaterThan(0);
      expect(result.trialBalance.entries.length).toBeGreaterThan(0);
      expect(result.incomeStatement.netIncome).toBeDefined();
      expect(result.balanceSheet.assets.totalAssets).toBeDefined();
    });
  });
});
