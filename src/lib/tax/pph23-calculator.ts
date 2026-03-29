import { PPH23_RATES } from '@/config/constants';
import type { PPh23Data } from '@/types';

export interface PPh23Calculation {
  gross_amount: number;
  tax_rate: number;
  tax_amount: number;
  net_amount: number;
  /** True if 100% NPWP surcharge was applied (Pasal 23(1a)) */
  npwp_surcharge_applied?: boolean;
  /** Effective rate after surcharge */
  effective_rate?: number;
}

/**
 * PPh 23 Calculator - Indonesian Withholding Tax Article 23
 * Calculates tax on dividends, interest, royalties, prizes, rent, and services
 *
 * Per Pasal 23(1a) UU PPh: Recipients without NPWP are subject to
 * 100% higher rate (effectively double the standard rate).
 * - Dividend 15% → 30%, Interest 15% → 30%, Royalty 15% → 30%
 * - Rent 2% → 4%, Service 2% → 4%
 */
export class PPh23Calculator {
  /**
   * Determine if NPWP surcharge applies for PPh 23.
   * Per Pasal 23(1a): no NPWP = 100% higher rate (double).
   */
  private static shouldApplyNpwpSurcharge(data: PPh23Data): boolean {
    if (data.has_npwp === true) return false;
    if (data.has_npwp === false) return true;
    return !data.recipient_npwp || data.recipient_npwp.trim() === '';
  }

  /**
   * Calculate PPh 23 for a transaction
   */
  static calculate(data: PPh23Data): PPh23Calculation {
    const baseRate = this.getTaxRate(data.transaction_type);
    const applyNpwpSurcharge = this.shouldApplyNpwpSurcharge(data);

    // No NPWP = 100% higher rate (Pasal 23(1a))
    const effectiveRate = applyNpwpSurcharge ? baseRate * 2 : baseRate;
    const taxAmount = Math.round(data.gross_amount * effectiveRate);
    const netAmount = data.gross_amount - taxAmount;

    return {
      gross_amount: data.gross_amount,
      tax_rate: baseRate,
      tax_amount: taxAmount,
      net_amount: netAmount,
      npwp_surcharge_applied: applyNpwpSurcharge,
      effective_rate: applyNpwpSurcharge ? effectiveRate : undefined,
    };
  }

  /**
   * Get tax rate based on transaction type
   */
  static getTaxRate(transactionType: PPh23Data['transaction_type']): number {
    const rateMap: Record<PPh23Data['transaction_type'], number> = {
      dividend: PPH23_RATES.DIVIDEND,
      interest: PPH23_RATES.INTEREST,
      royalty: PPH23_RATES.ROYALTY,
      prize: PPH23_RATES.PRIZE,
      rent: PPH23_RATES.RENT,
      service: PPH23_RATES.SERVICE,
    };

    return rateMap[transactionType];
  }

  /**
   * Get all transaction types with their rates
   */
  static getTransactionTypes(): Array<{
    type: PPh23Data['transaction_type'];
    description: string;
    rate: number;
  }> {
    return [
      { type: 'dividend', description: 'Dividen', rate: PPH23_RATES.DIVIDEND },
      { type: 'interest', description: 'Bunga', rate: PPH23_RATES.INTEREST },
      { type: 'royalty', description: 'Royalti', rate: PPH23_RATES.ROYALTY },
      { type: 'prize', description: 'Hadiah dan Penghargaan', rate: PPH23_RATES.PRIZE },
      { type: 'rent', description: 'Sewa (selain tanah/bangunan)', rate: PPH23_RATES.RENT },
      { type: 'service', description: 'Jasa Teknik, Manajemen, dll', rate: PPH23_RATES.SERVICE },
    ];
  }

  /**
   * Calculate bulk PPh 23 for multiple transactions
   */
  static calculateBulk(transactions: PPh23Data[]): {
    calculations: PPh23Calculation[];
    totalGross: number;
    totalTax: number;
    totalNet: number;
  } {
    const calculations = transactions.map((t) => this.calculate(t));
    const totalGross = calculations.reduce((sum, c) => sum + c.gross_amount, 0);
    const totalTax = calculations.reduce((sum, c) => sum + c.tax_amount, 0);
    const totalNet = calculations.reduce((sum, c) => sum + c.net_amount, 0);

    return {
      calculations,
      totalGross,
      totalTax,
      totalNet,
    };
  }
}
