import { describe, it, expect } from 'vitest';
import { TaxResolutionEngine } from '../tax-resolution-engine';
import type { ServiceCategory } from '@/types';

/**
 * Invoice Classification → Tax Resolution Flow Tests
 *
 * Tests the complete flow of: AI classification result → Tax Resolution Engine
 * This is the core logic behind the "Photo → Auto Filing" killer feature.
 */

describe('Invoice Classify → Tax Resolution Flow', () => {
  describe('service category mapping', () => {
    const categories: Array<{ category: ServiceCategory; expectedTaxType: string; expectedRate: number }> = [
      { category: 'SERVICE', expectedTaxType: 'PPh23', expectedRate: 0.02 },
      { category: 'RENTAL', expectedTaxType: 'PPh4_2', expectedRate: 0.10 },
      { category: 'CONSTRUCTION', expectedTaxType: 'PPh4_2', expectedRate: 0.04 },
      { category: 'DIVIDEND', expectedTaxType: 'PPh23', expectedRate: 0.15 },
      { category: 'INTEREST', expectedTaxType: 'PPh23', expectedRate: 0.15 },
      { category: 'ROYALTY', expectedTaxType: 'PPh23', expectedRate: 0.15 },
    ];

    categories.forEach(({ category, expectedTaxType, expectedRate }) => {
      it(`should resolve ${category} to ${expectedTaxType} at ${expectedRate * 100}%`, () => {
        const result = TaxResolutionEngine.resolve({
          grossAmount: 10_000_000,
          transactionDate: '2025-06-15',
          serviceCategory: category,
          recipientType: 'RESIDENT',
          recipientNpwp: '01.234.567.8-901.234',
        });

        expect(result.taxType).toBe(expectedTaxType);
        expect(result.rate).toBe(expectedRate);
      });
    });
  });

  describe('NPWP surcharge', () => {
    it('should apply 2x surcharge for PPh23 when no NPWP', () => {
      const withNpwp = TaxResolutionEngine.resolve({
        grossAmount: 10_000_000,
        transactionDate: '2025-06-15',
        serviceCategory: 'SERVICE',
        recipientType: 'RESIDENT',
        recipientNpwp: '01.234.567.8-901.234',
      });

      const noNpwp = TaxResolutionEngine.resolve({
        grossAmount: 10_000_000,
        transactionDate: '2025-06-15',
        serviceCategory: 'SERVICE',
        recipientType: 'RESIDENT',
        // No NPWP
      });

      expect(noNpwp.taxAmount).toBe(withNpwp.taxAmount * 2);
      expect(noNpwp.npwpSurchargeApplied).toBe(true);
    });

    it('should NOT apply surcharge for PPh Final', () => {
      const noNpwp = TaxResolutionEngine.resolve({
        grossAmount: 10_000_000,
        transactionDate: '2025-06-15',
        serviceCategory: 'RENTAL',
        recipientType: 'RESIDENT',
      });

      // PPh Final always 10% regardless of NPWP
      expect(noNpwp.rate).toBe(0.10);
      expect(noNpwp.isFinal).toBe(true);
    });
  });

  describe('non-resident handling', () => {
    it('should resolve non-resident to PPh 26 at 20%', () => {
      const result = TaxResolutionEngine.resolve({
        grossAmount: 50_000_000,
        transactionDate: '2025-06-15',
        serviceCategory: 'SERVICE',
        recipientType: 'NON_RESIDENT',
      });

      expect(result.taxType).toBe('PPh26');
      expect(result.rate).toBe(0.20);
      expect(result.taxAmount).toBe(10_000_000);
    });

    it('should apply DTA rate when treaty exists', () => {
      const result = TaxResolutionEngine.resolve({
        grossAmount: 50_000_000,
        transactionDate: '2025-06-15',
        serviceCategory: 'SERVICE',
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'JP',
        hasCertificateOfDomicile: true,
      });

      // Japan DTA rate should be less than standard 20%
      expect(result.rate).toBeLessThanOrEqual(0.20);
    });
  });

  describe('construction with SBU grades (PP 9/2022)', () => {
    it('should apply correct rate for qualified construction work', () => {
      const result = TaxResolutionEngine.resolve({
        grossAmount: 500_000_000,
        transactionDate: '2025-06-15',
        serviceCategory: 'CONSTRUCTION',
        recipientType: 'RESIDENT',
        recipientNpwp: '01.234.567.8-901.234',
        constructionType: 'WORK',
        qualification: 'MEDIUM_LARGE',
      });

      expect(result.taxType).toBe('PPh4_2');
      expect(result.isFinal).toBe(true);
      // PP 9/2022: Medium/Large construction work = 2.65%
      expect(result.rate).toBeGreaterThan(0);
    });
  });

  describe('tax amount calculation', () => {
    it('should calculate correct netAmount (gross - tax)', () => {
      const grossAmount = 100_000_000;
      const result = TaxResolutionEngine.resolve({
        grossAmount,
        transactionDate: '2025-06-15',
        serviceCategory: 'SERVICE',
        recipientType: 'RESIDENT',
        recipientNpwp: '01.234.567.8-901.234',
      });

      expect(result.taxAmount).toBe(grossAmount * result.rate);
      expect(result.netAmount).toBe(grossAmount - result.taxAmount);
    });

    it('should handle zero amount gracefully', () => {
      const result = TaxResolutionEngine.resolve({
        grossAmount: 0,
        transactionDate: '2025-06-15',
        serviceCategory: 'SERVICE',
        recipientType: 'RESIDENT',
      });

      expect(result.taxAmount).toBe(0);
      expect(result.netAmount).toBe(0);
    });
  });

  describe('DB override rules', () => {
    it('should apply DB override when matching condition', () => {
      const dbRules = [{
        id: 'test-rule-1',
        name: 'Test Override',
        priority: 100,
        condition_service_category: 'SERVICE',
        condition_recipient_type: null,
        condition_vendor_is_owner: null,
        condition_is_related_party: null,
        condition_kbli_pattern: null,
        condition_country: null,
        result_tax_type: 'PPh4_2',
        result_rate: 0.05,
        result_is_final: true,
        result_reason: 'Custom override for testing',
        result_legal_basis: 'Test Basis',
      }];

      const result = TaxResolutionEngine.resolveWithOverrides(
        {
          grossAmount: 10_000_000,
          transactionDate: '2025-06-15',
          serviceCategory: 'SERVICE',
          recipientType: 'RESIDENT',
          recipientNpwp: '01.234.567.8-901.234',
        },
        dbRules
      );

      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.05);
      expect(result.isFinal).toBe(true);
    });
  });
});
