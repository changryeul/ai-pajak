/**
 * SPT 1771 Module
 *
 * Corporate annual tax return for:
 * - PT (Perseroan Terbatas)
 * - CV (Commanditaire Vennootschap)
 * - Firma
 * - Koperasi
 * - Yayasan
 * - Other corporate entities
 *
 * Key features:
 * - 22% standard corporate tax rate
 * - 11% SME rate for gross revenue < 50B
 * - Fiscal adjustments (koreksi fiskal)
 * - 5-10 year loss carryforward
 * - Transfer pricing documentation
 */

// Types
export * from './types';

// Fiscal adjustment calculator
export {
  calculateFiscalAdjustments,
  detectFiscalAdjustments,
  calculateDepreciationAdjustment,
  calculateEntertainmentAdjustment,
  calculateDonationAdjustment,
  convertToSPT1771Adjustments,
  validateFiscalAdjustments,
  type FiscalAdjustmentInput,
  type FiscalAdjustmentItem,
} from './fiscal-adjustment';

// Main calculator
export {
  calculateSPT1771,
  validateSPT1771,
  createEmptyIncomeStatement,
  createEmptyBalanceSheet,
  calculateIncomeStatementTotals,
  isAuditRequired,
  canUseUMKMFinalTax,
  calculateUMKMFinalTax,
  formatRupiah,
  formatNumber,
  type SPT1771Input,
} from './calculator';

// PDF Generator
export { SPT1771PDF, generateSPT1771PDFBuffer } from './pdf-generator';
