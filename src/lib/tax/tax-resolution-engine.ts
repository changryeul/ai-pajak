/**
 * Tax Resolution Engine — Priority-based withholding tax determination
 *
 * Evaluates transaction context against rules in priority order:
 * 1. Override Rules (practical/custom rules, e.g., building management)
 * 2. Treaty Rules (non-resident + DTA)
 * 3. Qualification Rules (construction PP 9/2022)
 * 4. Category Rules (rental, employment, import, shipping)
 * 5. General Service Rules (PPh 23)
 *
 * NPWP surcharge is applied as a modifier on top of the resolved rate.
 */

import { PPH23_RATES, PPH26_STANDARD_RATE, TAX_TREATY_RATES, PPH42_CONSTRUCTION_RATES } from '@/config/constants';
import type { TransactionContext, TaxResolution, ResolvedTaxType } from '@/types';

/** DB override rule shape (from tax_override_rule table) */
export interface OverrideRuleRow {
  id: string;
  name: string;
  priority: number;
  condition_service_category: string | null;
  condition_recipient_type: string | null;
  condition_vendor_is_owner: boolean | null;
  condition_is_related_party: boolean | null;
  condition_kbli_pattern: string | null;
  condition_country: string | null;
  result_tax_type: string;
  result_rate: number;
  result_is_final: boolean;
  result_reason: string;
  result_legal_basis: string;
}

interface RuleResult {
  taxType: ResolvedTaxType;
  rate: number;
  isFinal: boolean;
  reason: string;
  legalBasis: string;
  rulePriority: number;
  ruleId: string;
}

export class TaxResolutionEngine {
  /**
   * Resolve with DB-loaded override rules (async version).
   * Call this from API routes where you can fetch rules from DB first.
   */
  static resolveWithOverrides(ctx: TransactionContext, dbRules: OverrideRuleRow[]): TaxResolution {
    const skippedRules: Array<{ ruleId: string; reason: string }> = [];

    // Priority 1: DB Override Rules (sorted by priority DESC)
    const dbOverride = this.evaluateDBOverrideRules(ctx, dbRules);
    if (dbOverride) {
      return this.buildResolution(ctx, dbOverride, skippedRules);
    }
    skippedRules.push({ ruleId: 'DB_OVERRIDE', reason: 'No DB override rule matched' });

    // Fall through to standard resolve logic (minus hardcoded overrides)
    return this.resolveStandard(ctx, skippedRules);
  }

  /**
   * Resolve the applicable tax type and rate for a transaction.
   * Uses hardcoded override rules only (sync, no DB).
   */
  static resolve(ctx: TransactionContext): TaxResolution {
    const skippedRules: Array<{ ruleId: string; reason: string }> = [];

    // Priority 1: Hardcoded Override Rules
    const override = this.evaluateOverrideRules(ctx);
    if (override) {
      return this.buildResolution(ctx, override, skippedRules);
    }
    skippedRules.push({ ruleId: 'OVERRIDE', reason: 'No override rule matched' });

    return this.resolveStandard(ctx, skippedRules);
  }

  /**
   * Standard resolution logic (Treaty → Construction → Category → General).
   * Shared by both resolve() and resolveWithOverrides().
   */
  private static resolveStandard(
    ctx: TransactionContext,
    skippedRules: Array<{ ruleId: string; reason: string }>
  ): TaxResolution {
    // Priority 2: Treaty Rules (non-resident)
    if (ctx.recipientType === 'NON_RESIDENT') {
      const treaty = this.evaluateTreatyRule(ctx);
      return this.buildResolution(ctx, treaty, skippedRules);
    }
    skippedRules.push({ ruleId: 'TREATY', reason: 'Recipient is resident' });

    // Priority 3: Construction Qualification Rules
    if (ctx.serviceCategory === 'CONSTRUCTION') {
      const construction = this.evaluateConstructionRule(ctx);
      return this.buildResolution(ctx, construction, skippedRules);
    }

    // Priority 4: Category-specific rules
    const category = this.evaluateCategoryRule(ctx);
    if (category) {
      return this.buildResolution(ctx, category, skippedRules);
    }

    // Priority 5: General Service Rule (PPh 23)
    const general = this.evaluateGeneralRule(ctx);
    return this.buildResolution(ctx, general, skippedRules);
  }

