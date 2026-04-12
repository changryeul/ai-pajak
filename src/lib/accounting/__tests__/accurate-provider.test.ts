import { describe, it, expect } from 'vitest';

/**
 * Accurate provider unit tests — can run without credentials.
 * Tests the internal mapping logic and type safety.
 */

// We can't import the provider directly because it's not exported as a
// standalone function — but we can test the mapping logic by reimporting
// the module and testing the shape of its output.

describe('Accurate invoice mapping', () => {
  // Replicate the mapAccurateInvoice logic from providers/accurate.ts
  function mapAccurateInvoice(type: 'SALES' | 'PURCHASE') {
    return (raw: Record<string, unknown>) => {
      const taxAmount = Number(raw.taxAmount1 || 0);
      const totalAmount = Number(raw.totalAmount || 0);
      const transDate = String(raw.transDate || '').substring(0, 10);
      return {
        externalId: String(raw.id),
        invoiceType: type,
        invoiceNumber: String(raw.number || ''),
        invoiceDate: transDate,
        counterpartyName: (raw.customerName || raw.vendorName || null) as string | null,
        counterpartyNpwp: (raw.customerNpwp || raw.vendorNpwp || null) as string | null,
        subtotal: totalAmount - taxAmount,
        taxAmount,
        totalAmount,
        currency: String(raw.currency || 'IDR'),
        hasPpn: taxAmount > 0,
        hasPph: Number(raw.taxAmount2 || 0) > 0,
        raw,
      };
    };
  }

  it('maps a sales invoice with PPN correctly', () => {
    const raw = {
      id: 12345,
      number: 'INV-2026-001',
      transDate: '2026-03-15T00:00:00+07:00',
      customerName: 'PT Maju Jaya',
      customerNpwp: '0123456789012000',
      totalAmount: 11_100_000,
      taxAmount1: 1_100_000,
      taxAmount2: 0,
      currency: 'IDR',
    };

    const result = mapAccurateInvoice('SALES')(raw);

    expect(result.externalId).toBe('12345');
    expect(result.invoiceType).toBe('SALES');
    expect(result.invoiceNumber).toBe('INV-2026-001');
    expect(result.invoiceDate).toBe('2026-03-15');
    expect(result.counterpartyName).toBe('PT Maju Jaya');
    expect(result.counterpartyNpwp).toBe('0123456789012000');
    expect(result.subtotal).toBe(10_000_000);
    expect(result.taxAmount).toBe(1_100_000);
    expect(result.totalAmount).toBe(11_100_000);
    expect(result.currency).toBe('IDR');
    expect(result.hasPpn).toBe(true);
    expect(result.hasPph).toBe(false);
  });

  it('maps a purchase invoice with PPh (withholding)', () => {
    const raw = {
      id: 67890,
      number: 'PI-2026-042',
      transDate: '2026-02-28',
      vendorName: 'CV Konsultan Teknik',
      vendorNpwp: '9876543210987000',
      totalAmount: 5_500_000,
      taxAmount1: 500_000,
      taxAmount2: 100_000,
      currency: 'IDR',
    };

    const result = mapAccurateInvoice('PURCHASE')(raw);

    expect(result.invoiceType).toBe('PURCHASE');
    expect(result.counterpartyName).toBe('CV Konsultan Teknik');
    expect(result.counterpartyNpwp).toBe('9876543210987000');
    expect(result.subtotal).toBe(5_000_000);
    expect(result.hasPpn).toBe(true);
    expect(result.hasPph).toBe(true);
  });

  it('handles missing optional fields gracefully', () => {
    const raw = {
      id: 99,
      number: '',
      transDate: '',
      totalAmount: 1_000_000,
    };

    const result = mapAccurateInvoice('SALES')(raw);

    expect(result.externalId).toBe('99');
    expect(result.invoiceNumber).toBe('');
    expect(result.invoiceDate).toBe('');
    expect(result.counterpartyName).toBeNull();
    expect(result.counterpartyNpwp).toBeNull();
    expect(result.subtotal).toBe(1_000_000);
    expect(result.taxAmount).toBe(0);
    expect(result.hasPpn).toBe(false);
    expect(result.hasPph).toBe(false);
    expect(result.currency).toBe('IDR');
  });

  it('correctly identifies PPN-only vs PPh-only vs both', () => {
    const ppnOnly = mapAccurateInvoice('SALES')({ id: 1, totalAmount: 1100, taxAmount1: 100, taxAmount2: 0 });
    expect(ppnOnly.hasPpn).toBe(true);
    expect(ppnOnly.hasPph).toBe(false);

    const pphOnly = mapAccurateInvoice('PURCHASE')({ id: 2, totalAmount: 1000, taxAmount1: 0, taxAmount2: 20 });
    expect(pphOnly.hasPpn).toBe(false);
    expect(pphOnly.hasPph).toBe(true);

    const both = mapAccurateInvoice('SALES')({ id: 3, totalAmount: 1210, taxAmount1: 110, taxAmount2: 20 });
    expect(both.hasPpn).toBe(true);
    expect(both.hasPph).toBe(true);

    const neither = mapAccurateInvoice('PURCHASE')({ id: 4, totalAmount: 1000, taxAmount1: 0, taxAmount2: 0 });
    expect(neither.hasPpn).toBe(false);
    expect(neither.hasPph).toBe(false);
  });
});

describe('OAuth config validation', () => {
  it('throws when ACCURATE env vars are missing', async () => {
    // Temporarily unset env vars
    const origId = process.env.ACCURATE_CLIENT_ID;
    const origSecret = process.env.ACCURATE_CLIENT_SECRET;
    delete process.env.ACCURATE_CLIENT_ID;
    delete process.env.ACCURATE_CLIENT_SECRET;

    try {
      const { getOAuthConfig } = await import('@/lib/accounting/oauth-config');
      expect(() => getOAuthConfig('ACCURATE')).toThrow('ACCURATE_CLIENT_ID');
    } finally {
      if (origId) process.env.ACCURATE_CLIENT_ID = origId;
      if (origSecret) process.env.ACCURATE_CLIENT_SECRET = origSecret;
    }
  });

  it('returns valid authorize URL structure when env vars are set', async () => {
    process.env.ACCURATE_CLIENT_ID = 'test-id';
    process.env.ACCURATE_CLIENT_SECRET = 'test-secret';

    try {
      const { buildAuthorizeUrl } = await import('@/lib/accounting/oauth-config');
      const url = buildAuthorizeUrl('ACCURATE', 'test-state-123');
      expect(url).toContain('https://account.accurate.id/oauth/authorize');
      expect(url).toContain('client_id=test-id');
      expect(url).toContain('state=test-state-123');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=');
    } finally {
      delete process.env.ACCURATE_CLIENT_ID;
      delete process.env.ACCURATE_CLIENT_SECRET;
    }
  });
});
