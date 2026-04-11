import { describe, it, expect } from 'vitest';
import {
  INDIVIDUAL_SPT_PLANS,
  SPT_1770SS_PLAN,
  SPT_1770S_PLAN,
  SPT_1770_PLAN,
  getIndividualSptPlan,
  formatSptPrice,
  sptPriceWithVat,
  suggestSptPlan,
  VAT_RATE,
} from '@/config/individual-pricing';

describe('individual-pricing constants', () => {
  it('exposes exactly 3 plans in ascending price order', () => {
    expect(INDIVIDUAL_SPT_PLANS).toHaveLength(3);
    expect(INDIVIDUAL_SPT_PLANS[0].id).toBe('SPT_1770SS');
    expect(INDIVIDUAL_SPT_PLANS[1].id).toBe('SPT_1770S');
    expect(INDIVIDUAL_SPT_PLANS[2].id).toBe('SPT_1770');
    expect(INDIVIDUAL_SPT_PLANS[0].priceIdr).toBeLessThan(INDIVIDUAL_SPT_PLANS[1].priceIdr);
    expect(INDIVIDUAL_SPT_PLANS[1].priceIdr).toBeLessThan(INDIVIDUAL_SPT_PLANS[2].priceIdr);
  });

  it('1770SS matches business spec', () => {
    expect(SPT_1770SS_PLAN.priceIdr).toBe(100_000);
  });

  it('1770S matches business spec', () => {
    expect(SPT_1770S_PLAN.priceIdr).toBe(200_000);
  });

  it('1770 matches business spec', () => {
    expect(SPT_1770_PLAN.priceIdr).toBe(300_000);
  });

  it('VAT rate is 11%', () => {
    expect(VAT_RATE).toBe(0.11);
  });

  it('formatSptPrice displays full IDR digits', () => {
    expect(formatSptPrice(SPT_1770SS_PLAN)).toBe('Rp 100.000');
    expect(formatSptPrice(SPT_1770S_PLAN)).toBe('Rp 200.000');
    expect(formatSptPrice(SPT_1770_PLAN)).toBe('Rp 300.000');
  });

  it('sptPriceWithVat adds 11% PPN', () => {
    expect(sptPriceWithVat(SPT_1770SS_PLAN)).toBe(111_000);
    expect(sptPriceWithVat(SPT_1770S_PLAN)).toBe(222_000);
    expect(sptPriceWithVat(SPT_1770_PLAN)).toBe(333_000);
  });

  it('getIndividualSptPlan looks up by id', () => {
    expect(getIndividualSptPlan('SPT_1770SS').id).toBe('SPT_1770SS');
    expect(getIndividualSptPlan('SPT_1770S').id).toBe('SPT_1770S');
    expect(getIndividualSptPlan('SPT_1770').id).toBe('SPT_1770');
  });

  it('getIndividualSptPlan throws on unknown id', () => {
    expect(() => getIndividualSptPlan('UNKNOWN')).toThrow();
  });
});

describe('suggestSptPlan', () => {
  it('recommends 1770 for any business income', () => {
    expect(suggestSptPlan({ hasBusinessIncome: true }).id).toBe('SPT_1770');
    expect(suggestSptPlan({ hasBusinessIncome: true, hasMultipleIncomes: true }).id).toBe('SPT_1770');
  });

  it('recommends 1770S for multiple incomes (no business)', () => {
    expect(suggestSptPlan({ hasMultipleIncomes: true }).id).toBe('SPT_1770S');
  });

  it('recommends 1770S when annual income exceeds 60M IDR', () => {
    expect(suggestSptPlan({ annualIncomeIdr: 60_000_001 }).id).toBe('SPT_1770S');
    expect(suggestSptPlan({ annualIncomeIdr: 100_000_000 }).id).toBe('SPT_1770S');
  });

  it('recommends 1770SS at exactly 60M (boundary)', () => {
    expect(suggestSptPlan({ annualIncomeIdr: 60_000_000 }).id).toBe('SPT_1770SS');
  });

  it('recommends 1770SS for empty input (default)', () => {
    expect(suggestSptPlan({}).id).toBe('SPT_1770SS');
  });
});
