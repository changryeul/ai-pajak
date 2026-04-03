/**
 * PPh 15 Calculator — Special Industry Withholding Tax
 *
 * Applies to industries using normalized income calculation:
 * - Domestic shipping (pelayaran DN): 1.2% of gross
 * - Domestic airlines (penerbangan DN): 1.8% of gross
 * - Foreign shipping/airline PE: 2.64% of gross
 *
 * Legal basis: Pasal 15 UU PPh, KMK 416/1996, KMK 475/1996
 */

export type PPh15IndustryType =
  | 'DOMESTIC_SHIPPING'   // Pelayaran dalam negeri
  | 'DOMESTIC_AIRLINE'    // Penerbangan dalam negeri
  | 'FOREIGN_SHIPPING_PE' // Pelayaran/penerbangan asing (BUT)
  ;

export interface PPh15Data {
  industryType: PPh15IndustryType;
  grossIncome: number;
  companyName?: string;
  companyNpwp?: string;
}

export interface PPh15Calculation {
  industry_type: PPh15IndustryType;
  gross_income: number;
  tax_rate: number;
  tax_amount: number;
  net_income: number;
  is_final: boolean;
  legal_basis: string;
  description: string;
}

const RATES: Record<PPh15IndustryType, { rate: number; isFinal: boolean; legalBasis: string; description: string }> = {
  DOMESTIC_SHIPPING: {
    rate: 0.012,
    isFinal: true,
    legalBasis: 'KMK 416/KMK.04/1996 — Pelayaran dalam negeri',
    description: 'Pelayaran dalam negeri — 1.2% dari penghasilan bruto',
  },
  DOMESTIC_AIRLINE: {
    rate: 0.018,
    isFinal: true,
    legalBasis: 'KMK 475/KMK.04/1996 — Penerbangan dalam negeri',
    description: 'Penerbangan dalam negeri — 1.8% dari penghasilan bruto',
  },
  FOREIGN_SHIPPING_PE: {
    rate: 0.0264,
    isFinal: true,
    legalBasis: 'Pasal 15 UU PPh — BUT pelayaran/penerbangan asing',
    description: 'Pelayaran/penerbangan asing (BUT) — 2.64% dari penghasilan bruto',
  },
};

export class PPh15Calculator {
  static calculate(data: PPh15Data): PPh15Calculation {
    const config = RATES[data.industryType];
    const taxAmount = Math.round(data.grossIncome * config.rate);

    return {
      industry_type: data.industryType,
      gross_income: data.grossIncome,
      tax_rate: config.rate,
      tax_amount: taxAmount,
      net_income: data.grossIncome - taxAmount,
      is_final: config.isFinal,
      legal_basis: config.legalBasis,
      description: config.description,
    };
  }

  static getIndustryTypes(): Array<{ type: PPh15IndustryType; description: string; rate: number }> {
    return Object.entries(RATES).map(([type, config]) => ({
      type: type as PPh15IndustryType,
      description: config.description,
      rate: config.rate,
    }));
  }
}
