/**
 * SPT 1770 S Module
 *
 * Annual tax return for individuals with:
 * - Annual gross income >= Rp 60 million, OR
 * - Multiple sources of employment income
 */

// Types
export * from './types';

// Calculator
export {
  calculateSPT1770S,
  calculateSummary,
  validateSPT1770S,
  checkSPT1770SEligibility,
  formatRupiah,
  formatNumber,
  getPTKPDescription,
  getPTKPAmount,
} from './calculator';

// PDF Generator
export { SPT1770SPDF, generateSPT1770SPDFBuffer } from './pdf-generator';
