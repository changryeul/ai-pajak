import { describe, it, expect } from 'vitest';
import {
  suggestPlanForCustomer,
  doesPlanFit,
  isOverLimit,
  type CustomerUsage,
} from '../plan-recommender';
import {
  UMKM_PLAN,
  BASIC_PLAN,
  PRO_PLAN,
  CORPORATE_PLANS,
  formatPlanPrice,
  priceWithVat,
  getCorporatePlan,
} from '@/config/corporate-pricing';

describe('corporate-pricing constants', () => {
  it('exposes exactly 3 plans in ascending price order', () => {
    expect(CORPORATE_PLANS).toHaveLength(3);
    expect(CORPORATE_PLANS[0].id).toBe('UMKM');
    expect(CORPORATE_PLANS[1].id).toBe('BASIC');
    expect(CORPORATE_PLANS[2].id).toBe('PRO');
    expect(CORPORATE_PLANS[0].priceIdr).toBeLessThan(CORPORATE_PLANS[1].priceIdr);
    expect(CORPORATE_PLANS[1].priceIdr).toBeLessThan(CORPORATE_PLANS[2].priceIdr);
  });

  it('UMKM plan matches business spec', () => {
    expect(UMKM_PLAN.priceIdr).toBe(500_000);
    expect(UMKM_PLAN.limits.employees).toBe(10);
    expect(UMKM_PLAN.limits.withholdingPerMonth).toBe(30);
    expect(UMKM_PLAN.limits.ppnPerMonth).toBe(0); // UMKM not PKP
  });

  it('Basic plan matches business spec', () => {
    expect(BASIC_PLAN.priceIdr).toBe(1_500_000);
    expect(BASIC_PLAN.limits.employees).toBe(50);
    expect(BASIC_PLAN.limits.withholdingPerMonth).toBe(100);
    expect(BASIC_PLAN.limits.ppnPerMonth).toBe(200);
  });

  it('Pro plan matches business spec', () => {
    expect(PRO_PLAN.priceIdr).toBe(3_000_000);
    expect(PRO_PLAN.limits.employees).toBe(1000);
    expect(PRO_PLAN.limits.withholdingPerMonth).toBe(200);
    expect(PRO_PLAN.limits.ppnPerMonth).toBe(500);
  });

  it('formatPlanPrice displays full IDR digits without abbreviation', () => {
    expect(formatPlanPrice(UMKM_PLAN)).toBe('Rp 500.000');
    expect(formatPlanPrice(BASIC_PLAN)).toBe('Rp 1.500.000');
    expect(formatPlanPrice(PRO_PLAN)).toBe('Rp 3.000.000');
  });

  it('priceWithVat adds 11% PPN', () => {
    expect(priceWithVat(UMKM_PLAN)).toBe(555_000);
    expect(priceWithVat(BASIC_PLAN)).toBe(1_665_000);
    expect(priceWithVat(PRO_PLAN)).toBe(3_330_000);
  });

  it('getCorporatePlan looks up by id', () => {
    expect(getCorporatePlan('UMKM').id).toBe('UMKM');
    expect(getCorporatePlan('BASIC').id).toBe('BASIC');
    expect(getCorporatePlan('PRO').id).toBe('PRO');
  });
});

describe('doesPlanFit', () => {
  it('UMKM fits a tiny business with no PPN', () => {
    expect(doesPlanFit(UMKM_PLAN, { employees: 5, withholdingPerMonth: 15, ppnPerMonth: 0 })).toBe(true);
  });

  it('UMKM does NOT fit when PPN > 0 (ppnPerMonth limit = 0)', () => {
    expect(doesPlanFit(UMKM_PLAN, { employees: 5, withholdingPerMonth: 15, ppnPerMonth: 1 })).toBe(false);
  });

  it('UMKM does NOT fit when employees > 10', () => {
    expect(doesPlanFit(UMKM_PLAN, { employees: 11, withholdingPerMonth: 20, ppnPerMonth: 0 })).toBe(false);
  });

  it('UMKM does NOT fit when withholding > 30', () => {
    expect(doesPlanFit(UMKM_PLAN, { employees: 5, withholdingPerMonth: 31, ppnPerMonth: 0 })).toBe(false);
  });

  it('Basic fits mid-size with PPN activity', () => {
    expect(doesPlanFit(BASIC_PLAN, { employees: 30, withholdingPerMonth: 80, ppnPerMonth: 150 })).toBe(true);
  });

  it('Basic hits exactly at the boundary (inclusive)', () => {
    expect(doesPlanFit(BASIC_PLAN, { employees: 50, withholdingPerMonth: 100, ppnPerMonth: 200 })).toBe(true);
  });

  it('Basic does NOT fit when PPN exceeds 200', () => {
    expect(doesPlanFit(BASIC_PLAN, { employees: 30, withholdingPerMonth: 80, ppnPerMonth: 201 })).toBe(false);
  });

  it('Pro fits large enterprise', () => {
    expect(doesPlanFit(PRO_PLAN, { employees: 800, withholdingPerMonth: 180, ppnPerMonth: 400 })).toBe(true);
  });

  it('Pro does NOT fit when employees > 1000', () => {
    expect(doesPlanFit(PRO_PLAN, { employees: 1001, withholdingPerMonth: 10, ppnPerMonth: 10 })).toBe(false);
  });
});

