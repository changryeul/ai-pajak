/**
 * Business Income Calculator for SPT 1770
 *
 * Calculates net business income using either:
 * - Pembukuan (full bookkeeping) method
 * - Norma (deemed profit) method
 */

import type {
  SPT1770BusinessIncome,
  COGSData,
  SPT1770OperatingExpenses,
  SPT1770DepreciationItem,
  BusinessType,
  BookkeepingMethod,
} from './types';
import { getNormaPercentage, isBookkeepingRequired } from './types';
import {
  calculateMultipleAssetsDepreciation,
  DepreciationAssetInput,
} from './depreciation-calculator';

/**
 * Input for business income calculation
 */
export interface BusinessIncomeInput {
  businessId: string;
  businessName: string;
  businessType: BusinessType;
  kluCode: string;
  bookkeepingMethod: BookkeepingMethod;

  // Revenue
  grossRevenue: number;
  returnsAndAllowances?: number;

  // For Pembukuan method
  cogs?: Partial<COGSData>;
  operatingExpenses?: Partial<SPT1770OperatingExpenses>;
  assets?: DepreciationAssetInput[];

  // For Norma method (optional override)
  customNormaPercentage?: number;

  // Period
  periodStart?: string;
  periodEnd?: string;
}

/**
 * Calculate business income using Pembukuan method
 */
export function calculatePembukuanIncome(
  input: BusinessIncomeInput,
  taxYear: number
): SPT1770BusinessIncome {
  const {
    businessId,
    businessName,
    businessType,
    kluCode,
    grossRevenue,
    returnsAndAllowances = 0,
    cogs: cogsInput,
    operatingExpenses: expensesInput,
    assets,
    periodStart = '01',
    periodEnd = '12',
  } = input;

  // Calculate net revenue
  const netRevenue = grossRevenue - returnsAndAllowances;

  // Calculate COGS
  let cogs: COGSData | undefined;
  let totalCOGS = 0;

  if (
    cogsInput &&
    (businessType === 'TRADING' || businessType === 'MANUFACTURING')
  ) {
    const netPurchases =
      (cogsInput.purchases || 0) +
      (cogsInput.freightIn || 0) -
      (cogsInput.purchaseReturns || 0) -
      (cogsInput.purchaseDiscounts || 0);

    const goodsAvailable =
      (cogsInput.beginningInventory || 0) + netPurchases;

    totalCOGS = goodsAvailable - (cogsInput.endingInventory || 0);

    cogs = {
      beginningInventory: cogsInput.beginningInventory || 0,
      purchases: cogsInput.purchases || 0,
      freightIn: cogsInput.freightIn || 0,
      purchaseReturns: cogsInput.purchaseReturns || 0,
      purchaseDiscounts: cogsInput.purchaseDiscounts || 0,
      netPurchases,
      goodsAvailable,
      endingInventory: cogsInput.endingInventory || 0,
      costOfGoodsSold: totalCOGS,
    };
  }

  // Gross profit
  const grossProfit = netRevenue - totalCOGS;

  // Calculate operating expenses
  const operatingExpenses = normalizeOperatingExpenses(expensesInput);
  const totalExpenses = operatingExpenses.totalExpenses;

  // Calculate depreciation
  let depreciation: SPT1770DepreciationItem[] = [];
  let totalDepreciation = 0;

  if (assets && assets.length > 0) {
    const depreciationResult = calculateMultipleAssetsDepreciation(
      assets,
      taxYear
    );
    depreciation = depreciationResult.items;
    totalDepreciation = depreciationResult.totalCurrentYearDepreciation;
  }

  // Net business income
  const netBusinessIncome = grossProfit - totalExpenses - totalDepreciation;

  return {
    businessId,
    businessName,
    businessType,
    kluCode,
    bookkeepingMethod: 'PEMBUKUAN',
    grossRevenue,
    returnsAndAllowances,
    netRevenue,
    cogs,
    grossProfit,
    operatingExpenses,
    depreciation,
    totalDepreciation,
    netBusinessIncome,
    periodStart,
    periodEnd,
  };
}

/**
 * Calculate business income using Norma method
 */
export function calculateNormaIncome(
  input: BusinessIncomeInput
): SPT1770BusinessIncome {
  const {
    businessId,
    businessName,
    businessType,
    kluCode,
    grossRevenue,
    returnsAndAllowances = 0,
    customNormaPercentage,
    periodStart = '01',
    periodEnd = '12',
  } = input;

  // Check if Norma is allowed
  if (isBookkeepingRequired(grossRevenue)) {
    throw new Error(
      `Norma method not allowed for gross revenue >= Rp 4.8 billion. Use Pembukuan method instead.`
    );
  }

  // Get Norma percentage
  const normaPercentage = customNormaPercentage || getNormaPercentage(kluCode);

  // Calculate net revenue
  const netRevenue = grossRevenue - returnsAndAllowances;

  // For Norma method, deemed profit = net revenue * norma percentage
  const netBusinessIncome = Math.round(netRevenue * normaPercentage);

  // Gross profit is the same as net business income for Norma
  // (no COGS or expenses tracked separately)
  const grossProfit = netBusinessIncome;

  return {
    businessId,
    businessName,
    businessType,
    kluCode,
    bookkeepingMethod: 'NORMA',
    normaPercentage,
    grossRevenue,
    returnsAndAllowances,
    netRevenue,
    grossProfit,
    depreciation: [],
    totalDepreciation: 0,
    netBusinessIncome,
    periodStart,
    periodEnd,
  };
}

