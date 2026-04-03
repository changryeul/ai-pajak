import { createClient } from '@/lib/supabase/client';
import { PPH42_CONSTRUCTION_RATES } from '@/config/constants';
import { loggers } from '@/lib/logger';

/**
 * PPh Final Calculator - Indonesian Final Income Tax
 *
 * Implements:
 * 1. PP 23/2018 (UMKM): 0.5% for SMEs with revenue < Rp 4.8B
 * 2. PP 34/2017 Pasal 4(2): Final tax on specific income types
 * 3. PP 9/2022: Construction services with SBU grade differentiation
 */

export type EntityType = 'INDIVIDUAL' | 'PT' | 'CV' | 'FIRMA' | 'KOPERASI';

export type IncomeType =
  | 'RENTAL'                    // Sewa tanah/bangunan
  | 'CONSTRUCTION'              // Legacy: resolves to CONSTRUCTION_WORK + NONE
  | 'CONSTRUCTION_WORK'         // Jasa Pelaksana Konstruksi (PP 9/2022)
  | 'CONSTRUCTION_CONSULT'      // Jasa Konsultansi Konstruksi (PP 9/2022)
  | 'CONSTRUCTION_INTEGRATED'   // Pekerjaan Konstruksi Terintegrasi (PP 9/2022)
  | 'SHIP'                      // Sewa Kapal
  | 'AIRCRAFT';                 // Sewa Pesawat

/**
 * Construction qualification grade per PP 9/2022 + PMK 59/2022.
 * Based on "kualifikasi" (qualification), not just license possession.
 *
 * - SMALL: Kualifikasi Kecil (SBU Grade 1-4 or SKK individual)
 * - MEDIUM_LARGE: Kualifikasi Menengah/Besar (SBU Grade 5+)
 * - HAS_SBU: Has any qualified certification (for consulting/integrated)
 * - NONE: No qualification / no SBU/SKK
 */
export type SBUGrade = 'SMALL' | 'MEDIUM_LARGE' | 'HAS_SBU' | 'NONE';

export interface PPhFinalUMKMParams {
  revenue: number;
  businessStartDate: Date;
  entityType: EntityType;
  kluCode: string;
}

export interface PPhFinalPasal42Params {
  incomeType: IncomeType;
  grossAmount: number;
  /** Required for CONSTRUCTION_WORK/CONSULT/INTEGRATED (PP 9/2022) */
  sbuGrade?: SBUGrade;
}

export interface PPhFinalCalculation {
  tax_type: 'PPh_FINAL_UMKM' | 'PPh_FINAL_PASAL42';
  base_amount: number;
  tax_rate: number;
  tax_amount: number;
  is_tax_exempt: boolean;
  legal_basis: string;
  details?: {
    revenue?: number;
    entity_type?: EntityType;
    klu_code?: string;
    years_elapsed?: number;
    period_limit?: number;
    income_type?: IncomeType;
    sbu_grade?: SBUGrade;
  };
}

export class TaxCalculationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TaxCalculationError';
  }
}

export class PPhFinalCalculator {
  /**
   * Calculate PPh Final PP 23/2018 for UMKM (Small-Medium Enterprises)
   *
   * Rate: 0.5% of gross revenue
   * Eligibility:
   * - Annual revenue < Rp 4.8 billion
   * - Not in exempted industries (professional services)
   * - Within period limit (Individual: 7y, PT: 3y, CV/Firma: 4y)
   *
   * Exemption:
   * - Annual revenue < Rp 500 million: Fully exempt
   */
  static async calculateUMKM(params: PPhFinalUMKMParams): Promise<PPhFinalCalculation> {
    const { revenue, businessStartDate, entityType, kluCode } = params;

    // 1. Check if industry is exempted from PPh Final
    const isExempted = await this.isExemptedIndustry(kluCode);
    if (isExempted) {
      throw new TaxCalculationError(
        'PPH_FINAL_001',
        'This industry is exempted from PPh Final PP 23/2018. Use regular PPh calculation instead.',
        {
          kluCode,
          message: 'Professional services (e.g., law, accounting, consulting, healthcare) must use regular PPh 21/25'
        }
      );
    }

    // 2. Check period limit
    const { isWithinLimit, yearsElapsed, periodLimit } = this.checkPeriodLimit(
      businessStartDate,
      entityType
    );

    if (!isWithinLimit) {
      throw new TaxCalculationError(
        'PPH_FINAL_002',
        `Period limit exceeded for PPh Final PP 23/2018. ${entityType} can only use this scheme for ${periodLimit} years.`,
        {
          businessStartDate: businessStartDate.toISOString(),
          entityType,
          yearsElapsed: Math.floor(yearsElapsed),
          periodLimit
        }
      );
    }

    // 3. Check revenue threshold for full exemption (< Rp 500M)
    if (revenue < 500_000_000) {
      return {
        tax_type: 'PPh_FINAL_UMKM',
        base_amount: revenue,
        tax_rate: 0,
        tax_amount: 0,
        is_tax_exempt: true,
        legal_basis: 'PP 23/2018 Pasal 2 ayat (1) - Revenue < Rp 500M fully exempt',
        details: {
          revenue,
          entity_type: entityType,
          klu_code: kluCode,
          years_elapsed: yearsElapsed,
          period_limit: periodLimit
        }
      };
    }

    // 4. Check if revenue exceeds UMKM limit (Rp 4.8B)
    if (revenue > 4_800_000_000) {
      throw new TaxCalculationError(
        'PPH_FINAL_003',
        'Revenue exceeds UMKM limit (Rp 4.8 billion). Use regular PPh 21/25 calculation instead.',
        {
          revenue,
          limit: 4_800_000_000,
          message: 'Businesses with annual revenue > Rp 4.8B must use general tax regime'
        }
      );
    }

    // 5. Calculate PPh Final 0.5%
    const taxRate = 0.005;
    const taxAmount = Math.round(revenue * taxRate);

    return {
      tax_type: 'PPh_FINAL_UMKM',
      base_amount: revenue,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      is_tax_exempt: false,
      legal_basis: 'PP 23/2018 Pasal 2 ayat (2) - UMKM 0.5% final tax',
      details: {
        revenue,
        entity_type: entityType,
        klu_code: kluCode,
        years_elapsed: yearsElapsed,
        period_limit: periodLimit
      }
    };
  }