describe('suggestPlanForCustomer', () => {
  it('recommends UMKM for micro-business', () => {
    const rec = suggestPlanForCustomer({ employees: 8, withholdingPerMonth: 25, ppnPerMonth: 0 });
    expect(rec.plan?.id).toBe('UMKM');
    expect(rec.exceedsAllPlans).toBe(false);
    expect(rec.reason).toContain('UMKM');
  });

  it('upgrades from UMKM to Basic when PPN > 0', () => {
    const rec = suggestPlanForCustomer({ employees: 8, withholdingPerMonth: 25, ppnPerMonth: 5 });
    expect(rec.plan?.id).toBe('BASIC');
  });

  it('recommends Basic for mid-size (40 emp, 80 w/h, 180 ppn)', () => {
    const rec = suggestPlanForCustomer({ employees: 40, withholdingPerMonth: 80, ppnPerMonth: 180 });
    expect(rec.plan?.id).toBe('BASIC');
  });

  it('upgrades from Basic to Pro when employees exceed 50', () => {
    const rec = suggestPlanForCustomer({ employees: 51, withholdingPerMonth: 80, ppnPerMonth: 180 });
    expect(rec.plan?.id).toBe('PRO');
  });

  it('upgrades from Basic to Pro when withholding > 100', () => {
    const rec = suggestPlanForCustomer({ employees: 30, withholdingPerMonth: 101, ppnPerMonth: 50 });
    expect(rec.plan?.id).toBe('PRO');
  });

  it('upgrades from Basic to Pro when PPN > 200', () => {
    const rec = suggestPlanForCustomer({ employees: 30, withholdingPerMonth: 50, ppnPerMonth: 201 });
    expect(rec.plan?.id).toBe('PRO');
  });

  it('recommends Pro for large enterprise', () => {
    const rec = suggestPlanForCustomer({ employees: 900, withholdingPerMonth: 150, ppnPerMonth: 400 });
    expect(rec.plan?.id).toBe('PRO');
  });

  it('returns null + exceedsAllPlans=true for over-Pro usage (custom quote)', () => {
    const rec = suggestPlanForCustomer({ employees: 2000, withholdingPerMonth: 150, ppnPerMonth: 400 });
    expect(rec.plan).toBeNull();
    expect(rec.exceedsAllPlans).toBe(true);
    expect(rec.exceedingDimensions).toContain('employees');
    // 고객 대면 문구는 인니어 (CLAUDE.md 서버 응답 언어 정책)
    expect(rec.reason).toContain('penawaran khusus');
  });

  it('identifies all exceeding dimensions for custom quote', () => {
    const rec = suggestPlanForCustomer({
      employees: 2000,
      withholdingPerMonth: 300,
      ppnPerMonth: 1000,
    });
    expect(rec.exceedingDimensions).toEqual(['employees', 'withholdingPerMonth', 'ppnPerMonth']);
  });

  it('clamps negative values to 0', () => {
    const rec = suggestPlanForCustomer({ employees: -5, withholdingPerMonth: -10, ppnPerMonth: -1 });
    expect(rec.plan?.id).toBe('UMKM'); // 0/0/0 fits UMKM
  });

  it('handles zero usage → UMKM', () => {
    const rec = suggestPlanForCustomer({ employees: 0, withholdingPerMonth: 0, ppnPerMonth: 0 });
    expect(rec.plan?.id).toBe('UMKM');
  });
});

describe('isOverLimit', () => {
  const basicUsage: CustomerUsage = { employees: 30, withholdingPerMonth: 80, ppnPerMonth: 180 };

  it('returns false when customer usage fits the plan', () => {
    expect(isOverLimit('BASIC', basicUsage)).toBe(false);
  });

  it('returns true when customer usage exceeds the plan', () => {
    expect(isOverLimit('UMKM', basicUsage)).toBe(true);
  });

  it('returns true when customer on UMKM starts PPN activity', () => {
    expect(isOverLimit('UMKM', { employees: 5, withholdingPerMonth: 10, ppnPerMonth: 1 })).toBe(true);
  });

  it('returns false for an unknown plan id (defensive)', () => {
    expect(isOverLimit('UNKNOWN' as 'UMKM', basicUsage)).toBe(false);
  });
});
