import { describe, it, expect } from 'vitest';
import { TaxResolutionEngine } from '../tax-resolution-engine';
import type { OverrideRuleRow } from '../tax-resolution-engine';
import type { TransactionContext } from '@/types';

const baseCtx: TransactionContext = {
  grossAmount: 100_000_000,
  transactionDate: '2024-06-15',
  serviceCategory: 'SERVICE',
  recipientType: 'RESIDENT',
  recipientNpwp: '01.234.567.8-901.234',
};

describe('TaxResolutionEngine', () => {
  describe('Priority 1: Override Rules', () => {
    it('should apply PPh 4(2) 10% when vendor is property owner (building management case)', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'SERVICE',
        vendorIsPropertyOwner: true,
      });

      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.10);
      expect(result.taxAmount).toBe(10_000_000);
      expect(result.isFinal).toBe(true);
      expect(result.rulePriority).toBe(1);
      expect(result.ruleId).toBe('OVERRIDE_VENDOR_IS_OWNER');
    });

    it('should NOT apply override when vendorIsPropertyOwner is false', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'SERVICE',
        vendorIsPropertyOwner: false,
      });

      expect(result.taxType).toBe('PPh23');
      expect(result.rulePriority).not.toBe(1);
    });
  });

  describe('Priority 2: Treaty Rules (Non-Resident)', () => {
    it('should apply treaty rate for Korean recipient with CoD', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'KR',
        hasCertificateOfDomicile: true,
      });

      expect(result.taxType).toBe('PPh26');
      expect(result.rate).toBe(0.10);
      expect(result.taxAmount).toBe(10_000_000);
      expect(result.isFinal).toBe(true);
      expect(result.reason).toContain('South Korea');
      expect(result.ruleId).toBe('TREATY_KR');
    });

    it('should apply Singapore treaty rate (8%) for royalty', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'ROYALTY',
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'SG',
        hasCertificateOfDomicile: true,
      });

      expect(result.taxType).toBe('PPh26');
      expect(result.rate).toBe(0.08);
      expect(result.ruleId).toBe('TREATY_SG');
    });

    it('should apply standard 20% when no CoD provided', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'KR',
        hasCertificateOfDomicile: false,
      });

      expect(result.taxType).toBe('PPh26');
      expect(result.rate).toBe(0.20);
      expect(result.taxAmount).toBe(20_000_000);
      expect(result.reason).toContain('no Certificate of Domicile');
    });

    it('should apply standard 20% for country without treaty', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'XX',
        hasCertificateOfDomicile: true,
      });

      expect(result.taxType).toBe('PPh26');
      expect(result.rate).toBe(0.20);
      expect(result.reason).toContain('No tax treaty');
    });

    it('should not apply NPWP surcharge to non-resident PPh 26', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'JP',
        recipientNpwp: '', // No NPWP
        hasCertificateOfDomicile: true,
      });

      expect(result.npwpSurchargeApplied).toBe(false);
    });
  });

  describe('Priority 3: Construction Qualification Rules', () => {
    it('should apply 1.75% for small-qualified construction work', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'CONSTRUCTION',
        constructionType: 'WORK',
        qualification: 'SMALL',
      });

      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.0175);
      expect(result.taxAmount).toBe(1_750_000);
      expect(result.isFinal).toBe(true);
      expect(result.legalBasis).toContain('PP 9/2022');
    });

    it('should apply 2.65% for medium/large-qualified construction work', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'CONSTRUCTION',
        constructionType: 'WORK',
        qualification: 'MEDIUM_LARGE',
      });

      expect(result.rate).toBe(0.0265);
    });

    it('should apply 4% for unqualified construction work', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'CONSTRUCTION',
        constructionType: 'WORK',
        qualification: 'NONE',
      });

      expect(result.rate).toBe(0.04);
    });

    it('should apply 3.5% for qualified construction consulting', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'CONSTRUCTION',
        constructionType: 'CONSULT',
        qualification: 'QUALIFIED',
      });

      expect(result.rate).toBe(0.035);
    });

    it('should apply 6% for unqualified construction consulting', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'CONSTRUCTION',
        constructionType: 'CONSULT',
        qualification: 'NONE',
      });

      expect(result.rate).toBe(0.06);
      expect(result.taxAmount).toBe(6_000_000);
    });

    it('should apply 2.65% for qualified integrated construction', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'CONSTRUCTION',
        constructionType: 'INTEGRATED',
        qualification: 'QUALIFIED',
      });

      expect(result.rate).toBe(0.0265);
    });

    it('should default to WORK + NONE when no constructionType specified', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'CONSTRUCTION',
      });

      expect(result.rate).toBe(0.04);
    });

    it('should not apply NPWP surcharge on PPh 4(2) final tax', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'CONSTRUCTION',
        constructionType: 'WORK',
        qualification: 'SMALL',
        recipientNpwp: '', // No NPWP
      });

      expect(result.npwpSurchargeApplied).toBe(false);
      expect(result.rate).toBe(0.0175);
    });
  });

  describe('Priority 4: Category Rules', () => {
    it('should apply PPh 4(2) 10% for rental', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'RENTAL',
      });

      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.10);
      expect(result.isFinal).toBe(true);
    });

    it('should resolve EMPLOYMENT to PPh 21', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'EMPLOYMENT',
      });

      expect(result.taxType).toBe('PPh21');
      expect(result.isFinal).toBe(false);
    });

    it('should resolve IMPORT to PPh 22 at 2.5%', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'IMPORT',
      });

      expect(result.taxType).toBe('PPh22');
      expect(result.rate).toBe(0.025);
    });

    it('should resolve SHIPPING to PPh 15 at 1.2%', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'SHIPPING',
      });

      expect(result.taxType).toBe('PPh15');
      expect(result.rate).toBe(0.012);
      expect(result.isFinal).toBe(true);
    });

    it('should apply PPh 23 at 15% for DIVIDEND', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
      });

      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.15);
    });

    it('should apply PPh 23 at 15% for INTEREST', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'INTEREST',
      });

      expect(result.rate).toBe(0.15);
    });

    it('should apply PPh 23 at 15% for ROYALTY (resident)', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'ROYALTY',
      });

      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.15);
    });
  });

  describe('Priority 5: General Service Rule', () => {
    it('should apply PPh 23 at 2% for general service', () => {
      const result = TaxResolutionEngine.resolve(baseCtx);

      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.02);
      expect(result.taxAmount).toBe(2_000_000);
      expect(result.netAmount).toBe(98_000_000);
      expect(result.isFinal).toBe(false);
      expect(result.ruleId).toBe('GENERAL_SERVICE');
    });

    it('should apply PPh 23 for OTHER category', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'OTHER',
      });

      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.02);
    });
  });

  describe('NPWP Surcharge', () => {
    it('should double PPh 23 rate (2% → 4%) when no NPWP', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        recipientNpwp: '',
      });

      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.04);
      expect(result.taxAmount).toBe(4_000_000);
      expect(result.npwpSurchargeApplied).toBe(true);
      expect(result.reason).toContain('surcharge');
    });

    it('should double PPh 23 dividend rate (15% → 30%) when no NPWP', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
        recipientNpwp: '',
      });

      expect(result.rate).toBe(0.30);
      expect(result.npwpSurchargeApplied).toBe(true);
    });

    it('should NOT apply surcharge on PPh 4(2) rental even without NPWP', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'RENTAL',
        recipientNpwp: '',
      });

      expect(result.rate).toBe(0.10);
      expect(result.npwpSurchargeApplied).toBe(false);
    });

    it('should double PPh 22 import rate when no NPWP', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'IMPORT',
        recipientNpwp: '',
      });

      expect(result.rate).toBe(0.05); // 2.5% × 2
      expect(result.npwpSurchargeApplied).toBe(true);
    });
  });

  describe('Priority ordering', () => {
    it('Override should beat Treaty (non-resident vendor who is property owner)', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'SG',
        hasCertificateOfDomicile: true,
        vendorIsPropertyOwner: true,
        serviceCategory: 'SERVICE',
      });

      // Override should win with PPh 4(2) 10%, not PPh 26 treaty rate
      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.10);
      expect(result.rulePriority).toBe(1);
    });

    it('Treaty should beat General Rule for non-resident service provider', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'SERVICE',
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'JP',
        hasCertificateOfDomicile: true,
      });

      expect(result.taxType).toBe('PPh26');
      expect(result.rate).toBe(0.10);
      expect(result.rulePriority).toBe(2);
    });

    it('should include alternativeRules showing skipped rules', () => {
      const result = TaxResolutionEngine.resolve(baseCtx);

      expect(result.alternativeRules).toBeDefined();
      expect(result.alternativeRules!.length).toBeGreaterThan(0);
      expect(result.alternativeRules!.some(r => r.ruleId === 'OVERRIDE')).toBe(true);
      expect(result.alternativeRules!.some(r => r.ruleId === 'TREATY')).toBe(true);
    });
  });

  describe('Amount calculation', () => {
    it('should correctly calculate taxAmount and netAmount', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        grossAmount: 250_000_000,
        serviceCategory: 'CONSTRUCTION',
        constructionType: 'CONSULT',
        qualification: 'QUALIFIED',
      });

      expect(result.rate).toBe(0.035);
      expect(result.taxAmount).toBe(8_750_000);
      expect(result.netAmount).toBe(241_250_000);
    });

    it('should round taxAmount to nearest integer', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        grossAmount: 33_333_333,
      });

      expect(Number.isInteger(result.taxAmount)).toBe(true);
    });
  });

  describe('resolveWithOverrides (DB rules)', () => {
    const mockRule: OverrideRuleRow = {
      id: 'test-rule-001',
      name: 'Related Party Service Override',
      priority: 200,
      condition_service_category: 'SERVICE',
      condition_recipient_type: null,
      condition_vendor_is_owner: null,
      condition_is_related_party: true,
      condition_kbli_pattern: null,
      condition_country: null,
      result_tax_type: 'PPh4_2',
      result_rate: 0.10,
      result_is_final: true,
      result_reason: 'Related party service — treated as rental (custom rule)',
      result_legal_basis: 'Custom Rule — Transfer Pricing Regulation',
    };

    it('should apply DB override rule when conditions match', () => {
      const result = TaxResolutionEngine.resolveWithOverrides(
        { ...baseCtx, isRelatedParty: true },
        [mockRule]
      );

      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.10);
      expect(result.rulePriority).toBe(1);
      expect(result.ruleId).toContain('DB_OVERRIDE');
    });

    it('should NOT apply DB rule when conditions do not match', () => {
      const result = TaxResolutionEngine.resolveWithOverrides(
        { ...baseCtx, isRelatedParty: false },
        [mockRule]
      );

      // Should fall through to general PPh 23
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.02);
    });

    it('should fall through to standard rules when no DB rules match', () => {
      const result = TaxResolutionEngine.resolveWithOverrides(
        { ...baseCtx, serviceCategory: 'RENTAL' },
        [mockRule] // Only matches SERVICE + related party
      );

      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.10); // Rental category rule (default BUILDING_LAND)
      expect(result.ruleId).toBe('CATEGORY_RENTAL_BUILDING');
    });

    it('should apply highest priority DB rule first', () => {
      const lowPriority: OverrideRuleRow = {
        ...mockRule,
        id: 'low-priority',
        priority: 50,
        result_rate: 0.05,
        result_reason: 'Low priority rule',
      };
      const highPriority: OverrideRuleRow = {
        ...mockRule,
        id: 'high-priority',
        priority: 300,
        result_rate: 0.15,
        result_reason: 'High priority rule',
      };

      const result = TaxResolutionEngine.resolveWithOverrides(
        { ...baseCtx, isRelatedParty: true },
        [highPriority, lowPriority] // Pre-sorted by priority DESC
      );

      expect(result.rate).toBe(0.15);
    });

    it('should handle KBLI pattern matching', () => {
      const kbliRule: OverrideRuleRow = {
        ...mockRule,
        id: 'kbli-rule',
        condition_is_related_party: null,
        condition_kbli_pattern: '41%',
        result_rate: 0.03,
        result_reason: 'Construction KBLI override',
      };

      const result = TaxResolutionEngine.resolveWithOverrides(
        { ...baseCtx, kbliCode: '41001' },
        [kbliRule]
      );

      expect(result.rate).toBe(0.03);
    });

    it('should not match KBLI rule when kbliCode is absent', () => {
      const kbliRule: OverrideRuleRow = {
        ...mockRule,
        id: 'kbli-rule',
        condition_is_related_party: null,
        condition_kbli_pattern: '41%',
      };

      const result = TaxResolutionEngine.resolveWithOverrides(
        baseCtx, // no kbliCode
        [kbliRule]
      );

      expect(result.taxType).toBe('PPh23'); // Falls through
    });

    it('should work with empty DB rules array', () => {
      const result = TaxResolutionEngine.resolveWithOverrides(baseCtx, []);

      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.02);
    });
  });

  // ─── Phase 3: New domain rules ───
  describe('Phase 3: Dividend — UU HPP exemption + reinvestment', () => {
    it('should EXEMPT domestic corporate-to-corporate dividend (UU HPP 7/2021)', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
        recipientType: 'RESIDENT',
        recipientIsEntity: true,
      });
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0);
      expect(result.taxAmount).toBe(0);
      expect(result.ruleId).toBe('CATEGORY_DIVIDEND_CORP_EXEMPT');
      expect(result.legalBasis).toContain('UU HPP');
    });

    it('should EXEMPT individual dividend when reinvested (PMK 18/2021)', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
        recipientType: 'RESIDENT',
        recipientIsEntity: false,
        receivesReinvestedDividend: true,
      });
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0);
      expect(result.ruleId).toBe('CATEGORY_DIVIDEND_INDIV_REINVESTED');
      expect(result.legalBasis).toContain('PMK 18');
    });

    it('should apply PPh Final 10% for individual dividend without reinvestment', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
        recipientType: 'RESIDENT',
        recipientIsEntity: false,
        receivesReinvestedDividend: false,
      });
      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.10);
      expect(result.isFinal).toBe(true);
      expect(result.ruleId).toBe('CATEGORY_DIVIDEND_INDIV_FINAL');
    });

    it('should fallback to PPh 23 15% when recipientIsEntity not provided (legacy)', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
        recipientType: 'RESIDENT',
      });
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.15);
      expect(result.ruleId).toBe('CATEGORY_DIVIDEND_FALLBACK');
      expect(result.reason.toLowerCase()).toContain('recipient type');
    });
  });

  describe('Phase 3: Rental — building/land vs machine', () => {
    it('should apply PPh 4(2) 10% for building/land rental (default)', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'RENTAL',
        rentalAssetType: 'BUILDING_LAND',
      });
      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.10);
      expect(result.ruleId).toBe('CATEGORY_RENTAL_BUILDING');
    });

    it('should apply PPh 23 2% for machine rental', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'RENTAL',
        rentalAssetType: 'MACHINE',
      });
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.02);
      expect(result.ruleId).toBe('CATEGORY_RENTAL_MACHINE');
    });

    it('should apply PPh 23 2% for vehicle rental', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'RENTAL',
        rentalAssetType: 'VEHICLE',
      });
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.02);
      expect(result.ruleId).toBe('CATEGORY_RENTAL_VEHICLE');
    });
  });

  describe('Phase 3: Interest — bank deposit vs loan', () => {
    it('should apply PPh Final 20% for bank deposit interest', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'INTEREST',
        interestSource: 'BANK_DEPOSIT',
      });
      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.20);
      expect(result.isFinal).toBe(true);
      expect(result.ruleId).toBe('CATEGORY_INTEREST_BANK');
    });

    it('should apply PPh 23 15% for loan interest', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'INTEREST',
        interestSource: 'LOAN',
      });
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.15);
      expect(result.ruleId).toBe('CATEGORY_INTEREST_REGULAR');
    });
  });

  describe('Phase 3: Treaty — beneficial owner + shareholding 25%', () => {
    it('should deny treaty when DGT Form not submitted', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'KR',
        hasCertificateOfDomicile: true,
        hasDgtForm: false,
      });
      expect(result.taxType).toBe('PPh26');
      expect(result.rate).toBe(0.20);
      expect(result.reason).toContain('DGT Form');
    });

    it('should deny treaty when recipient is not beneficial owner', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'KR',
        hasCertificateOfDomicile: true,
        hasDgtForm: true,
        isBeneficialOwner: false,
      });
      expect(result.taxType).toBe('PPh26');
      expect(result.rate).toBe(0.20);
      expect(result.ruleId).toBe('TREATY_NOT_BENEFICIAL_OWNER');
    });

    it('should apply preferential treaty rate for dividend with ≥25% shareholding', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'JP',
        hasCertificateOfDomicile: true,
        hasDgtForm: true,
        shareholdingPct: 30,
      });
      expect(result.taxType).toBe('PPh26');
      expect(result.rate).toBe(0.10); // Japan treaty dividend rate
      expect(result.reason).toContain('≥25%');
    });

    it('should raise dividend rate to portfolio (15%) when shareholding <25%', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'JP', // Treaty: 10%
        hasCertificateOfDomicile: true,
        hasDgtForm: true,
        shareholdingPct: 10,
      });
      expect(result.taxType).toBe('PPh26');
      expect(result.rate).toBe(0.15); // Raised to portfolio rate
      expect(result.reason).toContain('portfolio');
    });
  });

  // ─── Phase 3 edge cases — NPWP surcharge interactions ───
  describe('Phase 3 edge cases: NPWP surcharge interactions', () => {
    const noNpwpCtx: TransactionContext = {
      grossAmount: 100_000_000,
      transactionDate: '2025-06-15',
      serviceCategory: 'SERVICE',
      recipientType: 'RESIDENT',
      recipientNpwp: undefined, // No NPWP
    };

    it('should NOT apply NPWP surcharge on EXEMPT corporate dividend', () => {
      // Even without NPWP, a tax-exempt (0%) dividend should stay at 0% (no surcharge)
      const result = TaxResolutionEngine.resolve({
        ...noNpwpCtx,
        serviceCategory: 'DIVIDEND',
        recipientIsEntity: true,
      });
      expect(result.rate).toBe(0);
      expect(result.taxAmount).toBe(0);
      expect(result.ruleId).toBe('CATEGORY_DIVIDEND_CORP_EXEMPT');
    });

    it('should NOT apply NPWP surcharge on PPh 4(2) Final dividend (individual non-reinvested)', () => {
      const result = TaxResolutionEngine.resolve({
        ...noNpwpCtx,
        serviceCategory: 'DIVIDEND',
        recipientIsEntity: false,
        receivesReinvestedDividend: false,
      });
      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.10); // Final 10%, no surcharge
      expect(result.npwpSurchargeApplied).toBe(false);
    });

    it('should NOT apply NPWP surcharge on PPh Final bank interest', () => {
      const result = TaxResolutionEngine.resolve({
        ...noNpwpCtx,
        serviceCategory: 'INTEREST',
        interestSource: 'BANK_DEPOSIT',
      });
      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.20);
      expect(result.npwpSurchargeApplied).toBe(false);
    });

    it('should apply NPWP surcharge on PPh 23 machine rental (not Final)', () => {
      const result = TaxResolutionEngine.resolve({
        ...noNpwpCtx,
        serviceCategory: 'RENTAL',
        rentalAssetType: 'MACHINE',
      });
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.04); // 2% × 2 = 4% due to no NPWP
      expect(result.npwpSurchargeApplied).toBe(true);
    });

    it('should apply NPWP surcharge on PPh 23 loan interest', () => {
      const result = TaxResolutionEngine.resolve({
        ...noNpwpCtx,
        serviceCategory: 'INTEREST',
        interestSource: 'LOAN',
      });
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.30); // 15% × 2 = 30% due to no NPWP
      expect(result.npwpSurchargeApplied).toBe(true);
    });

    it('should NOT apply NPWP surcharge on PPh 4(2) building rental (Final)', () => {
      const result = TaxResolutionEngine.resolve({
        ...noNpwpCtx,
        serviceCategory: 'RENTAL',
        rentalAssetType: 'BUILDING_LAND',
      });
      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.10);
      expect(result.npwpSurchargeApplied).toBe(false);
    });
  });

  // ─── Phase 3: Edge cases around dividend with missing context ───
  describe('Phase 3 edge cases: Dividend fallback scenarios', () => {
    it('should use fallback rule when recipientIsEntity is undefined', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
        recipientType: 'RESIDENT',
        // recipientIsEntity not provided
      });
      expect(result.ruleId).toBe('CATEGORY_DIVIDEND_FALLBACK');
      expect(result.reason).toContain('⚠');
    });

    it('should handle individual with receivesReinvestedDividend=true but not=false explicitly', () => {
      // Explicit false reinvestment → PPh Final 10%
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
        recipientType: 'RESIDENT',
        recipientIsEntity: false,
        receivesReinvestedDividend: false,
      });
      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.10);
      expect(result.isFinal).toBe(true);
    });
  });

  // ─── Phase 3: Rental edge cases ───
  describe('Phase 3 edge cases: Rental default behavior', () => {
    it('should default to BUILDING_LAND when rentalAssetType is undefined', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'RENTAL',
        // rentalAssetType not provided
      });
      expect(result.taxType).toBe('PPh4_2');
      expect(result.rate).toBe(0.10);
      expect(result.ruleId).toBe('CATEGORY_RENTAL_BUILDING');
    });

    it('should handle OTHER rental type as PPh 23 2%', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'RENTAL',
        rentalAssetType: 'OTHER',
      });
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.02);
      expect(result.ruleId).toBe('CATEGORY_RENTAL_OTHER');
    });
  });

  // ─── Phase 3: Interest edge cases ───
  describe('Phase 3 edge cases: Interest source behavior', () => {
    it('should default to regular PPh 23 when interestSource is undefined', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'INTEREST',
        // interestSource not provided
      });
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.15);
    });

    it('should apply PPh 23 15% for BOND interest', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'INTEREST',
        interestSource: 'BOND',
      });
      expect(result.taxType).toBe('PPh23');
      expect(result.rate).toBe(0.15);
      expect(result.reason).toContain('Bond interest');
    });
  });

  // ─── Phase 3: Non-resident dividend with borderline shareholding ───
  describe('Phase 3 edge cases: Treaty shareholding boundary', () => {
    it('should apply preferential rate at exactly 25% shareholding', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'JP',
        hasCertificateOfDomicile: true,
        hasDgtForm: true,
        shareholdingPct: 25, // Exactly at threshold
      });
      expect(result.taxType).toBe('PPh26');
      expect(result.rate).toBe(0.10); // Japan treaty preferential rate
      expect(result.reason).toContain('≥25%');
    });

    it('should apply portfolio rate at 24.99% shareholding', () => {
      const result = TaxResolutionEngine.resolve({
        ...baseCtx,
        serviceCategory: 'DIVIDEND',
        recipientType: 'NON_RESIDENT',
        recipientCountry: 'JP',
        hasCertificateOfDomicile: true,
        hasDgtForm: true,
        shareholdingPct: 24.99,
      });
      expect(result.rate).toBe(0.15); // Portfolio rate (raised from 10%)
    });
  });
});
