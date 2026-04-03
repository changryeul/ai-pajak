import { describe, it, expect } from 'vitest';
import { PPhFinalCalculator } from '../pph-final-calculator';

describe('PPhFinalCalculator', () => {
  describe('calculatePasal42 - Non-construction', () => {
    it('should calculate RENTAL at 10%', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'RENTAL',
        grossAmount: 100_000_000,
      });
      expect(result.tax_rate).toBe(0.10);
      expect(result.tax_amount).toBe(10_000_000);
      expect(result.legal_basis).toContain('PP 34/2017');
    });

    it('should calculate SHIP at 3%', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'SHIP',
        grossAmount: 200_000_000,
      });
      expect(result.tax_rate).toBe(0.03);
      expect(result.tax_amount).toBe(6_000_000);
    });

    it('should calculate AIRCRAFT at 2%', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'AIRCRAFT',
        grossAmount: 500_000_000,
      });
      expect(result.tax_rate).toBe(0.02);
      expect(result.tax_amount).toBe(10_000_000);
    });
  });

  describe('calculatePasal42 - Legacy CONSTRUCTION (backward compat)', () => {
    it('should calculate legacy CONSTRUCTION at 4%', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'CONSTRUCTION',
        grossAmount: 1_000_000_000,
      });
      expect(result.tax_rate).toBe(0.04);
      expect(result.tax_amount).toBe(40_000_000);
      expect(result.details?.sbu_grade).toBe('NONE');
    });
  });

  describe('calculatePasal42 - CONSTRUCTION_WORK (PP 9/2022)', () => {
    it('should apply 1.75% for SBU Kecil (SMALL)', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'CONSTRUCTION_WORK',
        grossAmount: 1_000_000_000,
        sbuGrade: 'SMALL',
      });
      expect(result.tax_rate).toBe(0.0175);
      expect(result.tax_amount).toBe(17_500_000);
      expect(result.legal_basis).toContain('SBU Kecil');
      expect(result.legal_basis).toContain('PP 9/2022');
      expect(result.details?.sbu_grade).toBe('SMALL');
    });

    it('should apply 2.65% for SBU Menengah/Besar (MEDIUM_LARGE)', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'CONSTRUCTION_WORK',
        grossAmount: 1_000_000_000,
        sbuGrade: 'MEDIUM_LARGE',
      });
      expect(result.tax_rate).toBe(0.0265);
      expect(result.tax_amount).toBe(26_500_000);
      expect(result.legal_basis).toContain('Menengah/Besar');
    });

    it('should apply 4% without SBU (NONE)', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'CONSTRUCTION_WORK',
        grossAmount: 1_000_000_000,
        sbuGrade: 'NONE',
      });
      expect(result.tax_rate).toBe(0.04);
      expect(result.tax_amount).toBe(40_000_000);
      expect(result.legal_basis).toContain('tanpa SBU');
    });

    it('should default to NONE when sbuGrade is undefined', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'CONSTRUCTION_WORK',
        grossAmount: 500_000_000,
      });
      expect(result.tax_rate).toBe(0.04);
      expect(result.tax_amount).toBe(20_000_000);
      expect(result.details?.sbu_grade).toBe('NONE');
    });
  });

  describe('calculatePasal42 - CONSTRUCTION_CONSULT (PP 9/2022)', () => {
    it('should apply 3.5% with SBU (HAS_SBU)', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'CONSTRUCTION_CONSULT',
        grossAmount: 200_000_000,
        sbuGrade: 'HAS_SBU',
      });
      expect(result.tax_rate).toBe(0.035);
      expect(result.tax_amount).toBe(7_000_000);
      expect(result.legal_basis).toContain('dengan SBU');
    });

    it('should apply 6% without SBU', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'CONSTRUCTION_CONSULT',
        grossAmount: 200_000_000,
        sbuGrade: 'NONE',
      });
      expect(result.tax_rate).toBe(0.06);
      expect(result.tax_amount).toBe(12_000_000);
      expect(result.legal_basis).toContain('tanpa SBU');
    });

    it('should treat SMALL/MEDIUM_LARGE as HAS_SBU for consulting', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'CONSTRUCTION_CONSULT',
        grossAmount: 100_000_000,
        sbuGrade: 'SMALL',
      });
      expect(result.tax_rate).toBe(0.035);
    });
  });

  describe('calculatePasal42 - CONSTRUCTION_INTEGRATED (PP 9/2022)', () => {
    it('should apply 2.65% with SBU', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'CONSTRUCTION_INTEGRATED',
        grossAmount: 5_000_000_000,
        sbuGrade: 'HAS_SBU',
      });
      expect(result.tax_rate).toBe(0.0265);
      expect(result.tax_amount).toBe(132_500_000);
    });

    it('should apply 4% without SBU', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'CONSTRUCTION_INTEGRATED',
        grossAmount: 5_000_000_000,
        sbuGrade: 'NONE',
      });
      expect(result.tax_rate).toBe(0.04);
      expect(result.tax_amount).toBe(200_000_000);
    });
  });

  describe('calculatePasal42 - common properties', () => {
    it('should always return tax_type PPh_FINAL_PASAL42', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'RENTAL',
        grossAmount: 50_000_000,
      });
      expect(result.tax_type).toBe('PPh_FINAL_PASAL42');
      expect(result.is_tax_exempt).toBe(false);
    });

    it('should round tax amount to nearest integer', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'CONSTRUCTION_WORK',
        grossAmount: 123_456_789,
        sbuGrade: 'SMALL',
      });
      // 123_456_789 * 0.0175 = 2_160_493.8075
      expect(result.tax_amount).toBe(Math.round(123_456_789 * 0.0175));
    });

    it('should not include sbu_grade in details for non-construction types', () => {
      const result = PPhFinalCalculator.calculatePasal42({
        incomeType: 'RENTAL',
        grossAmount: 50_000_000,
      });
      expect(result.details?.sbu_grade).toBeUndefined();
    });
  });

  describe('helper methods', () => {
    it('isUMKMEligible returns true for revenue in range', () => {
      expect(PPhFinalCalculator.isUMKMEligible(1_000_000_000)).toBe(true);
    });

    it('isUMKMEligible returns false for revenue below threshold', () => {
      expect(PPhFinalCalculator.isUMKMEligible(400_000_000)).toBe(false);
    });

    it('isUMKMEligible returns false for revenue above limit', () => {
      expect(PPhFinalCalculator.isUMKMEligible(5_000_000_000)).toBe(false);
    });

    it('getExemptionThreshold returns 500M', () => {
      expect(PPhFinalCalculator.getExemptionThreshold()).toBe(500_000_000);
    });

    it('getUMKMLimit returns 4.8B', () => {
      expect(PPhFinalCalculator.getUMKMLimit()).toBe(4_800_000_000);
    });

    it('getPeriodLimit returns correct values per entity type', () => {
      expect(PPhFinalCalculator.getPeriodLimit('INDIVIDUAL')).toBe(7);
      expect(PPhFinalCalculator.getPeriodLimit('PT')).toBe(3);
      expect(PPhFinalCalculator.getPeriodLimit('CV')).toBe(4);
      expect(PPhFinalCalculator.getPeriodLimit('FIRMA')).toBe(4);
      expect(PPhFinalCalculator.getPeriodLimit('KOPERASI')).toBe(4);
    });
  });
});
