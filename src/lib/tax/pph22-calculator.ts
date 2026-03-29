import type { PPh22Data, PPh22Calculation } from '@/types';

/**
 * PPh 22 Domestic Transaction Rates
 * Per PMK 34/PMK.010/2017, PMK 199/PMK.010/2019
 */
const PPH22_RATES: Record<string, {
  rate: number;
  rateNoNpwp: number;
  label: string;
  legalBasis: string;
}> = {
  // Government procurement (Bendahara Pemerintah)
  GOVERNMENT_PROCUREMENT: {
    rate: 0.015,        // 1.5%
    rateNoNpwp: 0.03,   // 3% (double)
    label: 'Pembelian oleh Bendahara Pemerintah',
    legalBasis: 'Pasal 22 ayat (1) huruf b UU PPh',
  },
  // Certain goods by appointed collectors
  CEMENT: {
    rate: 0.0025,       // 0.25%
    rateNoNpwp: 0.005,
    label: 'Penjualan Semen',
    legalBasis: 'PMK 34/PMK.010/2017',
  },
  PAPER: {
    rate: 0.001,        // 0.1%
    rateNoNpwp: 0.002,
    label: 'Penjualan Kertas',
    legalBasis: 'PMK 34/PMK.010/2017',
  },
  STEEL: {
    rate: 0.003,        // 0.3%
    rateNoNpwp: 0.006,
    label: 'Penjualan Baja',
    legalBasis: 'PMK 34/PMK.010/2017',
  },
  AUTOMOTIVE: {
    rate: 0.0045,       // 0.45%
    rateNoNpwp: 0.009,
    label: 'Penjualan Kendaraan Bermotor',
    legalBasis: 'PMK 34/PMK.010/2017',
  },
  PHARMACEUTICAL: {
    rate: 0.003,        // 0.3%
    rateNoNpwp: 0.006,
    label: 'Penjualan Farmasi',
    legalBasis: 'PMK 34/PMK.010/2017',
  },
  // Large retailers/distributors
  LARGE_RETAILER: {
    rate: 0.0025,       // 0.25%
    rateNoNpwp: 0.005,
    label: 'Pembelian oleh Distributor/Pedagang Besar',
    legalBasis: 'PMK 34/PMK.010/2017',
  },
  // Fuel sales (Pertamina, etc.)
  FUEL_PERTAMINA: {
    rate: 0.0025,       // 0.25%
    rateNoNpwp: 0.005,
    label: 'Penjualan BBM oleh Produsen/Importir',
    legalBasis: 'PMK 34/PMK.010/2017',
  },
  FUEL_NON_SUBSIDY: {
    rate: 0.003,        // 0.3%
    rateNoNpwp: 0.006,
    label: 'Penjualan BBM Non-Subsidi',
    legalBasis: 'PMK 34/PMK.010/2017',
  },
  // Luxury goods purchaser (high-value)
  LUXURY_GOODS: {
    rate: 0.05,         // 5%
    rateNoNpwp: 0.10,
    label: 'Pembelian Barang Sangat Mewah',
    legalBasis: 'PMK 92/PMK.03/2019',
  },
  // Import (for reference - actual import uses customs route)
  IMPORT_API: {
    rate: 0.025,        // 2.5% with API (Angka Pengenal Impor)
    rateNoNpwp: 0.075,  // 7.5% without API
    label: 'Impor dengan API',
    legalBasis: 'PMK 34/PMK.010/2017',
  },
  IMPORT_NON_API: {
    rate: 0.075,        // 7.5%
    rateNoNpwp: 0.15,   // 15%
    label: 'Impor tanpa API',
    legalBasis: 'PMK 34/PMK.010/2017',
  },
};

/**
 * PPh 22 Calculator - Indonesian Withholding Tax Article 22
 *
 * PPh 22 is collected on certain domestic transactions including
 * government procurement, sales of specific goods (cement, steel, etc.),
 * fuel sales, and luxury goods purchases.
 *
 * Without NPWP: rate is doubled (100% surcharge).
 */
export class PPh22Calculator {
  /**
   * Calculate PPh 22 for a domestic transaction
   */
  static calculate(data: PPh22Data): PPh22Calculation {
    const rateInfo = PPH22_RATES[data.transaction_type];
    if (!rateInfo) {
      throw new Error(`Unknown PPh 22 transaction type: ${data.transaction_type}`);
    }

    const hasNpwp = this.hasNpwp(data);
    const appliedRate = hasNpwp ? rateInfo.rate : rateInfo.rateNoNpwp;
    const taxAmount = Math.round(data.gross_amount * appliedRate);

    return {
      gross_amount: data.gross_amount,
      base_rate: rateInfo.rate,
      applied_rate: appliedRate,
      tax_amount: taxAmount,
      net_amount: data.gross_amount - taxAmount,
      npwp_surcharge_applied: !hasNpwp,
      transaction_label: rateInfo.label,
      legal_basis: rateInfo.legalBasis,
      is_creditable: data.transaction_type !== 'LUXURY_GOODS', // Most PPh 22 is creditable
    };
  }

  private static hasNpwp(data: PPh22Data): boolean {
    if (data.has_npwp === true) return true;
    if (data.has_npwp === false) return false;
    return !!data.payer_npwp && data.payer_npwp.trim() !== '';
  }

  /**
   * Get all PPh 22 transaction types with rates
   */
  static getTransactionTypes(): Array<{
    type: string;
    label: string;
    rate: number;
    rateNoNpwp: number;
    legalBasis: string;
  }> {
    return Object.entries(PPH22_RATES).map(([type, info]) => ({
      type,
      label: info.label,
      rate: info.rate,
      rateNoNpwp: info.rateNoNpwp,
      legalBasis: info.legalBasis,
    }));
  }

  /**
   * Calculate bulk PPh 22
   */
  static calculateBulk(transactions: PPh22Data[]): {
    calculations: PPh22Calculation[];
    totalGross: number;
    totalTax: number;
    totalNet: number;
  } {
    const calculations = transactions.map((t) => this.calculate(t));
    return {
      calculations,
      totalGross: calculations.reduce((s, c) => s + c.gross_amount, 0),
      totalTax: calculations.reduce((s, c) => s + c.tax_amount, 0),
      totalNet: calculations.reduce((s, c) => s + c.net_amount, 0),
    };
  }
}