  /**
   * Calculate PPh Final Pasal 4(2) for specific income types
   *
   * Non-construction rates:
   * - RENTAL: 10% (sewa tanah/bangunan) - PP 34/2017
   * - SHIP: 3% (sewa kapal)
   * - AIRCRAFT: 2% (sewa pesawat)
   *
   * Construction rates (PP 9/2022):
   * - CONSTRUCTION_WORK: 1.75% (SBU Kecil) / 2.65% (Menengah/Besar) / 4% (Tanpa SBU)
   * - CONSTRUCTION_CONSULT: 3.5% (Dengan SBU) / 6% (Tanpa SBU)
   * - CONSTRUCTION_INTEGRATED: 2.65% (Dengan SBU) / 4% (Tanpa SBU)
   * - CONSTRUCTION (legacy): 4% (backward compat, same as WORK + NONE)
   */
  static calculatePasal42(params: PPhFinalPasal42Params): PPhFinalCalculation {
    const { incomeType, grossAmount, sbuGrade } = params;

    const isConstruction = incomeType.startsWith('CONSTRUCTION');
    const taxRate = isConstruction
      ? this.getConstructionRate(incomeType, sbuGrade)
      : this.getSimpleRate(incomeType);

    const legalBasis = isConstruction
      ? this.getConstructionLegalBasis(incomeType, sbuGrade)
      : this.getSimpleLegalBasis(incomeType);

    const taxAmount = Math.round(grossAmount * taxRate);

    return {
      tax_type: 'PPh_FINAL_PASAL42',
      base_amount: grossAmount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      is_tax_exempt: false,
      legal_basis: legalBasis,
      details: {
        income_type: incomeType,
        sbu_grade: isConstruction ? (sbuGrade ?? 'NONE') : undefined,
      }
    };
  }

  /**
   * Get rate for non-construction income types
   */
  private static getSimpleRate(incomeType: IncomeType): number {
    const rates: Partial<Record<IncomeType, number>> = {
      RENTAL: 0.10,
      SHIP: 0.03,
      AIRCRAFT: 0.02,
    };
    const rate = rates[incomeType];
    if (rate === undefined) {
      throw new TaxCalculationError('PPH_FINAL_010', `Unknown income type: ${incomeType}`);
    }
    return rate;
  }

  /**
   * Get rate for construction services based on type and SBU grade (PP 9/2022)
   */
  private static getConstructionRate(incomeType: IncomeType, sbuGrade?: SBUGrade): number {
    const grade = sbuGrade ?? 'NONE';

    switch (incomeType) {
      case 'CONSTRUCTION':
        // Legacy backward compat: same as CONSTRUCTION_WORK + NONE
        return PPH42_CONSTRUCTION_RATES.CONSTRUCTION_WORK.NONE;

      case 'CONSTRUCTION_WORK': {
        const rates = PPH42_CONSTRUCTION_RATES.CONSTRUCTION_WORK;
        if (grade === 'SMALL') return rates.SMALL;
        if (grade === 'MEDIUM_LARGE') return rates.MEDIUM_LARGE;
        return rates.NONE;
      }

      case 'CONSTRUCTION_CONSULT': {
        const rates = PPH42_CONSTRUCTION_RATES.CONSTRUCTION_CONSULT;
        if (grade === 'HAS_SBU' || grade === 'SMALL' || grade === 'MEDIUM_LARGE') return rates.HAS_SBU;
        return rates.NONE;
      }

      case 'CONSTRUCTION_INTEGRATED': {
        const rates = PPH42_CONSTRUCTION_RATES.CONSTRUCTION_INTEGRATED;
        if (grade === 'HAS_SBU' || grade === 'SMALL' || grade === 'MEDIUM_LARGE') return rates.HAS_SBU;
        return rates.NONE;
      }

      default:
        throw new TaxCalculationError('PPH_FINAL_011', `Invalid construction type: ${incomeType}`);
    }
  }