  /**
   * Priority 1: Override Rules — practical/custom rules that trump everything.
   */
  private static evaluateOverrideRules(ctx: TransactionContext): RuleResult | null {
    // CASE: Building management where vendor is also the property owner
    // → treated as rental income (PPh 4(2) 10%), not service
    if (ctx.vendorIsPropertyOwner && ctx.serviceCategory === 'SERVICE') {
      return {
        taxType: 'PPh4_2',
        rate: 0.10,
        isFinal: true,
        reason: 'Vendor is property owner — treated as sewa tanah/bangunan (rental)',
        legalBasis: 'PP 34/2017 Pasal 4(2) huruf d — practical interpretation',
        rulePriority: 1,
        ruleId: 'OVERRIDE_VENDOR_IS_OWNER',
      };
    }

    return null;
  }

  /**
   * Evaluate DB-loaded override rules against transaction context.
   * Rules are pre-sorted by priority DESC.
   * All non-null conditions must match for a rule to apply.
   */
  private static evaluateDBOverrideRules(ctx: TransactionContext, rules: OverrideRuleRow[]): RuleResult | null {
    for (const rule of rules) {
      if (this.matchesDBRule(ctx, rule)) {
        return {
          taxType: rule.result_tax_type as ResolvedTaxType,
          rate: Number(rule.result_rate),
          isFinal: rule.result_is_final,
          reason: rule.result_reason,
          legalBasis: rule.result_legal_basis,
          rulePriority: 1,
          ruleId: `DB_OVERRIDE_${rule.id.slice(0, 8)}`,
        };
      }
    }
    return null;
  }

  private static matchesDBRule(ctx: TransactionContext, rule: OverrideRuleRow): boolean {
    if (rule.condition_service_category !== null && rule.condition_service_category !== ctx.serviceCategory) return false;
    if (rule.condition_recipient_type !== null && rule.condition_recipient_type !== ctx.recipientType) return false;
    if (rule.condition_vendor_is_owner !== null && rule.condition_vendor_is_owner !== (ctx.vendorIsPropertyOwner ?? false)) return false;
    if (rule.condition_is_related_party !== null && rule.condition_is_related_party !== (ctx.isRelatedParty ?? false)) return false;
    if (rule.condition_country !== null && rule.condition_country !== ctx.recipientCountry) return false;
    if (rule.condition_kbli_pattern !== null && ctx.kbliCode) {
      const pattern = rule.condition_kbli_pattern.replace('%', '');
      if (!ctx.kbliCode.startsWith(pattern)) return false;
    }
    if (rule.condition_kbli_pattern !== null && !ctx.kbliCode) return false;
    return true;
  }

  /**
   * Priority 2: Treaty Rules — non-resident recipients.
   */
  private static evaluateTreatyRule(ctx: TransactionContext): RuleResult {
    const countryCode = ctx.recipientCountry?.toUpperCase() || '';
    const treaty = TAX_TREATY_RATES[countryCode];

    // No treaty or no CoD → standard PPh 26 at 20%
    if (!treaty || !ctx.hasCertificateOfDomicile) {
      const noCodReason = treaty && !ctx.hasCertificateOfDomicile
        ? `Treaty exists with ${treaty.country} but no Certificate of Domicile provided`
        : `No tax treaty with country code '${countryCode}'`;

      return {
        taxType: 'PPh26',
        rate: PPH26_STANDARD_RATE,
        isFinal: true,
        reason: `Non-resident recipient — ${noCodReason}, standard 20% applied`,
        legalBasis: 'Pasal 26 UU PPh — standard non-resident rate 20%',
        rulePriority: 2,
        ruleId: 'TREATY_STANDARD_20',
      };
    }

    // Map service category to treaty income type
    const incomeTypeMap: Record<string, keyof typeof treaty> = {
      DIVIDEND: 'dividend',
      INTEREST: 'interest',
      ROYALTY: 'royalty',
    };

    const treatyField = incomeTypeMap[ctx.serviceCategory] || 'service';
    const treatyRate = treaty[treatyField as keyof typeof treaty] as number;

    // Only apply treaty rate if lower than 20%
    if (treatyRate >= PPH26_STANDARD_RATE) {
      return {
        taxType: 'PPh26',
        rate: PPH26_STANDARD_RATE,
        isFinal: true,
        reason: `Treaty rate with ${treaty.country} (${(treatyRate * 100).toFixed(1)}%) not lower than standard 20%`,
        legalBasis: `Pasal 26 UU PPh — ${treaty.reference}`,
        rulePriority: 2,
        ruleId: 'TREATY_NOT_BENEFICIAL',
      };
    }

    return {
      taxType: 'PPh26',
      rate: treatyRate,
      isFinal: true,
      reason: `Tax treaty with ${treaty.country} applied — ${(treatyRate * 100).toFixed(1)}% for ${treatyField}`,
      legalBasis: `${treaty.reference} — beneficial owner with CoD`,
      rulePriority: 2,
      ruleId: `TREATY_${countryCode}`,
    };
  }

