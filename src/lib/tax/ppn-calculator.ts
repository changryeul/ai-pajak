import { getPPNRate } from '@/config/tax-rates';
import type { PPNData, PPNItem } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { loggers } from '@/lib/logger';

export interface PPNCalculation {
  original_dpp: number;
  adjusted_dpp: number; // DPP after PMK 131/2024 adjustment
  ppn_rate: number;
  ppn_amount: number;
  total_with_ppn: number;
  is_luxury_item: boolean;
  legal_basis: string;
}

export interface PPNSummary {
  output_tax: number; // PPN Keluaran (sales)
  input_tax: number; // PPN Masukan (purchases)
  net_tax: number; // Selisih yang harus dibayar/dikreditkan
  status: 'payable' | 'creditable';
}

/**
 * PPN Calculator - Indonesian Value Added Tax
 *
 * Implements PMK 131/2024:
 * - 2025-01-01 onwards: 12% statutory rate
 * - Non-luxury items: DPP × (11/12) adjustment → effective 11% PPN
 * - Luxury items: Full 12% PPN
 */
export class PPNCalculator {
  /**
   * Check if an item is classified as luxury
   *
   * @param itemName - Item name to check
   * @param hsCode - Optional HS Code for precise matching
   * @returns True if luxury item, false otherwise
   */
  static async isLuxuryItem(itemName: string, hsCode?: string): Promise<boolean> {
    const supabase = createClient();

    try {
      let query = supabase
        .from('luxury_item_classifications')
        .select('category');

      if (hsCode) {
        query = query.eq('hs_code', hsCode);
      } else {
        query = query.ilike('item_name', `%${itemName}%`);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        // If not found in luxury classifications, assume essential (safe default)
        return false;
      }

      return data.category === 'LUXURY';
    } catch (error) {
      // On error, default to non-luxury (safer for taxpayer)
      loggers.tax.warn({ err: error }, 'Luxury item check failed');
      return false;
    }
  }

  /**
   * Calculate effective PPN rate based on date and luxury status
   *
   * PMK 131/2024:
   * - Before 2025-01-01: 11% for all
   * - From 2025-01-01:
   *   - Luxury: 12% (full statutory rate)
   *   - Essential: 11% (effective, via DPP adjustment)
   */
  static calculateEffectivePPNRate(
    transactionDate: Date,
    isLuxury: boolean
  ): number {
    const year = transactionDate.getFullYear();

    // Before 2025, always 11%
    if (year < 2025) {
      return 0.11;
    }

    // From 2025-01-01 onwards
    if (isLuxury) {
      return 0.12; // Luxury: Full 12%
    } else {
      return 0.11; // Essential: Effective 11% (DPP adjusted)
    }
  }

  /**
   * Adjust DPP for non-luxury items (PMK 131/2024)
   *
   * For essential goods from 2025-01-01:
   * Adjusted DPP = Original DPP × (11/12)
   * Then apply 12% rate to adjusted DPP
   * Result: Effective 11% on original DPP
   */
  static adjustDPP(
    dpp: number,
    transactionDate: Date,
    isLuxury: boolean
  ): number {
    const year = transactionDate.getFullYear();

    // Before 2025 or luxury items: no adjustment
    if (year < 2025 || isLuxury) {
      return dpp;
    }

    // PMK 131/2024: DPP × (11/12) for essential goods
    return Math.round(dpp * (11 / 12));
  }

  /**
   * Calculate PPN for a single transaction
   *
   * @param params - Transaction parameters
   * @returns PPN calculation result
   */
  static async calculate(params: {
    dpp: number;
    transactionDate: Date;
    itemName: string;
    hsCode?: string;
  }): Promise<PPNCalculation> {
    const { dpp, transactionDate, itemName, hsCode } = params;

    // 1. Check if luxury item
    const isLuxury = await this.isLuxuryItem(itemName, hsCode);

    // 2. Adjust DPP if needed (PMK 131/2024)
    const adjustedDPP = this.adjustDPP(dpp, transactionDate, isLuxury);

    // 3. PPN = statutory rate × adjusted DPP (DJP SPT Masa PPN form rule).
    // 2026-06-29: essential 의 11/12 이중 적용 버그 fix (calculateSimple 참고).
    const year = transactionDate.getFullYear();
    const statutoryRate = year < 2025 ? 0.11 : 0.12;
    const ppnAmount = Math.round(adjustedDPP * statutoryRate);
    // Reported `ppn_rate` is the effective rate vs ORIGINAL dpp.
    const effectiveRate = this.calculateEffectivePPNRate(transactionDate, isLuxury);

    // 5. Determine legal basis
    let legalBasis: string;
    if (year < 2025) {
      legalBasis = 'UU HPP 2021 - PPN 11%';
    } else {
      legalBasis = isLuxury
        ? 'PMK 131/2024 Pasal 2 - Luxury item 12%'
        : 'PMK 131/2024 Pasal 3 - Essential item effective 11%';
    }

    return {
      original_dpp: dpp,
      adjusted_dpp: adjustedDPP,
      ppn_rate: effectiveRate,
      ppn_amount: ppnAmount,
      total_with_ppn: adjustedDPP + ppnAmount,
      is_luxury_item: isLuxury,
      legal_basis: legalBasis
    };
  }