  private static getSimpleLegalBasis(incomeType: IncomeType): string {
    const basis: Partial<Record<IncomeType, string>> = {
      RENTAL: 'PP 34/2017 Pasal 4 ayat (2) huruf d - Sewa tanah/bangunan 10%',
      SHIP: 'PP 34/2017 Pasal 4 ayat (2) huruf i - Sewa kapal 3%',
      AIRCRAFT: 'PP 34/2017 Pasal 4 ayat (2) huruf j - Sewa pesawat 2%',
    };
    return basis[incomeType] ?? `Pasal 4 ayat (2) UU PPh - ${incomeType}`;
  }

  private static getConstructionLegalBasis(incomeType: IncomeType, sbuGrade?: SBUGrade): string {
    const grade = sbuGrade ?? 'NONE';
    const prefix = 'PP 9/2022 Pasal 3';

    switch (incomeType) {
      case 'CONSTRUCTION':
        return 'PP 51/2008 Pasal 4 ayat (2) huruf c - Jasa konstruksi 4% (legacy)';
      case 'CONSTRUCTION_WORK':
        if (grade === 'SMALL') return `${prefix} - Pelaksana konstruksi SBU Kecil 1.75%`;
        if (grade === 'MEDIUM_LARGE') return `${prefix} - Pelaksana konstruksi SBU Menengah/Besar 2.65%`;
        return `${prefix} - Pelaksana konstruksi tanpa SBU 4%`;
      case 'CONSTRUCTION_CONSULT':
        if (grade !== 'NONE') return `${prefix} - Konsultansi konstruksi dengan SBU 3.5%`;
        return `${prefix} - Konsultansi konstruksi tanpa SBU 6%`;
      case 'CONSTRUCTION_INTEGRATED':
        if (grade !== 'NONE') return `${prefix} - Konstruksi terintegrasi dengan SBU 2.65%`;
        return `${prefix} - Konstruksi terintegrasi tanpa SBU 4%`;
      default:
        return `PP 9/2022 - ${incomeType}`;
    }
  }

  /**
   * Check if industry is exempted from PPh Final PP 23/2018
   *
   * Exempted industries (must use regular PPh):
   * - Professional services (law, accounting, consulting, etc.)
   * - Healthcare services
   * - Education services
   * - Arts and entertainment
   * - IT services
   */
  private static async isExemptedIndustry(kluCode: string): Promise<boolean> {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('klu_codes')
        .select('pph_final_exempt')
        .eq('code', kluCode)
        .single();

      if (error || !data) {
        // If KLU code not found, assume not exempted (safer for calculation)
        loggers.tax.warn({ kluCode }, 'KLU code not found in database, assuming not exempted');
        return false;
      }

      return data.pph_final_exempt ?? false;
    } catch (error) {
      loggers.tax.error({ err: error }, 'Error checking KLU exemption');
      return false; // Default to not exempted on error
    }
  }

  /**
   * Check if business is within PPh Final PP 23/2018 period limit
   *
   * Period limits:
   * - Individual (Orang Pribadi): 7 years
   * - PT (Limited Company): 3 years
   * - CV/Firma (Partnership): 4 years
   * - Koperasi (Cooperative): 4 years
   */
  private static checkPeriodLimit(
    businessStartDate: Date,
    entityType: EntityType
  ): { isWithinLimit: boolean; yearsElapsed: number; periodLimit: number } {
    const now = new Date();
    const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000;
    const yearsElapsed = (now.getTime() - businessStartDate.getTime()) / millisecondsPerYear;

    const limits: Record<EntityType, number> = {
      INDIVIDUAL: 7,
      PT: 3,
      CV: 4,
      FIRMA: 4,
      KOPERASI: 4
    };

    const periodLimit = limits[entityType];
    const isWithinLimit = yearsElapsed <= periodLimit;

    return {
      isWithinLimit,
      yearsElapsed,
      periodLimit
    };
  }

  /**
   * Helper: Check if revenue qualifies for UMKM scheme
   */
  static isUMKMEligible(revenue: number): boolean {
    return revenue >= 500_000_000 && revenue <= 4_800_000_000;
  }

  /**
   * Helper: Get exemption threshold
   */
  static getExemptionThreshold(): number {
    return 500_000_000; // Rp 500 million
  }

  /**
   * Helper: Get UMKM revenue limit
   */
  static getUMKMLimit(): number {
    return 4_800_000_000; // Rp 4.8 billion
  }

  /**
   * Helper: Get period limit for entity type
   */
  static getPeriodLimit(entityType: EntityType): number {
    const limits: Record<EntityType, number> = {
      INDIVIDUAL: 7,
      PT: 3,
      CV: 4,
      FIRMA: 4,
      KOPERASI: 4
    };
    return limits[entityType];
  }

  /**
   * Helper: Format currency to Rupiah
   */
  static formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}