  /**
   * Priority 3: Construction Qualification Rules (PP 9/2022)
   */
  private static evaluateConstructionRule(ctx: TransactionContext): RuleResult {
    const type = ctx.constructionType || 'WORK';
    const qual = ctx.qualification || 'NONE';

    let rate: number;
    let detail: string;

    switch (type) {
      case 'WORK':
        if (qual === 'SMALL') {
          rate = PPH42_CONSTRUCTION_RATES.CONSTRUCTION_WORK.SMALL;
          detail = 'Pelaksana konstruksi — kualifikasi kecil';
        } else if (qual === 'MEDIUM_LARGE' || qual === 'QUALIFIED') {
          rate = PPH42_CONSTRUCTION_RATES.CONSTRUCTION_WORK.MEDIUM_LARGE;
          detail = 'Pelaksana konstruksi — kualifikasi menengah/besar';
        } else {
          rate = PPH42_CONSTRUCTION_RATES.CONSTRUCTION_WORK.NONE;
          detail = 'Pelaksana konstruksi — tanpa kualifikasi';
        }
        break;

      case 'CONSULT':
        if (qual !== 'NONE') {
          rate = PPH42_CONSTRUCTION_RATES.CONSTRUCTION_CONSULT.HAS_SBU;
          detail = 'Konsultansi konstruksi — berkualifikasi';
        } else {
          rate = PPH42_CONSTRUCTION_RATES.CONSTRUCTION_CONSULT.NONE;
          detail = 'Konsultansi konstruksi — tanpa kualifikasi';
        }
        break;

      case 'INTEGRATED':
        if (qual !== 'NONE') {
          rate = PPH42_CONSTRUCTION_RATES.CONSTRUCTION_INTEGRATED.HAS_SBU;
          detail = 'Konstruksi terintegrasi — berkualifikasi';
        } else {
          rate = PPH42_CONSTRUCTION_RATES.CONSTRUCTION_INTEGRATED.NONE;
          detail = 'Konstruksi terintegrasi — tanpa kualifikasi';
        }
        break;

      default:
        rate = PPH42_CONSTRUCTION_RATES.CONSTRUCTION_WORK.NONE;
        detail = 'Konstruksi — tipe tidak dikenal, tarif default';
    }

    return {
      taxType: 'PPh4_2',
      rate,
      isFinal: true,
      reason: `${detail} (${(rate * 100).toFixed(2)}%)`,
      legalBasis: 'PP 9/2022 Pasal 3 ayat (1) — Jasa Konstruksi',
      rulePriority: 3,
      ruleId: `CONSTRUCTION_${type}_${qual}`,
    };
  }

  /**
   * Priority 4: Category-specific rules (rental, employment, import, shipping)
   */
  private static evaluateCategoryRule(ctx: TransactionContext): RuleResult | null {
    switch (ctx.serviceCategory) {
      case 'RENTAL':
        return {
          taxType: 'PPh4_2',
          rate: 0.10,
          isFinal: true,
          reason: 'Sewa tanah dan/atau bangunan — 10% final tax',
          legalBasis: 'PP 34/2017 Pasal 4 ayat (2) huruf d',
          rulePriority: 4,
          ruleId: 'CATEGORY_RENTAL',
        };

      case 'EMPLOYMENT':
        // PPh 21 — rate depends on salary/PTKP, return 0 as placeholder
        // Actual calculation requires PPh21Calculator with employee data
        return {
          taxType: 'PPh21',
          rate: 0,
          isFinal: false,
          reason: 'Penghasilan pegawai — PPh 21 (tarif progresif/TER)',
          legalBasis: 'Pasal 21 UU PPh, PP 58/2023 (TER)',
          rulePriority: 4,
          ruleId: 'CATEGORY_EMPLOYMENT',
        };

      case 'IMPORT':
        return {
          taxType: 'PPh22',
          rate: 0.025,
          isFinal: false,
          reason: 'Impor barang — PPh 22 (2.5% dengan NPWP)',
          legalBasis: 'PMK 34/PMK.010/2017 — PPh 22 Impor',
          rulePriority: 4,
          ruleId: 'CATEGORY_IMPORT',
        };

      case 'SHIPPING':
        return {
          taxType: 'PPh15',
          rate: 0.012,
          isFinal: true,
          reason: 'Pelayaran dalam negeri — 1.2% of gross',
          legalBasis: 'Pasal 15 UU PPh, KMK 416/1996',
          rulePriority: 4,
          ruleId: 'CATEGORY_SHIPPING',
        };

      case 'DIVIDEND':
        return {
          taxType: 'PPh23',
          rate: PPH23_RATES.DIVIDEND,
          isFinal: false,
          reason: 'Dividen — PPh 23 at 15%',
          legalBasis: 'Pasal 23(1)(a) UU PPh',
          rulePriority: 4,
          ruleId: 'CATEGORY_DIVIDEND',
        };

      case 'INTEREST':
        return {
          taxType: 'PPh23',
          rate: PPH23_RATES.INTEREST,
          isFinal: false,
          reason: 'Bunga — PPh 23 at 15%',
          legalBasis: 'Pasal 23(1)(a) UU PPh',
          rulePriority: 4,
          ruleId: 'CATEGORY_INTEREST',
        };

      case 'ROYALTY':
        return {
          taxType: 'PPh23',
          rate: PPH23_RATES.ROYALTY,
          isFinal: false,
          reason: 'Royalti — PPh 23 at 15%',
          legalBasis: 'Pasal 23(1)(a) UU PPh',
          rulePriority: 4,
          ruleId: 'CATEGORY_ROYALTY',
        };

      default:
        return null;
    }
  }