  /**
   * Calculate PPN without DB lookup (for known luxury status).
   *
   * 2026-06-29 FIX — PMK 131/2024 정합:
   *   DJP SPT Masa PPN form: PPN = statutory 12% × DPP Nilai Lain (adjusted DPP).
   *   - Essential 2025+: adjustedDPP = DPP × 11/12, then 12% × adjusted = DPP × 11%.
   *   - Luxury 2025+:    adjustedDPP = DPP,         then 12% × adjusted = DPP × 12%.
   *   - Pre-2025:        adjustedDPP = DPP,         then 11% × adjusted = DPP × 11%.
   *
   * 이전 버그: calculateEffectivePPNRate() 가 essential 에 0.11 (effective on
   * original DPP) 을 돌려주는데, 이를 adjustedDPP 에 곱해서 dpp × 11/12 × 11%
   * = dpp × 10.08% 로 11/12 조정이 이중 적용되던 버그.
   * → essential 2025+ 에서는 statutory 12% 를 사용해 calc.
   */
  static calculateSimple(
    dpp: number,
    transactionDate: Date,
    isLuxury: boolean = false
  ): Omit<PPNCalculation, 'legal_basis'> {
    const adjustedDPP = this.adjustDPP(dpp, transactionDate, isLuxury);
    const year = transactionDate.getFullYear();
    // Statutory rate to multiply against adjustedDPP. Pre-2025 = 11% (no
    // adjustment, single statutory). 2025+ = 12% statutory (DJP form rule).
    const statutoryRate = year < 2025 ? 0.11 : 0.12;
    const ppnAmount = Math.round(adjustedDPP * statutoryRate);
    // Reported `ppn_rate` is the effective rate vs ORIGINAL dpp (for UX),
    // not the statutory rate used in the line above.
    const effectiveRate = this.calculateEffectivePPNRate(transactionDate, isLuxury);

    return {
      original_dpp: dpp,
      adjusted_dpp: adjustedDPP,
      ppn_rate: effectiveRate,
      ppn_amount: ppnAmount,
      total_with_ppn: adjustedDPP + ppnAmount,
      is_luxury_item: isLuxury
    };
  }

  /**
   * Calculate DPP from total amount (inclusive of PPN)
   *
   * Note: This is a simplified reverse calculation
   * Assumes non-luxury item for safety
   */
  static calculateDPPFromTotal(
    totalWithPPN: number,
    transactionDate: Date,
    isLuxury: boolean = false
  ): number {
    const rate = this.calculateEffectivePPNRate(transactionDate, isLuxury);
    const adjustedDPP = totalWithPPN / (1 + rate);

    // If non-luxury in 2025+, reverse the DPP adjustment
    if (transactionDate.getFullYear() >= 2025 && !isLuxury) {
      return Math.round(adjustedDPP * (12 / 11));
    }

    return Math.round(adjustedDPP);
  }

  /**
   * Calculate PPN for invoice items
   */
  static async calculateInvoice(params: {
    items: PPNItem[];
    transactionDate: Date;
    itemName: string;
    hsCode?: string;
  }): Promise<PPNCalculation> {
    const totalDPP = params.items.reduce((sum, item) => sum + item.total, 0);

    return this.calculate({
      dpp: totalDPP,
      transactionDate: params.transactionDate,
      itemName: params.itemName,
      hsCode: params.hsCode
    });
  }

  /**
   * Calculate monthly PPN summary (output - input)
   */
  static calculateMonthlySummary(
    salesTransactions: PPNData[],
    purchaseTransactions: PPNData[]
  ): PPNSummary {
    const outputTax = salesTransactions.reduce((sum, t) => sum + t.ppn_amount, 0);
    const inputTax = purchaseTransactions.reduce((sum, t) => sum + t.ppn_amount, 0);
    const netTax = outputTax - inputTax;

    return {
      output_tax: outputTax,
      input_tax: inputTax,
      net_tax: Math.abs(netTax),
      status: netTax >= 0 ? 'payable' : 'creditable',
    };
  }

  /**
   * Get PPN rate for a specific date
   *
   * Returns statutory rate (not effective rate)
   */
  static getRate(transactionDate: Date): number {
    return getPPNRate(transactionDate);
  }

  /**
   * Get rate as percentage
   */
  static getRatePercentage(transactionDate: Date): number {
    return this.getRate(transactionDate) * 100;
  }

  /**
   * Validate Faktur Pajak number format
   * Format: XXX.XXX-XX.XXXXXXXX
   */
  static validateFakturPajakNumber(number: string): boolean {
    const pattern = /^\d{3}\.\d{3}-\d{2}\.\d{8}$/;
    return pattern.test(number);
  }

  /**
   * Generate Faktur Pajak number
   *
   * Format: KKK.FFF-YY.NNNNNNNN
   * - KKK: Transaction code (001-009)
   * - FFF: Branch code (usually 000)
   * - YY: Year (last 2 digits)
   * - NNNNNNNN: Sequential number (8 digits)
   */
  static generateFakturPajakNumber(
    kodeTransaksi: string,
    tahun: string,
    nomorUrut: number
  ): string {
    const kode = kodeTransaksi.padStart(3, '0');
    const year = tahun.slice(-2);
    const urut = nomorUrut.toString().padStart(8, '0');
    return `${kode}.000-${year}.${urut}`;
  }
}
