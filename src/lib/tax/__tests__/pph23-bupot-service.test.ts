import { describe, it, expect } from 'vitest';
import {
  generateBuktiPotongNumber,
  generateBuktiPotongNumberPPh26,
  formatRupiah,
  formatPercent,
} from '../ebupot/pph23-bupot-service';

describe('e-Bupot PPh 23 Service', () => {
  describe('generateBuktiPotongNumber', () => {
    it('should generate correct format BP-23/MM.YY/NNNNNNN', () => {
      const result = generateBuktiPotongNumber('2025-01', 1);
      expect(result).toBe('BP-23/01.25/0000001');
    });

    it('should zero-pad sequence to 7 digits', () => {
      expect(generateBuktiPotongNumber('2025-03', 42)).toBe('BP-23/03.25/0000042');
      expect(generateBuktiPotongNumber('2025-12', 999)).toBe('BP-23/12.25/0000999');
    });

    it('should handle large sequence numbers', () => {
      expect(generateBuktiPotongNumber('2025-06', 1234567)).toBe('BP-23/06.25/1234567');
    });

    it('should use correct month from period', () => {
      expect(generateBuktiPotongNumber('2026-11', 1)).toBe('BP-23/11.26/0000001');
    });

    it('should increment correctly for sequential calls', () => {
      const num1 = generateBuktiPotongNumber('2025-01', 1);
      const num2 = generateBuktiPotongNumber('2025-01', 2);
      const num3 = generateBuktiPotongNumber('2025-01', 3);

      expect(num1).toBe('BP-23/01.25/0000001');
      expect(num2).toBe('BP-23/01.25/0000002');
      expect(num3).toBe('BP-23/01.25/0000003');
    });
  });

  describe('generateBuktiPotongNumberPPh26', () => {
    it('should generate correct format BP-26/MM.YY/NNNNNNN', () => {
      const result = generateBuktiPotongNumberPPh26('2025-01', 1);
      expect(result).toBe('BP-26/01.25/0000001');
    });

    it('should zero-pad sequence', () => {
      expect(generateBuktiPotongNumberPPh26('2025-06', 15)).toBe('BP-26/06.25/0000015');
    });
  });

  describe('formatRupiah', () => {
    it('should format positive amounts', () => {
      const result = formatRupiah(10_000_000);
      expect(result).toContain('10');
      expect(result).toContain('000');
      expect(result).toContain('000');
    });

    it('should format zero', () => {
      const result = formatRupiah(0);
      expect(result).toContain('0');
    });

    it('should format large amounts', () => {
      const result = formatRupiah(1_500_000_000);
      expect(result).toBeTruthy();
    });
  });

  describe('formatPercent', () => {
    it('should format whole percentages', () => {
      expect(formatPercent(0.02)).toBe('2%');
      expect(formatPercent(0.15)).toBe('15%');
      expect(formatPercent(0.20)).toBe('20%');
    });

    it('should format decimal percentages', () => {
      expect(formatPercent(0.0175)).toBe('1.75%');
      expect(formatPercent(0.0265)).toBe('2.65%');
      expect(formatPercent(0.035)).toBe('3.50%');
    });
  });
});
