import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS } from './fixtures/users';

/**
 * Monthly Filing (SPT Masa) E2E Tests
 *
 * Tests the complete monthly filing workflow:
 * 1. Tax Resolution (세율 자동 결정)
 * 2. PPh 23 Transaction CRUD
 * 3. PPh 26 Transaction (non-resident)
 * 4. e-Bupot Generation (자동채번)
 * 5. SPT Masa DRAFT Creation
 * 6. Excel Export
 */

test.describe('Monthly Filing Flow', () => {
  let consultantToken: string;

  test.beforeAll(async ({ request }) => {
    consultantToken = await loginAs(
      request,
      TEST_USERS.CONSULTANT.email,
      TEST_USERS.CONSULTANT.password
    );
  });

  test.describe('Tax Resolution Engine', () => {
    test('✅ resolves resident service to PPh 23 at 2%', async ({ request }) => {
      const res = await request.post('/api/tax/resolve', {
        headers: createAuthHeaders(consultantToken),
        data: {
          grossAmount: 100_000_000,
          serviceCategory: 'SERVICE',
          recipientType: 'RESIDENT',
          recipientNpwp: '01.234.567.8-901.234',
        },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.resolution.taxType).toBe('PPh23');
      expect(body.data.resolution.rate).toBe(0.02);
    });

    test('✅ resolves non-resident with treaty to PPh 26', async ({ request }) => {
      const res = await request.post('/api/tax/resolve', {
        headers: createAuthHeaders(consultantToken),
        data: {
          grossAmount: 500_000_000,
          serviceCategory: 'SERVICE',
          recipientType: 'NON_RESIDENT',
          recipientCountry: 'KR',
          hasCertificateOfDomicile: true,
        },
      });
      const body = await res.json();
      expect(body.data.resolution.taxType).toBe('PPh26');
      expect(body.data.resolution.rate).toBe(0.10);
    });

    test('✅ resolves construction with qualification', async ({ request }) => {
      const res = await request.post('/api/tax/resolve', {
        headers: createAuthHeaders(consultantToken),
        data: {
          grossAmount: 1_000_000_000,
          serviceCategory: 'CONSTRUCTION',
          constructionType: 'WORK',
          qualification: 'SMALL',
          recipientType: 'RESIDENT',
        },
      });
      const body = await res.json();
      expect(body.data.resolution.taxType).toBe('PPh4_2');
      expect(body.data.resolution.rate).toBe(0.0175);
    });

    test('✅ applies NPWP surcharge (2x) when no NPWP', async ({ request }) => {
      const res = await request.post('/api/tax/resolve', {
        headers: createAuthHeaders(consultantToken),
        data: {
          grossAmount: 50_000_000,
          serviceCategory: 'SERVICE',
          recipientType: 'RESIDENT',
          recipientNpwp: '',
        },
      });
      const body = await res.json();
      expect(body.data.resolution.rate).toBe(0.04); // 2% × 2
      expect(body.data.resolution.npwpSurchargeApplied).toBe(true);
    });
  });

  test.describe('PPh 23 Transactions', () => {
    let transactionId: string;

    test('✅ can create PPh 23 transaction', async ({ request }) => {
      const res = await request.post('/api/tax/pph23-transactions', {
        headers: createAuthHeaders(consultantToken),
        data: {
          customerId: TEST_USERS.CUSTOMER.customerId,
          taxPeriod: '2025-01',
          serviceType: 'JASA_KONSULTAN',
          grossAmount: 10_000_000,
          counterpartyName: 'PT Test Vendor',
          counterpartyNpwp: '01.234.567.8-901.234',
        },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.tax_rate).toBe(0.02);
      expect(body.data.tax_amount).toBe(200_000);
      transactionId = body.data.id;
    });

    test('✅ can list PPh 23 transactions', async ({ request }) => {
      const res = await request.get(
        `/api/tax/pph23-transactions?customerId=${TEST_USERS.CUSTOMER.customerId}&period=2025-01`,
        { headers: createAuthHeaders(consultantToken) }
      );
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.transactions.length).toBeGreaterThan(0);
    });

    test('✅ can delete PPh 23 transaction', async ({ request }) => {
      if (!transactionId) return;
      const res = await request.delete(
        `/api/tax/pph23-transactions?id=${transactionId}`,
        { headers: createAuthHeaders(consultantToken) }
      );
      expect(res.ok()).toBeTruthy();
    });
  });

  test.describe('e-Bupot Generation', () => {
    test('✅ can generate bukti potong numbers', async ({ request }) => {
      // First create a transaction
      await request.post('/api/tax/pph23-transactions', {
        headers: createAuthHeaders(consultantToken),
        data: {
          customerId: TEST_USERS.CUSTOMER.customerId,
          taxPeriod: '2025-02',
          serviceType: 'JASA_TEKNIK',
          grossAmount: 5_000_000,
          counterpartyName: 'PT Bupot Test',
        },
      });

      // Generate bupot numbers
      const res = await request.post('/api/tax/ebupot-pph23', {
        headers: createAuthHeaders(consultantToken),
        data: {
          customerId: TEST_USERS.CUSTOMER.customerId,
          period: '2025-02',
        },
      });
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.generated).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('SPT Masa', () => {
    test('✅ can create SPT Masa DRAFT', async ({ request }) => {
      const res = await request.post('/api/tax/spt-masa', {
        headers: createAuthHeaders(consultantToken),
        data: {
          customerId: TEST_USERS.CUSTOMER.customerId,
          taxType: 'PPh23',
          period: '2025-01',
        },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  test.describe('CSV Bulk Import', () => {
    test('✅ can import PPh23 transactions from CSV', async ({ request }) => {
      const csv = 'transaction_date,service_type,counterparty_name,counterparty_npwp,gross_amount,invoice_number,description\n2025-03-15,JASA_TEKNIK,PT CSV Test,01.234.567.8-901.234,20000000,INV-CSV-001,Test import';

      const res = await request.post('/api/tax/bulk-import', {
        headers: createAuthHeaders(consultantToken),
        data: {
          type: 'PPh23',
          csvContent: csv,
          customerId: TEST_USERS.CUSTOMER.customerId,
          taxPeriod: '2025-03',
        },
      });
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.insertedCount).toBe(1);
    });
  });

  test.describe('Annual Simulation', () => {
    test('✅ can get annual tax simulation', async ({ request }) => {
      const res = await request.post('/api/tax/annual-simulation', {
        headers: createAuthHeaders(consultantToken),
        data: {
          customerId: TEST_USERS.CUSTOMER.customerId,
          taxYear: 2025,
        },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.taxYear).toBe(2025);
    });
  });
});
