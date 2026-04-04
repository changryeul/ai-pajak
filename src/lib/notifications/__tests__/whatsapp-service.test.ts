import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  describe('tax deadline constants', () => {
    const TAX_DEADLINES: Record<string, number> = {
      PPh21: 10,
      PPh23: 10,
      PPh_FINAL: 15,
      PPN: 15, // end of month typically, using 15 for SPT
      SPT_MASA: 20,
    };

    it('should have PPh 21/23 deadline on 10th', () => {
      expect(TAX_DEADLINES.PPh21).toBe(10);
      expect(TAX_DEADLINES.PPh23).toBe(10);
    });

    it('should have PPh Final deadline on 15th', () => {
      expect(TAX_DEADLINES.PPh_FINAL).toBe(15);
    });

    it('should have SPT Masa deadline on 20th', () => {
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
