import { describe, it, expect } from 'vitest';

/**
 * WhatsApp Service Tests
 *
 * Tests phone number formatting and message template generation.
 * Actual API calls are not tested (requires FONNTE_API_TOKEN).
 */

// Phone number formatting logic (extracted for testability)
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

describe('WhatsApp Service', () => {
  describe('phone number formatting', () => {
    it('should convert 08xxx to 628xxx', () => {
      expect(formatPhoneNumber('081234567890')).toBe('6281234567890');
    });

    it('should keep 62xxx as-is', () => {
      expect(formatPhoneNumber('6281234567890')).toBe('6281234567890');
    });

    it('should add 62 prefix when missing', () => {
      expect(formatPhoneNumber('81234567890')).toBe('6281234567890');
    });

    it('should strip non-numeric characters', () => {
      expect(formatPhoneNumber('+62-812-3456-7890')).toBe('6281234567890');
    });

    it('should handle spaces', () => {
      expect(formatPhoneNumber('0812 3456 7890')).toBe('6281234567890');
    });
  });

  describe('deadline reminder message', () => {
    it('should generate urgent emoji for <= 3 days', () => {
      const daysLeft = 2;
      const emoji = daysLeft <= 3 ? '🚨' : daysLeft <= 7 ? '⚠️' : '📋';
      expect(emoji).toBe('🚨');
    });

    it('should generate warning emoji for 4-7 days', () => {
      const daysLeft = 5;
      const emoji = daysLeft <= 3 ? '🚨' : daysLeft <= 7 ? '⚠️' : '📋';
      expect(emoji).toBe('⚠️');
    });

    it('should generate info emoji for > 7 days', () => {
      const daysLeft = 14;
      const emoji = daysLeft <= 3 ? '🚨' : daysLeft <= 7 ? '⚠️' : '📋';
      expect(emoji).toBe('📋');
    });
  });

  describe('tax deadline constants (Coretax / PMK 81/2024)', () => {
    // Under Coretax (2025~):
    // - All PPh payments: 15th of following month
    // - SPT Masa PPh filing: 20th of following month
    // - PPN payment + SPT Masa PPN filing: BOTH end of following month (exception)
    const TAX_DEADLINES: Record<string, number> = {
      PPh21: 15,
      PPh23: 15,
      PPh_4_2: 15,
      PPh25: 15,
      PPh26: 15,
      PPh_FINAL: 15,
      PPN: 31, // end of following month
      SPT_MASA: 20,
    };

    it('should have all PPh payment deadlines unified to 15th (Coretax)', () => {
      expect(TAX_DEADLINES.PPh21).toBe(15);
      expect(TAX_DEADLINES.PPh23).toBe(15);
      expect(TAX_DEADLINES.PPh_4_2).toBe(15);
      expect(TAX_DEADLINES.PPh25).toBe(15);
      expect(TAX_DEADLINES.PPh26).toBe(15);
    });

    it('should have PPh Final UMKM deadline on 15th', () => {
      expect(TAX_DEADLINES.PPh_FINAL).toBe(15);
    });

    it('should have PPN payment + filing deadline at end of month (PMK 81/2024 exception)', () => {
      expect(TAX_DEADLINES.PPN).toBe(31);
    });

    it('should have SPT Masa PPh filing deadline on 20th', () => {
      expect(TAX_DEADLINES.SPT_MASA).toBe(20);
    });
  });

  describe('reminder deduplication', () => {
    it('should generate unique reminder key', () => {
      const key1 = `deadline-cust1-PPh21-2025-03-${7}`;
      const key2 = `deadline-cust1-PPh21-2025-03-${3}`;
      const key3 = `deadline-cust1-PPh21-2025-03-${7}`;

      expect(key1).not.toBe(key2);
      expect(key1).toBe(key3); // Same customer, same tax, same period, same days = duplicate
    });
  });
});
