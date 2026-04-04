import { describe, it, expect } from 'vitest';

/**
 * e-Faktur PPN Validation Tests
 *
 * Validates Faktur Pajak number format per DJP standards.
 * Format: XXX.XXX-XX.XXXXXXXX (16 digits)
 *   Digits 1-2: Transaction code (01-09)
 *   Digit 3: Status code (0=normal, 1=replacement)
 *   Digits 4-5: Year code (10-30)
 *   Digits 6-16: Serial number
 */

function validateFakturFormat(num: string): { valid: boolean; reason: string } {
  const cleaned = num.replace(/[.\-\s]/g, '');

  if (cleaned.length !== 16) {
    return { valid: false, reason: `Need 16 digits (got ${cleaned.length})` };
  }

  if (!/^\d{16}$/.test(cleaned)) {
    return { valid: false, reason: 'Numbers only' };
  }

  // Format: TTTSSS-YY.NNNNNNNN (TTT=tx+status, SSS=branch, YY=year, N=serial)
  const txCode = parseInt(cleaned.substring(0, 2));
  if (txCode < 1 || txCode > 9) {
    return { valid: false, reason: `Invalid tx code ${txCode}` };
  }

  const statusCode = parseInt(cleaned.substring(2, 3));
  if (statusCode !== 0 && statusCode !== 1) {
    return { valid: false, reason: `Invalid status code ${statusCode}` };
  }

  const yearCode = parseInt(cleaned.substring(6, 8));
  if (yearCode < 10 || yearCode > 30) {
    return { valid: false, reason: `Invalid year code ${yearCode}` };
  }

  return { valid: true, reason: 'Valid' };
}

describe('e-Faktur Validation', () => {
  describe('valid formats', () => {
    it('should accept valid faktur number with separators', () => {
      expect(validateFakturFormat('010.000-24.00000001').valid).toBe(true);
    });

    it('should accept valid faktur number without separators', () => {
      expect(validateFakturFormat('0100002400000001').valid).toBe(true);
    });

    it('should accept transaction code 01 (general)', () => {
      expect(validateFakturFormat('0100002400000001').valid).toBe(true);
    });

    it('should accept transaction code 04 (DPP other value)', () => {
      expect(validateFakturFormat('0400002400000001').valid).toBe(true);
    });

    it('should accept transaction code 07 (tax-free delivery)', () => {
      expect(validateFakturFormat('0700002400000001').valid).toBe(true);
    });

    it('should accept status code 0 (normal)', () => {
      expect(validateFakturFormat('0100002400000001').valid).toBe(true);
    });

    it('should accept status code 1 (replacement)', () => {
      expect(validateFakturFormat('0110002400000001').valid).toBe(true);
    });

    it('should accept year code 24 (2024)', () => {
      expect(validateFakturFormat('0100002400000001').valid).toBe(true);
    });

    it('should accept year code 25 (2025)', () => {
      expect(validateFakturFormat('0100002500000001').valid).toBe(true);
    });
  });

  describe('invalid formats', () => {
    it('should reject too short number', () => {
      const result = validateFakturFormat('01000024');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('16 digits');
    });

    it('should reject too long number', () => {
      const result = validateFakturFormat('01000024000000011');
      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric characters', () => {
      const result = validateFakturFormat('010000240000000A');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Numbers only');
    });

    it('should reject transaction code 00', () => {
      const result = validateFakturFormat('0000002400000001');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('tx code');
    });

    it('should reject transaction code 10', () => {
      const result = validateFakturFormat('1000002400000001');
      expect(result.valid).toBe(false);
    });

    it('should reject status code 2', () => {
      const result = validateFakturFormat('0120002400000001');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('status code');
    });

    it('should reject year code 09 (too old)', () => {
      // Format: 010.000-09.00000001 → 0100000900000001 → year at [6-7] = 09
      const result = validateFakturFormat('0100000900000001');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('year code');
    });

    it('should reject year code 31 (too far future)', () => {
      // Format: 010.000-31.00000001 → 0100003100000001 → year at [6-7] = 31
      const result = validateFakturFormat('0100003100000001');
      expect(result.valid).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateFakturFormat('').valid).toBe(false);
    });
  });

  describe('duplicate detection', () => {
    it('should detect duplicates in a batch', () => {
      const numbers = ['0100002400000001', '0100002400000002', '0100002400000001'];
      const cleaned = numbers.map(n => n.replace(/[.\-\s]/g, ''));
      const duplicates = cleaned.filter((n, i) => cleaned.indexOf(n) !== i);
      expect(duplicates).toContain('0100002400000001');
      expect(duplicates).toHaveLength(1);
    });

    it('should not flag unique numbers as duplicates', () => {
      const numbers = ['0100002400000001', '0100002400000002', '0100002400000003'];
      const cleaned = numbers.map(n => n.replace(/[.\-\s]/g, ''));
      const duplicates = cleaned.filter((n, i) => cleaned.indexOf(n) !== i);
      expect(duplicates).toHaveLength(0);
    });
  });
});
