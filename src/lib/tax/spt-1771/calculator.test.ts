/**
 * SPT 1771 Calculator Tests
 *
 * Test suite for Indonesian corporate annual tax return calculations
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSPT1771,
  validateSPT1771,
  createEmptyIncomeStatement,
  createEmptyBalanceSheet,
  calculateIncomeStatementTotals,
  isAuditRequired,
  canUseUMKMFinalTax,
  calculateUMKMFinalTax,
  type SPT1771Input,
} from './calculator';
import {
  calculateFiscalAdjustments,
  detectFiscalAdjustments,
  calculateDepreciationAdjustment,
  calculateEntertainmentAdjustment,
  calculateDonationAdjustment,
  validateFiscalAdjustments,
} from './fiscal-adjustment';
import {
  CORPORATE_TAX_RATES,
  qualifiesForSMERate,
  calculateSMEPortionLimit,
} from './types';
import type { CorporateIdentity } from '../shared/types';
import type {
  FiscalYearPeriod,
  CorporateIncomeStatement,
  CorporateBalanceSheet,
} from './types';

// Test fixtures
const createTestCompany = (): CorporateIdentity => ({
  npwp: '01.234.567.8-901.234',
  companyName: 'PT Test Indonesia',
  legalName: 'PT Test Indonesia',
  entityType: 'PT',
  registrationNumber: 'AHU-12345.2024',
  address: 'Jl. Test No. 1, Jakarta',
  city: 'Jakarta',
  kluCode: '46510',
  businessDescription: 'Wholesale trade',
  fiscalYearEnd: '12-31',
  isAuditRequired: false,
});

const createTestFiscalYear = (): FiscalYearPeriod => ({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  isCalendarYear: true,
});

const createTestIncomeStatement = (
  revenue: number,
  cogs: number,
  opex: number,
  taxExpense: number
): CorporateIncomeStatement => {
  const stmt = createEmptyIncomeStatement();
  stmt.grossRevenue = revenue;
  stmt.netRevenue = revenue;
  stmt.costOfRevenue.totalCostOfRevenue = cogs;
  stmt.grossProfit = revenue - cogs;
  stmt.operatingExpenses.totalOperatingExpenses = opex;
  stmt.operatingExpenses.salariesAndWages = opex * 0.6;
  stmt.operatingExpenses.rentExpense = opex * 0.2;
  stmt.operatingExpenses.depreciation = opex * 0.1;
  stmt.operatingExpenses.entertainmentExpense = opex * 0.05;
  stmt.operatingExpenses.otherOperatingExpenses = opex * 0.05;
  stmt.operatingIncome = stmt.grossProfit - opex;
  stmt.incomeBeforeTax = stmt.operatingIncome;
  stmt.incomeTaxExpense = taxExpense;
  stmt.netIncome = stmt.incomeBeforeTax - taxExpense;
  return stmt;
};

const createTestBalanceSheet = (
  totalAssets: number
): CorporateBalanceSheet => ({
  assets: {
    currentAssets: totalAssets * 0.4,
    fixedAssets: totalAssets * 0.5,
    accumulatedDepreciation: totalAssets * 0.1,
    netFixedAssets: totalAssets * 0.4,
    otherAssets: totalAssets * 0.2,
    totalAssets,
  },
  liabilities: {
    currentLiabilities: totalAssets * 0.2,
    longTermLiabilities: totalAssets * 0.3,
    totalLiabilities: totalAssets * 0.5,
  },
  equity: {
    paidInCapital: totalAssets * 0.3,
    retainedEarnings: totalAssets * 0.15,
    currentYearProfit: totalAssets * 0.05,
    otherEquity: 0,
    totalEquity: totalAssets * 0.5,
  },
});

describe('SPT 1771 Corporate Tax Rates', () => {
  it('should have correct standard rate of 22%', () => {
    expect(CORPORATE_TAX_RATES.STANDARD).toBe(0.22);
  });

  it('should have correct SME rate of 11%', () => {
    expect(CORPORATE_TAX_RATES.SME).toBe(0.11);
  });

  it('should have correct SME threshold of 50 billion', () => {
    expect(CORPORATE_TAX_RATES.SME_GROSS_THRESHOLD).toBe(50_000_000_000);
  });

  it('should have correct SME portion limit of 4.8 billion', () => {
    expect(CORPORATE_TAX_RATES.SME_PORTION_LIMIT).toBe(4_800_000_000);
  });

  it('should have correct UMKM final tax rate of 0.5%', () => {
    expect(CORPORATE_TAX_RATES.UMKM_FINAL).toBe(0.005);
  });
});

describe('SME Rate Qualification', () => {
  it('should qualify for SME rate with revenue < 50B', () => {
    expect(qualifiesForSMERate(40_000_000_000)).toBe(true);
    expect(qualifiesForSMERate(10_000_000_000)).toBe(true);
    expect(qualifiesForSMERate(1_000_000_000)).toBe(true);
  });

  it('should not qualify for SME rate with revenue >= 50B', () => {
    expect(qualifiesForSMERate(50_000_000_000)).toBe(false);
    expect(qualifiesForSMERate(100_000_000_000)).toBe(false);
  });
});

describe('SME Portion Limit Calculation', () => {
  it('should calculate correct SME portion for small company', () => {
    // Revenue 10B, taxable income 1B
    // SME portion = (4.8B / 10B) * 1B = 0.48B = 480M
    const smeLimit = calculateSMEPortionLimit(10_000_000_000, 1_000_000_000);
    expect(smeLimit).toBe(480_000_000);
  });

  it('should calculate correct SME portion for medium company', () => {
    // Revenue 24B, taxable income 2B
    // SME portion = (4.8B / 24B) * 2B = 0.4B = 400M
    const smeLimit = calculateSMEPortionLimit(24_000_000_000, 2_000_000_000);
    expect(smeLimit).toBe(400_000_000);
  });

  it('should cap SME portion at 4.8B', () => {
    // Revenue 4.8B, taxable income 10B
    // Ratio = 4.8B / 4.8B = 1.0
    // SME portion = 1.0 * 10B = 10B, but capped at 4.8B
    const smeLimit = calculateSMEPortionLimit(4_800_000_000, 10_000_000_000);
    expect(smeLimit).toBe(4_800_000_000);
  });

  it('should return 0 for non-qualifying companies', () => {
    const smeLimit = calculateSMEPortionLimit(60_000_000_000, 5_000_000_000);
    expect(smeLimit).toBe(0);
  });
});

describe('Fiscal Adjustments Calculator', () => {
  it('should calculate positive adjustments correctly', () => {
    const result = calculateFiscalAdjustments({
      entertainmentWithoutDaftarNominatif: 50_000_000,
      finesAndPenalties: 10_000_000,
      incomeTaxExpense: 100_000_000,
    });

    expect(result.positiveAdjustments.entertainmentWithoutDaftarNominatif).toBe(
      50_000_000
    );
    expect(result.positiveAdjustments.finesAndPenalties).toBe(10_000_000);
    expect(result.positiveAdjustments.incomeTaxExpense).toBe(100_000_000);
    expect(result.positiveAdjustments.total).toBe(160_000_000);
  });

  it('should calculate negative adjustments correctly', () => {
    const result = calculateFiscalAdjustments({
      dividendFromDomestic: 200_000_000,
      bankInterestFinalTax: 50_000_000,
    });

    expect(result.negativeAdjustments.dividendFromDomestic).toBe(200_000_000);
    expect(result.negativeAdjustments.bankInterestFinalTax).toBe(50_000_000);
    expect(result.negativeAdjustments.total).toBe(250_000_000);
  });

  it('should calculate net adjustment correctly', () => {
    const result = calculateFiscalAdjustments({
      incomeTaxExpense: 100_000_000,
      dividendFromDomestic: 60_000_000,
    });

    expect(result.netAdjustment).toBe(40_000_000); // 100M - 60M
  });

  it('should handle empty input', () => {
    const result = calculateFiscalAdjustments({});

    expect(result.positiveAdjustments.total).toBe(0);
    expect(result.negativeAdjustments.total).toBe(0);
    expect(result.netAdjustment).toBe(0);
  });
});

describe('Depreciation Adjustment', () => {
  it('should calculate positive adjustment when accounting > fiscal', () => {
    const result = calculateDepreciationAdjustment(100_000_000, 80_000_000);
    expect(result.positive).toBe(20_000_000);
    expect(result.negative).toBe(0);
  });

  it('should calculate negative adjustment when fiscal > accounting', () => {
    const result = calculateDepreciationAdjustment(80_000_000, 100_000_000);
    expect(result.positive).toBe(0);
    expect(result.negative).toBe(20_000_000);
  });

  it('should return zero for equal values', () => {
    const result = calculateDepreciationAdjustment(100_000_000, 100_000_000);
    expect(result.positive).toBe(0);
    expect(result.negative).toBe(0);
  });
});

describe('Entertainment Adjustment', () => {
  it('should calculate non-deductible entertainment', () => {
    // Total 100M, with nominatif 60M, without nominatif 40M
    const result = calculateEntertainmentAdjustment(100_000_000, 60_000_000);
    expect(result).toBe(40_000_000);
  });

  it('should return zero if all has nominatif', () => {
    const result = calculateEntertainmentAdjustment(100_000_000, 100_000_000);
    expect(result).toBe(0);
  });
});

describe('Donation Adjustment', () => {
  it('should calculate non-deductible donations', () => {
    // Total 100M, deductible 50M, fiscal income 800M
    // Limit = 800M * 5% = 40M
    // Allowed = min(50M, 40M) = 40M
    // Non-deductible = 100M - 40M = 60M
    const result = calculateDonationAdjustment(100_000_000, 50_000_000, 800_000_000);
    expect(result).toBe(60_000_000);
  });

  it('should allow full deduction within limit', () => {
    // Total 30M, deductible 30M, fiscal income 1B
    // Limit = 1B * 5% = 50M
    // Allowed = min(30M, 50M) = 30M
    // Non-deductible = 30M - 30M = 0
    const result = calculateDonationAdjustment(
      30_000_000,
      30_000_000,
      1_000_000_000
    );
    expect(result).toBe(0);
  });
});

describe('Fiscal Adjustments Validation', () => {
  it('should validate correct adjustments', () => {
    const adjustments = calculateFiscalAdjustments({
      incomeTaxExpense: 100_000_000,
      dividendFromDomestic: 50_000_000,
    });

    const result = validateFiscalAdjustments(adjustments);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect negative values', () => {
    const adjustments = calculateFiscalAdjustments({});
    adjustments.positiveAdjustments.finesAndPenalties = -10_000_000;

    const result = validateFiscalAdjustments(adjustments);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Fines and penalties cannot be negative');
  });
});

describe('SPT 1771 Calculator', () => {
  it('should calculate basic corporate tax correctly', () => {
    // Revenue 20B, COGS 12B, Opex 3B
    // Gross profit = 8B, Operating income = 5B
    // Tax expense 1B (accounting)
    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        20_000_000_000,
        12_000_000_000,
        3_000_000_000,
        1_000_000_000
      ),
      balanceSheet: createTestBalanceSheet(25_000_000_000),
    };

    const result = calculateSPT1771(input);

    expect(result.taxYear).toBe(2024);
    expect(result.company.companyName).toBe('PT Test Indonesia');
    expect(result.incomeStatement.grossRevenue).toBe(20_000_000_000);
    expect(result.taxCalculation.commercialIncome).toBe(5_000_000_000);
  });

  it('should apply SME rate for qualifying companies', () => {
    // Revenue 10B (qualifies for SME)
    // Taxable income 1B
    // SME portion = (4.8B / 10B) * 1B = 480M at 11%
    // Regular portion = 1B - 480M = 520M at 22%
    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        10_000_000_000,
        6_000_000_000,
        3_000_000_000,
        220_000_000
      ),
      balanceSheet: createTestBalanceSheet(12_000_000_000),
    };

    const result = calculateSPT1771(input);

    // Check SME qualification
    expect(result.taxCalculation.smePortionLimit).toBeGreaterThan(0);
    expect(result.taxCalculation.taxOnSMEPortion).toBeGreaterThan(0);
  });

  it('should not apply SME rate for large companies', () => {
    // Revenue 60B (does not qualify for SME)
    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        60_000_000_000,
        35_000_000_000,
        10_000_000_000,
        3_000_000_000
      ),
      balanceSheet: createTestBalanceSheet(70_000_000_000),
    };

    const result = calculateSPT1771(input);

    expect(result.taxCalculation.smePortionLimit).toBe(0);
    expect(result.taxCalculation.taxOnSMEPortion).toBe(0);
    expect(result.taxCalculation.corporateTaxRate).toBe(0.22);
  });

  it('should apply fiscal adjustments correctly', () => {
    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        10_000_000_000,
        6_000_000_000,
        3_000_000_000,
        200_000_000
      ),
      balanceSheet: createTestBalanceSheet(12_000_000_000),
      fiscalAdjustments: {
        incomeTaxExpense: 200_000_000,
        finesAndPenalties: 50_000_000,
        dividendFromDomestic: 100_000_000,
      },
    };

    const result = calculateSPT1771(input);

    // Net adjustment = 250M - 100M = 150M
    expect(result.fiscalAdjustments.positiveAdjustments.total).toBe(250_000_000);
    expect(result.fiscalAdjustments.negativeAdjustments.total).toBe(100_000_000);
    expect(result.fiscalAdjustments.netAdjustment).toBe(150_000_000);
  });

  it('should apply loss carryforward', () => {
    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        10_000_000_000,
        6_000_000_000,
        3_000_000_000,
        200_000_000
      ),
      balanceSheet: createTestBalanceSheet(12_000_000_000),
      lossCarryforward: [
        {
          taxYear: 2022,
          originalLoss: 500_000_000,
          previouslyCompensated: 0,
          compensatedThisYear: 0,
          remainingLoss: 500_000_000,
          expiryYear: 2027,
          isExpired: false,
          hasExtendedPeriod: false,
        },
      ],
    };

    const result = calculateSPT1771(input);

    expect(result.taxCalculation.lossCarryforwardUsed).toBe(500_000_000);
    expect(result.lossCarryforward![0].compensatedThisYear).toBe(500_000_000);
    expect(result.lossCarryforward![0].remainingLoss).toBe(0);
  });

  it('should not use expired loss carryforward', () => {
    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        10_000_000_000,
        6_000_000_000,
        3_000_000_000,
        200_000_000
      ),
      balanceSheet: createTestBalanceSheet(12_000_000_000),
      lossCarryforward: [
        {
          taxYear: 2018, // Expired (> 5 years)
          originalLoss: 500_000_000,
          previouslyCompensated: 0,
          compensatedThisYear: 0,
          remainingLoss: 500_000_000,
          expiryYear: 2023, // Expired in 2023
          isExpired: true,
          hasExtendedPeriod: false,
        },
      ],
    };

    const result = calculateSPT1771(input);

    expect(result.taxCalculation.lossCarryforwardUsed).toBe(0);
  });

  it('should apply tax credits', () => {
    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        10_000_000_000,
        6_000_000_000,
        3_000_000_000,
        200_000_000
      ),
      balanceSheet: createTestBalanceSheet(12_000_000_000),
      taxCredits: {
        pph22Withheld: 50_000_000,
        pph23Withheld: 30_000_000,
        pph25Installments: 100_000_000,
      },
    };

    const result = calculateSPT1771(input);

    expect(result.taxCredits.pph22Withheld).toBe(50_000_000);
    expect(result.taxCredits.pph23Withheld).toBe(30_000_000);
    expect(result.taxCredits.pph25Installments).toBe(100_000_000);
    expect(result.taxCredits.totalTaxCredits).toBe(180_000_000);
  });

  it('should calculate tax payable when tax > credits', () => {
    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        10_000_000_000,
        5_000_000_000,
        3_000_000_000,
        400_000_000
      ),
      balanceSheet: createTestBalanceSheet(12_000_000_000),
      taxCredits: {
        pph25Installments: 100_000_000,
      },
    };

    const result = calculateSPT1771(input);

    expect(result.summary.status).toBe('KURANG_BAYAR');
    expect(result.summary.taxPayable).toBeGreaterThan(0);
    expect(result.summary.taxRefund).toBe(0);
  });

  it('should calculate tax refund when credits > tax', () => {
    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        5_000_000_000,
        3_500_000_000,
        1_000_000_000,
        100_000_000
      ),
      balanceSheet: createTestBalanceSheet(6_000_000_000),
      taxCredits: {
        pph25Installments: 500_000_000, // Much more than tax due
      },
    };

    const result = calculateSPT1771(input);

    expect(result.summary.status).toBe('LEBIH_BAYAR');
    expect(result.summary.taxRefund).toBeGreaterThan(0);
    expect(result.summary.taxPayable).toBe(0);
  });

  it('should track current year loss', () => {
    // Loss situation: COGS + Opex > Revenue
    const incomeStatement = createTestIncomeStatement(
      5_000_000_000,
      4_000_000_000,
      2_000_000_000,
      0
    );
    // This creates a loss of 1B

    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement,
      balanceSheet: createTestBalanceSheet(6_000_000_000),
    };

    const result = calculateSPT1771(input);

    // Operating loss of 1B (5B - 4B - 2B = -1B)
    expect(result.summary.currentYearLoss).toBeGreaterThan(0);
    expect(result.taxCalculation.taxableIncome).toBe(0);
  });
});

describe('SPT 1771 Validation', () => {
  it('should validate correct SPT 1771', () => {
    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        10_000_000_000,
        6_000_000_000,
        3_000_000_000,
        200_000_000
      ),
      balanceSheet: createTestBalanceSheet(12_000_000_000),
    };

    const sptData = calculateSPT1771(input);
    const result = validateSPT1771(sptData);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing company NPWP', () => {
    const company = createTestCompany();
    company.npwp = '';

    const input: SPT1771Input = {
      company,
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        10_000_000_000,
        6_000_000_000,
        3_000_000_000,
        200_000_000
      ),
      balanceSheet: createTestBalanceSheet(12_000_000_000),
    };

    const sptData = calculateSPT1771(input);
    const result = validateSPT1771(sptData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Company NPWP is required');
  });

  it('should warn about missing KLU code', () => {
    const company = createTestCompany();
    company.kluCode = '';

    const input: SPT1771Input = {
      company,
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        10_000_000_000,
        6_000_000_000,
        3_000_000_000,
        200_000_000
      ),
      balanceSheet: createTestBalanceSheet(12_000_000_000),
    };

    const sptData = calculateSPT1771(input);
    const result = validateSPT1771(sptData);

    expect(result.warnings).toContain('KLU code is not specified');
  });

  it('should detect unbalanced balance sheet', () => {
    const balanceSheet = createTestBalanceSheet(12_000_000_000);
    balanceSheet.assets.totalAssets = 15_000_000_000; // Mismatch

    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        10_000_000_000,
        6_000_000_000,
        3_000_000_000,
        200_000_000
      ),
      balanceSheet,
    };

    const sptData = calculateSPT1771(input);
    const result = validateSPT1771(sptData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Balance sheet does not balance: Assets ≠ Liabilities + Equity'
    );
  });

  it('should warn about missing related party transactions for large companies', () => {
    const input: SPT1771Input = {
      company: createTestCompany(),
      taxYear: 2024,
      fiscalYear: createTestFiscalYear(),
      incomeStatement: createTestIncomeStatement(
        60_000_000_000, // >= 50B
        35_000_000_000,
        10_000_000_000,
        3_000_000_000
      ),
      balanceSheet: createTestBalanceSheet(70_000_000_000),
    };

    const sptData = calculateSPT1771(input);
    const result = validateSPT1771(sptData);

    expect(result.warnings).toContain(
      'Companies with gross revenue >= Rp 50 billion should report related party transactions'
    );
  });
});

describe('Helper Functions', () => {
  describe('isAuditRequired', () => {
    it('should require audit for high revenue', () => {
      expect(isAuditRequired(60_000_000_000, 30_000_000_000)).toBe(true);
    });

    it('should require audit for high assets', () => {
      expect(isAuditRequired(30_000_000_000, 120_000_000_000)).toBe(true);
    });

    it('should not require audit for small companies', () => {
      expect(isAuditRequired(10_000_000_000, 15_000_000_000)).toBe(false);
    });
  });

  describe('UMKM Final Tax', () => {
    it('should allow UMKM final tax for revenue < 4.8B', () => {
      expect(canUseUMKMFinalTax(4_000_000_000)).toBe(true);
      expect(canUseUMKMFinalTax(1_000_000_000)).toBe(true);
    });

    it('should not allow UMKM final tax for revenue >= 4.8B', () => {
      expect(canUseUMKMFinalTax(4_800_000_000)).toBe(false);
      expect(canUseUMKMFinalTax(10_000_000_000)).toBe(false);
    });

    it('should calculate UMKM final tax at 0.5%', () => {
      expect(calculateUMKMFinalTax(1_000_000_000)).toBe(5_000_000);
      expect(calculateUMKMFinalTax(4_000_000_000)).toBe(20_000_000);
    });

    it('should return 0 for non-qualifying companies', () => {
      expect(calculateUMKMFinalTax(10_000_000_000)).toBe(0);
    });
  });

  describe('calculateIncomeStatementTotals', () => {
    it('should calculate all totals correctly', () => {
      const partial: Partial<CorporateIncomeStatement> = {
        grossRevenue: 10_000_000_000,
        salesReturns: 100_000_000,
        salesDiscounts: 50_000_000,
        costOfRevenue: {
          rawMaterials: 2_000_000_000,
          directLabor: 1_000_000_000,
          manufacturingOverhead: 500_000_000,
          beginningInventory: 1_000_000_000,
          endingInventory: 800_000_000,
          purchasesOfGoods: 1_500_000_000,
          freightIn: 100_000_000,
          otherDirectCosts: 200_000_000,
          totalCostOfRevenue: 0, // Will be calculated
        },
        operatingExpenses: {
          salariesAndWages: 1_000_000_000,
          employeeBenefits: 200_000_000,
          bonusesAndIncentives: 100_000_000,
          trainingAndDevelopment: 50_000_000,
          rentExpense: 300_000_000,
          utilitiesExpense: 100_000_000,
          maintenanceAndRepairs: 50_000_000,
          insuranceExpense: 80_000_000,
          securityExpense: 30_000_000,
          officeSupplies: 20_000_000,
          communicationExpense: 40_000_000,
          travelExpense: 60_000_000,
          entertainmentExpense: 40_000_000,
          advertisingExpense: 100_000_000,
          transportationExpense: 50_000_000,
          professionalFees: 50_000_000,
          auditFees: 30_000_000,
          legalFees: 20_000_000,
          consultingFees: 50_000_000,
          depreciation: 200_000_000,
          amortization: 50_000_000,
          bankCharges: 10_000_000,
          badDebtExpense: 30_000_000,
          donationsAndCSR: 20_000_000,
          researchAndDevelopment: 50_000_000,
          otherOperatingExpenses: 70_000_000,
          totalOperatingExpenses: 0, // Will be calculated
        },
      };

      const result = calculateIncomeStatementTotals(partial);

      expect(result.netRevenue).toBe(9_850_000_000); // 10B - 100M - 50M
      expect(result.costOfRevenue.totalCostOfRevenue).toBe(5_500_000_000);
      expect(result.grossProfit).toBe(4_350_000_000);
      expect(result.operatingExpenses.totalOperatingExpenses).toBe(2_800_000_000);
      expect(result.operatingIncome).toBe(1_550_000_000);
    });
  });

  describe('createEmptyIncomeStatement', () => {
    it('should create empty income statement with all zeros', () => {
      const stmt = createEmptyIncomeStatement();

      expect(stmt.grossRevenue).toBe(0);
      expect(stmt.netRevenue).toBe(0);
      expect(stmt.costOfRevenue.totalCostOfRevenue).toBe(0);
      expect(stmt.operatingExpenses.totalOperatingExpenses).toBe(0);
      expect(stmt.netIncome).toBe(0);
    });
  });

  describe('createEmptyBalanceSheet', () => {
    it('should create empty balance sheet with all zeros', () => {
      const bs = createEmptyBalanceSheet();

      expect(bs.assets.totalAssets).toBe(0);
      expect(bs.liabilities.totalLiabilities).toBe(0);
      expect(bs.equity.totalEquity).toBe(0);
    });
  });
});

describe('Auto-detect Fiscal Adjustments', () => {
  it('should detect income tax expense', () => {
    const stmt = createTestIncomeStatement(
      10_000_000_000,
      6_000_000_000,
      3_000_000_000,
      200_000_000
    );

    const detected = detectFiscalAdjustments(stmt);

    expect(detected.incomeTaxExpense).toBe(200_000_000);
  });

  it('should detect entertainment expense (50% assumption)', () => {
    const stmt = createTestIncomeStatement(
      10_000_000_000,
      6_000_000_000,
      3_000_000_000,
      200_000_000
    );
    stmt.operatingExpenses.entertainmentExpense = 100_000_000;

    const detected = detectFiscalAdjustments(stmt);

    expect(detected.entertainmentWithoutDaftarNominatif).toBe(50_000_000);
  });

  it('should detect bank interest as final tax', () => {
    const stmt = createTestIncomeStatement(
      10_000_000_000,
      6_000_000_000,
      3_000_000_000,
      200_000_000
    );
    stmt.otherIncome.interestIncome = 30_000_000;

    const detected = detectFiscalAdjustments(stmt);

    expect(detected.bankInterestFinalTax).toBe(30_000_000);
  });

  it('should detect domestic dividends as exempt', () => {
    const stmt = createTestIncomeStatement(
      10_000_000_000,
      6_000_000_000,
      3_000_000_000,
      200_000_000
    );
    stmt.otherIncome.dividendIncome = 150_000_000;

    const detected = detectFiscalAdjustments(stmt);

    expect(detected.dividendFromDomestic).toBe(150_000_000);
  });
});
