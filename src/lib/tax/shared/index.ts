/**
 * Shared Tax Module
 *
 * Common types, constants, and utilities used across all SPT forms
 * (1770 SS, 1770 S, 1770, 1771)
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Tax calculation utilities
export {
  calculateProgressiveTax,
  calculateCorporateTax,
  getTaxBracketDetails,
  calculateTaxStatus,
  getPTKPAmount,
  getPTKPDescription,
  buildPTKPStatus,
  getSPTDeadline,
  isSPTLate,
  calculateLateFilingDays,
  formatRupiah,
  formatNumber,
  formatPercentage,
  formatDateID,
  formatDateLongID,
  calculatePositionCosts,
  calculateNetIncome,
  roundToThousand,
  floorToThousand,
} from './tax-utils';

// Validation utilities
export {
  isValidNPWPFormat,
  formatNPWP,
  maskNPWP,
  validateNPWPCheckDigit,
  isValidNIKFormat,
  formatNIK,
  maskNIK,
  extractNIKRegion,
  isValidTaxPeriod,
  parseTaxPeriod,
  validateTaxpayerData,
  validateCorporateIdentity,
  isValidAmount,
  validateIncomeConsistency,
  isValidBillingCode,
  isValidNTPN,
} from './validation-utils';
