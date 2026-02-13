/**
 * SPT 1770 Module
 *
 * Annual tax return for individuals with:
 * - Business income (penghasilan dari usaha)
 * - Freelance/professional income (pekerjaan bebas)
 * - Combined employment and business income
 */

// Types
export * from './types';

// Business income calculator
export {
  calculateBusinessIncome,
  calculateMultipleBusinessIncomes,
  calculatePembukuanIncome,
  calculateNormaIncome,
  validateBusinessIncome,
  type BusinessIncomeInput,
} from './business-calculator';

// Depreciation calculator
export {
  calculateAssetDepreciation,
  calculateMultipleAssetsDepreciation,
  generateDepreciationSchedule,
  getDepreciationCategory,
  calculateRemainingUsefulLife,
  isFullyDepreciated,
  type DepreciationAssetInput,
} from './depreciation-calculator';

// Main calculator
export {
  calculateSPT1770,
  calculateSummary,
  validateSPT1770,
  formatRupiah,
  formatNumber,
  getPTKPDescription,
  getPTKPAmount,
  type SPT1770Input,
} from './calculator';
