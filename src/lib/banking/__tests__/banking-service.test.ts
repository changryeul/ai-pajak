import { describe, it, expect } from 'vitest';
import { BankingService } from '../banking-service';
import type { BankStatement, MonthlyRevenueSummary } from '../types';

describe('BankingService', () => {
  describe('calculateMonthlyRevenue', () => {
    it('should calculate monthly revenue from bank statement', () => {
      const statement: BankStatement = {
        accountNumber: '****1234',
        accountName: 'Toko Siti',
        provider: 'BCA',
        period: '2025-01',
        openingBalance: 50_000_000,
        closingBalance: 75_000_000,
        totalCredit: 40_000_000,
        totalDebit: 15_000_000,
        transactionCount: 20,
        transactions: [
          { id: '1', date: '2025-01-05', description: 'Pembayaran Shopee', type: 'CREDIT', amount: 15_000_000, balance: 65_000_000, category: 'REVENUE' },
          { id: '2', date: '2025-01-10', description: 'Transfer dari Tokopedia', type: 'CREDIT', amount: 10_000_000, balance: 75_000_000, category: 'REVENUE' },
          { id: '3', date: '2025-01-12', description: 'Transfer masuk', type: 'CREDIT', amount: 5_000_000, balance: 80_000_000, category: 'TRANSFER_IN' },
          { id: '4', date: '2025-01-15', description: 'Bayar sewa toko', type: 'DEBIT', amount: 5_000_000, balance: 75_000_000, category: 'EXPENSE' },
          { id: '5', date: '2025-01-25', description: 'Gaji karyawan', type: 'DEBIT', amount: 8_000_000, balance: 67_000_000, category: 'SALARY' },
          { id: '6', date: '2025-01-28', description: 'Bayar listrik PLN', type: 'DEBIT', amount: 2_000_000, balance: 65_000_000, category: 'EXPENSE' },
        ],
      };

      const result = BankingService.calculateMonthlyRevenue(statement);

      // Revenue = Shopee(15M) + Tokopedia(10M) + Transfer(5M) = 30M
      expect(result.totalRevenue).toBe(30_000_000);
      // Expense = sewa(5M) + gaji(8M) + listrik(2M) = 15M
      expect(result.totalExpense).toBe(15_000_000);
      expect(result.netIncome).toBe(15_000_000);
      // PPh Final = 0.5% x 30M = 150,000
      expect(result.pphFinal).toBe(150_000);
      expect(result.period).toBe('2025-01');
    });

    it('should handle empty statement', () => {
      const statement: BankStatement = {
        accountNumber: '****1234',
        accountName: 'Test',
        provider: 'BCA',
        period: '2025-02',
        openingBalance: 0,
        closingBalance: 0,
        totalCredit: 0,
        totalDebit: 0,
        transactionCount: 0,
        transactions: [],
      };

      const result = BankingService.calculateMonthlyRevenue(statement);
      expect(result.totalRevenue).toBe(0);
      expect(result.pphFinal).toBe(0);
    });
  });

  describe('calculateAnnualRevenue', () => {
    it('should calculate annual revenue with UMKM exemption', () => {
      const monthlySummaries: MonthlyRevenueSummary[] = Array.from({ length: 12 }, (_, i) => ({
        period: `2025-${String(i + 1).padStart(2, '0')}`,
        totalRevenue: 100_000_000, // 100M/month
        totalExpense: 60_000_000,
        netIncome: 40_000_000,
        transactionCount: 50,
        pphFinal: 500_000, // 0.5% x 100M
      }));

      const result = BankingService.calculateAnnualRevenue(monthlySummaries, 2025);

      // Total revenue = 100M x 12 = 1.2B
      expect(result.totalRevenue).toBe(1_200_000_000);
      expect(result.isUmkmEligible).toBe(true); // < 4.8B
      // Exemption = first 500M
      expect(result.umkmExemption).toBe(500_000_000);
      // Effective PPh = (1.2B - 500M) x 0.5% = 3.5M
      expect(result.effectivePphFinal).toBe(3_500_000);
      expect(result.months).toHaveLength(12);
    });

    it('should handle revenue exceeding UMKM threshold', () => {
      const monthlySummaries: MonthlyRevenueSummary[] = Array.from({ length: 12 }, (_, i) => ({
        period: `2025-${String(i + 1).padStart(2, '0')}`,
        totalRevenue: 500_000_000, // 500M/month = 6B/year
        totalExpense: 300_000_000,
        netIncome: 200_000_000,
        transactionCount: 100,
        pphFinal: 2_500_000,
      }));

      const result = BankingService.calculateAnnualRevenue(monthlySummaries, 2025);

      expect(result.totalRevenue).toBe(6_000_000_000);
      expect(result.isUmkmEligible).toBe(false); // > 4.8B
      expect(result.umkmExemption).toBe(0); // No exemption
      // Full tax: 6B x 0.5% = 30M
      expect(result.effectivePphFinal).toBe(30_000_000);
    });

    it('should handle revenue below exemption threshold', () => {
      const monthlySummaries: MonthlyRevenueSummary[] = Array.from({ length: 12 }, (_, i) => ({
        period: `2025-${String(i + 1).padStart(2, '0')}`,
        totalRevenue: 30_000_000, // 30M/month = 360M/year
        totalExpense: 20_000_000,
        netIncome: 10_000_000,
        transactionCount: 20,
        pphFinal: 150_000,
      }));

      const result = BankingService.calculateAnnualRevenue(monthlySummaries, 2025);

      expect(result.totalRevenue).toBe(360_000_000);
      expect(result.isUmkmEligible).toBe(true);
      // Revenue(360M) < Exemption(500M), so exemption = 360M
      expect(result.umkmExemption).toBe(360_000_000);
      // No tax: 360M - 360M = 0
      expect(result.effectivePphFinal).toBe(0);
    });
  });
});
