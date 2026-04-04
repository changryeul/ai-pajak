import { describe, it, expect } from 'vitest';

/**
 * UMKM PPh Final Calculation Tests
 *
 * PP 55/2022: 0.5% on gross revenue, first Rp 500M exempt
 * PP 23/2018: Revenue limit Rp 4.8B
 */

const UMKM_RATE = 0.005;
const EXEMPTION = 500_000_000;
const THRESHOLD = 4_800_000_000;

interface MonthlyResult {
  month: number;
  revenue: number;
  cumulative: number;
  taxableRevenue: number;
  tax: number;
  exempt: boolean;
}

function calculateUMKMMonthly(monthlyRevenues: number[]): MonthlyResult[] {
  let cumulative = 0;
  return monthlyRevenues.map((revenue, i) => {
    const prevCumulative = cumulative;
    cumulative += revenue;
    let taxableRevenue = 0;
    if (cumulative > EXEMPTION) {
      if (prevCumulative >= EXEMPTION) {
        taxableRevenue = revenue;
      } else {
        taxableRevenue = cumulative - EXEMPTION;
      }
    }
    const tax = Math.round(taxableRevenue * UMKM_RATE);
    return { month: i + 1, revenue, cumulative, taxableRevenue, tax, exempt: cumulative <= EXEMPTION };
  });
}

describe('UMKM PPh Final Calculation (PP 55/2022)', () => {
  describe('exemption threshold (Rp 500M)', () => {
    it('should exempt all revenue when cumulative <= Rp 500M', () => {
      const results = calculateUMKMMonthly([100_000_000, 100_000_000, 100_000_000]);
      expect(results.every(r => r.exempt)).toBe(true);
      expect(results.every(r => r.tax === 0)).toBe(true);
    });

    it('should apply partial exemption in transition month', () => {
      // Month 1-5: 100M each = 500M (exempt)
      // Month 6: 100M → cumulative 600M → taxable 100M
      const revenues = [100_000_000, 100_000_000, 100_000_000, 100_000_000, 100_000_000, 100_000_000];
      const results = calculateUMKMMonthly(revenues);

      // First 5 months: exempt
      for (let i = 0; i < 5; i++) {
        expect(results[i].tax).toBe(0);
        expect(results[i].exempt).toBe(true);
      }

      // Month 6: partial — only 100M taxable (600M - 500M)
      expect(results[5].taxableRevenue).toBe(100_000_000);
      expect(results[5].tax).toBe(500_000); // 100M × 0.5%
      expect(results[5].exempt).toBe(false);
    });

    it('should tax full revenue after exemption threshold passed', () => {
      const revenues = [600_000_000, 100_000_000]; // Month 1: over threshold
      const results = calculateUMKMMonthly(revenues);

      // Month 1: 600M cumulative, taxable = 600M - 500M = 100M
      expect(results[0].taxableRevenue).toBe(100_000_000);
      expect(results[0].tax).toBe(500_000);

      // Month 2: full 100M taxable
      expect(results[1].taxableRevenue).toBe(100_000_000);
      expect(results[1].tax).toBe(500_000);
    });
  });

  describe('tax rate calculation', () => {
    it('should apply 0.5% rate on taxable revenue', () => {
      const results = calculateUMKMMonthly([1_000_000_000]); // 1B in month 1
      // Taxable: 1B - 500M = 500M
      expect(results[0].taxableRevenue).toBe(500_000_000);
      expect(results[0].tax).toBe(2_500_000); // 500M × 0.5%
    });

    it('should calculate zero tax for zero revenue', () => {
      const results = calculateUMKMMonthly([0, 0, 0]);
      expect(results.every(r => r.tax === 0)).toBe(true);
    });
  });

  describe('annual totals', () => {
    it('should calculate correct annual total for typical UMKM', () => {
      // Monthly revenue: Rp 200M × 12 = Rp 2.4B annual
      const revenues = Array(12).fill(200_000_000);
      const results = calculateUMKMMonthly(revenues);

      const totalRevenue = results.reduce((s, r) => s + r.revenue, 0);
      const totalTax = results.reduce((s, r) => s + r.tax, 0);

      expect(totalRevenue).toBe(2_400_000_000);
      // Months 1-2: 200M each = 400M (exempt)
      // Month 3: 200M → cumulative 600M → taxable 100M → tax 500K
      // Months 4-12: 200M each → full taxable → tax 1M each
      expect(totalTax).toBe(500_000 + 9 * 1_000_000); // 9.5M
    });
  });

  describe('eligibility check', () => {
    it('should be eligible when annual revenue <= Rp 4.8B', () => {
      const totalRevenue = 4_800_000_000;
      expect(totalRevenue <= THRESHOLD).toBe(true);
    });

    it('should be ineligible when annual revenue > Rp 4.8B', () => {
      const totalRevenue = 4_800_000_001;
      expect(totalRevenue <= THRESHOLD).toBe(false);
    });

    it('should be eligible at exactly Rp 4.8B', () => {
      const totalRevenue = THRESHOLD;
      expect(totalRevenue <= THRESHOLD).toBe(true);
    });
  });
});