/**
 * Calculate business income (auto-selects method)
 */
export function calculateBusinessIncome(
  input: BusinessIncomeInput,
  taxYear: number
): SPT1770BusinessIncome {
  if (input.bookkeepingMethod === 'NORMA') {
    return calculateNormaIncome(input);
  }
  return calculatePembukuanIncome(input, taxYear);
}

/**
 * Calculate multiple business incomes
 */
export function calculateMultipleBusinessIncomes(
  inputs: BusinessIncomeInput[],
  taxYear: number
): {
  businesses: SPT1770BusinessIncome[];
  totalNetBusinessIncome: number;
  totalGrossRevenue: number;
  totalDepreciation: number;
} {
  const businesses = inputs.map((input) =>
    calculateBusinessIncome(input, taxYear)
  );

  const totalNetBusinessIncome = businesses.reduce(
    (sum, b) => sum + b.netBusinessIncome,
    0
  );

  const totalGrossRevenue = businesses.reduce(
    (sum, b) => sum + b.grossRevenue,
    0
  );

  const totalDepreciation = businesses.reduce(
    (sum, b) => sum + b.totalDepreciation,
    0
  );

  return {
    businesses,
    totalNetBusinessIncome,
    totalGrossRevenue,
    totalDepreciation,
  };
}

/**
 * Normalize operating expenses with defaults
 */
function normalizeOperatingExpenses(
  input?: Partial<SPT1770OperatingExpenses>
): SPT1770OperatingExpenses {
  const expenses: SPT1770OperatingExpenses = {
    salaries: input?.salaries || 0,
    employeeBenefits: input?.employeeBenefits || 0,
    bonuses: input?.bonuses || 0,
    rent: input?.rent || 0,
    utilities: input?.utilities || 0,
    insurance: input?.insurance || 0,
    repairs: input?.repairs || 0,
    supplies: input?.supplies || 0,
    travel: input?.travel || 0,
    transportation: input?.transportation || 0,
    entertainment: input?.entertainment || 0,
    advertising: input?.advertising || 0,
    professionalFees: input?.professionalFees || 0,
    bankCharges: input?.bankCharges || 0,
    otherExpenses: input?.otherExpenses || 0,
    nonDeductibleExpenses: input?.nonDeductibleExpenses,
    totalExpenses: 0,
  };

  // Calculate total deductible expenses
  expenses.totalExpenses =
    expenses.salaries +
    expenses.employeeBenefits +
    expenses.bonuses +
    expenses.rent +
    expenses.utilities +
    expenses.insurance +
    expenses.repairs +
    expenses.supplies +
    expenses.travel +
    expenses.transportation +
    expenses.entertainment +
    expenses.advertising +
    expenses.professionalFees +
    expenses.bankCharges +
    expenses.otherExpenses;

  return expenses;
}

/**
 * Validate business income data
 */
export function validateBusinessIncome(
  business: SPT1770BusinessIncome
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!business.businessName) {
    errors.push('Nama usaha tidak boleh kosong');
  }

  if (!business.kluCode) {
    errors.push('Kode KLU tidak boleh kosong');
  } else if (!/^\d{5}$/.test(business.kluCode)) {
    errors.push('Kode KLU harus 5 digit');
  }

  if (business.grossRevenue < 0) {
    errors.push('Pendapatan bruto tidak boleh negatif');
  }

  // Validate based on method
  if (business.bookkeepingMethod === 'NORMA') {
    if (business.grossRevenue >= 4_800_000_000) {
      errors.push(
        'Metode Norma tidak dapat digunakan untuk pendapatan >= Rp 4,8 miliar'
      );
    }
  }

  // Warnings
  if (business.netBusinessIncome < 0) {
    warnings.push('Usaha mengalami kerugian');
  }

  if (
    business.bookkeepingMethod === 'PEMBUKUAN' &&
    business.operatingExpenses
  ) {
    const expenseRatio =
      business.operatingExpenses.totalExpenses / business.grossRevenue;
    if (expenseRatio > 0.8) {
      warnings.push(
        'Rasio biaya operasional sangat tinggi (>80% dari pendapatan)'
      );
    }
  }

  // COGS validation for trading businesses
  if (
    business.cogs &&
    (business.businessType === 'TRADING' ||
      business.businessType === 'MANUFACTURING')
  ) {
    if (business.cogs.endingInventory > business.cogs.goodsAvailable) {
      errors.push('Persediaan akhir tidak boleh melebihi barang tersedia');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
