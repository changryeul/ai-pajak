import { PPH23_RATES } from '@/config/constants';
import type { PPh23Data } from '@/types';

export interface PPh23Calculation {
  gross_amount: number;
  tax_rate: number;
  tax_amount: number;
  net_amount: number;
}

/**
 * PPh 23 Calculator - Indonesian Withholding Tax Article 23
 * Calculates tax on dividends, interest, royalties, prizes, rent, and services
 */
export class PPh23Calculator {
  /**
   * Calculate PPh 23 for a transaction
   */
  static calculate(data: PPh23Data): PPh23Calculation {
    const rate = this.getTaxRate(data.transaction_type);
    const taxAmount = data.gross_amount * rate;
    const netAmount = data.gross_amount - taxAmount;

    return {
      gross_amount: data.gross_amount,
      tax_rate: rate,
      tax_amount: taxAmount,
      net_amount: netAmount,
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