  /**
   * Priority 5: General Service Rule (PPh 23 at 2%)
   */
  private static evaluateGeneralRule(ctx: TransactionContext): RuleResult {
    return {
      taxType: 'PPh23',
      rate: PPH23_RATES.SERVICE,
      isFinal: false,
      reason: `Jasa umum — PPh 23 at 2% (${ctx.serviceCategory})`,
      legalBasis: 'Pasal 23(1)(c) UU PPh',
      rulePriority: 5,
      ruleId: 'GENERAL_SERVICE',
    };
  }

  /**
   * Check if NPWP surcharge should be applied.
   * PPh 23: 100% higher (2x rate) per Pasal 23(1a)
   * PPh 21: 20% higher per Pasal 21(5a)
   * PPh 22: 100% higher per Pasal 22
   */
  private static hasNpwp(ctx: TransactionContext): boolean {
    if (ctx.recipientNpwp && ctx.recipientNpwp.trim().length >= 15) return true;
    return false;
  }

  private static applyNpwpSurcharge(
    ctx: TransactionContext,
    rule: RuleResult
  ): { rate: number; applied: boolean } {
    if (ctx.recipientType === 'NON_RESIDENT') return { rate: rule.rate, applied: false };
    if (this.hasNpwp(ctx)) return { rate: rule.rate, applied: false };
    if (rule.taxType === 'PPh4_2') return { rate: rule.rate, applied: false }; // Final tax, no surcharge

    if (rule.taxType === 'PPh23') {
      return { rate: rule.rate * 2, applied: true }; // 100% surcharge
    }
    if (rule.taxType === 'PPh21') {
      return { rate: rule.rate * 1.2, applied: true }; // 20% surcharge
    }
    if (rule.taxType === 'PPh22') {
      return { rate: rule.rate * 2, applied: true }; // 100% surcharge
    }

    return { rate: rule.rate, applied: false };
  }

  /**
   * Build the final TaxResolution from a matched rule + NPWP surcharge.
   */
  private static buildResolution(
    ctx: TransactionContext,
    rule: RuleResult,
    skippedRules: Array<{ ruleId: string; reason: string }>
  ): TaxResolution {
    const npwp = this.applyNpwpSurcharge(ctx, rule);
    const taxAmount = Math.round(ctx.grossAmount * npwp.rate);
    const netAmount = ctx.grossAmount - taxAmount;

    return {
      taxType: rule.taxType,
      rate: npwp.rate,
      taxAmount,
      netAmount,
      isFinal: rule.isFinal,
      npwpSurchargeApplied: npwp.applied,
      reason: npwp.applied
        ? `${rule.reason} + NPWP surcharge applied (effective ${(npwp.rate * 100).toFixed(2)}%)`
        : rule.reason,
      legalBasis: npwp.applied
        ? `${rule.legalBasis}; surcharge per Pasal ${rule.taxType === 'PPh21' ? '21(5a)' : '23(1a)'} UU PPh`
        : rule.legalBasis,
      rulePriority: rule.rulePriority,
      ruleId: rule.ruleId,
      alternativeRules: skippedRules.length > 0 ? skippedRules : undefined,
    };
  }
}
