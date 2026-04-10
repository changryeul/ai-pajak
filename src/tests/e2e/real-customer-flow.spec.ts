import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS } from './fixtures/users';

/**
 * Real Customer Data E2E Test
 *
 * Simulates a complete corporate customer lifecycle:
 *   1. Company signup (NPWP + KBLI + tax profile + JTC agreement)
 *   2. Login with email
 *   3. Company profile completion + tax regime determination
 *   4. PPh 23 monthly filing (create transaction → verify summary)
 *   5. Company profile update (additional tax fields)
 *   6. Consultant views customer data
 *
 * Uses realistic Indonesian company data:
 *   - PT Maju Sejahtera Indonesia (trading company)
 *   - NPWP: 01.234.567.8-091.000 (15 digits)
 *   - KBLI: 46100 (Wholesale trade)
 *   - Annual revenue: Rp 3.2B (UMKM eligible)
 *   - Established: 2022 (PT → 3yr UMKM limit)
 */

// Unique suffix to avoid conflicts with parallel test runs
const UNIQUE = `e2e${Date.now()}`;
const TEST_EMAIL = `maju.sejahtera.${UNIQUE}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NPWP = `01234567${String(Date.now()).slice(-7)}`;  // Unique 15-digit NPWP

let companyUserId: string;
let companyCustomerId: string;
let companyToken: string;

test.describe.serial('Real Customer Full Flow', () => {
  // ──────────────────────────────────────────────
  // Step 1: Corporate Signup
  // ──────────────────────────────────────────────
  test('1. Corporate signup via /api/auth/signup-company', async ({ request }) => {
    const response = await request.post('/api/auth/signup-company', {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        fullName: 'Budi Santoso',
        phone: '+6281234567890',
        companyName: 'PT Maju Sejahtera Indonesia',
        npwp: TEST_NPWP,
        address: 'Jl. Sudirman No. 123, Jakarta Selatan 12190',
        kbliCodes: ['46100', '47192'],
        primaryKbli: '46100',
        taxProfile: {
          annualRevenue: 3_200_000_000,
          revenueYear: 2025,
          hasEmployees: true,
          employeeCount: 15,
          isPkp: false,
          paysServiceFees: true,
          hasImportExport: false,
          hasRentalBusiness: false,
        },
        jtcAgreement: {
          accepted: true,
          version: 'v1.0',
          dataProcessing: true,
          taxFilingAuthorization: true,
        },
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(TEST_EMAIL);
    expect(body.data.npwp).toBe(TEST_NPWP);
    expect(body.data.companyName).toBe('PT Maju Sejahtera Indonesia');

    companyUserId = body.data.userId;
    companyCustomerId = body.data.customerId;

    expect(companyUserId).toBeTruthy();
    expect(companyCustomerId).toBeTruthy();
  });

  // ──────────────────────────────────────────────
  // Step 2: Login with the new company account
  // ──────────────────────────────────────────────
  test('2. Login with new company email', async ({ request }) => {
    companyToken = await loginAs(request, TEST_EMAIL, TEST_PASSWORD);
    expect(companyToken).toBeTruthy();
    expect(companyToken.length).toBeGreaterThan(10);
  });

  // ──────────────────────────────────────────────
  // Step 3: Load company profile
  // ──────────────────────────────────────────────
  test('3. Load company profile (GET /api/company-profile)', async ({ request }) => {
    const response = await request.get('/api/company-profile', {
      headers: createAuthHeaders(companyToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const profile = body.data;
    expect(profile.company_name).toBe('PT Maju Sejahtera Indonesia');
    expect(profile.npwp).toBe(TEST_NPWP);
    expect(profile.customer_type).toBe('COMPANY');
    expect(Number(profile.annual_revenue)).toBe(3_200_000_000);
    expect(profile.has_employees).toBe(true);
    expect(profile.employee_count).toBe(15);
    expect(profile.is_pkp).toBe(false);
    expect(profile.pays_service_fees).toBe(true);
    // Profile completeness should be partial (missing business_category, legal_form)
    expect(profile.profile_completeness).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────
  // Step 4: Update company profile with tax details
  // ──────────────────────────────────────────────
  test('4. Update company profile (PUT /api/company-profile)', async ({ request }) => {
    const response = await request.put('/api/company-profile', {
      headers: createAuthHeaders(companyToken),
      data: {
        id: companyCustomerId,
        business_category: 'TRADING',
        legal_form: 'PT',
        established_year: 2022,
        is_umkm: true,
        umkm_final_tax_start_year: 2023,
        pays_service_fees: true,
        has_import_export: false,
        has_rental_business: false,
        has_foreign_shareholders: false,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.business_category).toBe('TRADING');
    expect(body.data.legal_form).toBe('PT');
    expect(body.data.established_year).toBe(2022);
    expect(body.data.is_umkm).toBe(true);
    // Completeness should increase after filling required fields
    expect(body.data.profile_completeness).toBeGreaterThanOrEqual(80);
  });

  // ──────────────────────────────────────────────
  // Step 5: Determine tax regime
  // ──────────────────────────────────────────────
  test('5. Tax regime determination (POST /api/company-profile/determine-tax)', async ({ request }) => {
    const response = await request.post('/api/company-profile/determine-tax', {
      headers: createAuthHeaders(companyToken),
      data: {
        id: companyCustomerId,
        annual_revenue: 3_200_000_000,
        legal_form: 'PT',
        is_umkm: true,
        umkm_final_tax_start_year: 2023,
        established_year: 2022,
        business_category: 'TRADING',
        has_employees: true,
        is_pkp: false,
        pays_service_fees: true,
        has_import_export: false,
        has_rental_business: false,
        has_foreign_shareholders: false,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const { regime, reason, applicableTaxes, followUpQuestions } = body.data;

    // PT established 2022, UMKM start 2023, max 3 years → 2023,2024,2025 = 2 years used in 2026
    // Revenue 3.2B < 4.8B → UMKM_FINAL eligible
    expect(regime).toBe('UMKM_FINAL');
    expect(reason).toContain('PP 55/2022');
    expect(reason).toContain('PT');

    // Should detect applicable taxes
    expect(applicableTaxes).toContain('PPh 21 (근로소득세)');  // has_employees=true
    expect(applicableTaxes.some((t: string) => t.includes('PPh 23'))).toBe(true);  // pays_service_fees=true

    // PKP not registered but revenue < 4.8B — no PKP question expected
    // Follow-up questions should not include PKP
    const pkpQ = followUpQuestions.find((q: { question: string }) => q.question.includes('PKP'));
    expect(pkpQ).toBeUndefined();
  });

  // ──────────────────────────────────────────────
  // Step 6: Create PPh 23 transaction (monthly filing)
  // ──────────────────────────────────────────────
  test('6. Create PPh 23 transaction', async ({ request }) => {
    const response = await request.post('/api/tax/pph23-transactions', {
      headers: createAuthHeaders(companyToken),
      data: {
        customerId: companyCustomerId,
        taxPeriod: '2026-03',
        transactionDate: '2026-03-15',
        serviceType: 'JASA_KONSULTAN',
        grossAmount: 50_000_000,
        counterpartyName: 'PT Konsultan Abadi',
        counterpartyNpwp: '012345678901234',
        invoiceNumber: 'INV-2026-03-001',
        description: 'Jasa konsultasi IT bulan Maret',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const tx = body.data;
    expect(tx.customer_id).toBe(companyCustomerId);
    expect(tx.tax_period).toBe('2026-03');
    expect(tx.service_type).toBe('JASA_KONSULTAN');
    expect(Number(tx.gross_amount)).toBe(50_000_000);
    // PPh 23 rate: 2% (with NPWP)
    expect(Number(tx.tax_rate)).toBeCloseTo(0.02);
    expect(Number(tx.tax_amount)).toBe(1_000_000);
  });

  // ──────────────────────────────────────────────
  // Step 7: Create second PPh 23 transaction (different type)
  // ──────────────────────────────────────────────
  test('7. Create second PPh 23 transaction (Sewa)', async ({ request }) => {
    const response = await request.post('/api/tax/pph23-transactions', {
      headers: createAuthHeaders(companyToken),
      data: {
        customerId: companyCustomerId,
        taxPeriod: '2026-03',
        transactionDate: '2026-03-20',
        serviceType: 'SEWA',
        grossAmount: 30_000_000,
        counterpartyName: 'CV Rental Alat Berat',
        counterpartyNpwp: '098765432109876',
        invoiceNumber: 'INV-2026-03-002',
        description: 'Sewa alat berat proyek Q1',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    // 2% of 30M = 600K
    expect(Number(body.data.tax_amount)).toBe(600_000);
  });

  // ──────────────────────────────────────────────
  // Step 8: Verify PPh 23 transaction list + summary
  // ──────────────────────────────────────────────
  test('8. PPh 23 transaction list and summary', async ({ request }) => {
    const response = await request.get(
      `/api/tax/pph23-transactions?customerId=${companyCustomerId}&period=2026-03`,
      { headers: createAuthHeaders(companyToken) }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const { transactions, summary } = body.data;
    expect(transactions.length).toBe(2);

    // Summary totals
    expect(summary.totalGross).toBe(80_000_000);   // 50M + 30M
    expect(summary.totalTax).toBe(1_600_000);       // 1M + 600K
    expect(summary.transactionCount).toBe(2);

    // By service type breakdown
    const byType = summary.byServiceType;
    expect(byType.length).toBe(2);
    const konsultanTotal = byType.find((t: { type: string }) => t.type === 'JASA_KONSULTAN');
    expect(konsultanTotal?.total).toBe(1_000_000);
  });

  // ──────────────────────────────────────────────
  // Step 9: Verify profile was saved with tax_regime
  // ──────────────────────────────────────────────
  test('9. Verify tax regime persisted in profile', async ({ request }) => {
    const response = await request.get('/api/company-profile', {
      headers: createAuthHeaders(companyToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    const profile = body.data;

    expect(profile.tax_regime).toBe('UMKM_FINAL');
    expect(profile.tax_regime_reason).toBeTruthy();
    expect(profile.tax_regime_determined_at).toBeTruthy();
  });

  // ──────────────────────────────────────────────
  // Step 10: Consultant can view this customer's data
  // ──────────────────────────────────────────────
  test('10. Consultant can access customer profile', async ({ request }) => {
    const consultantToken = await loginAs(
      request,
      TEST_USERS.CONSULTANT_JTC.email,
      TEST_USERS.CONSULTANT_JTC.password
    );

    // Consultant accesses customer profile by ID
    const response = await request.get(
      `/api/company-profile?customerId=${companyCustomerId}`,
      { headers: createAuthHeaders(consultantToken) }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.company_name).toBe('PT Maju Sejahtera Indonesia');
  });

  // ──────────────────────────────────────────────
  // Step 11: Platform admin CANNOT access this data
  // ──────────────────────────────────────────────
  test('11. Platform admin blocked from PPh 23 data', async ({ request }) => {
    const adminToken = await loginAs(
      request,
      TEST_USERS.PLATFORM_ADMIN.email,
      TEST_USERS.PLATFORM_ADMIN.password
    );

    const response = await request.get(
      `/api/tax/pph23-transactions?customerId=${companyCustomerId}&period=2026-03`,
      { headers: createAuthHeaders(adminToken) }
    );

    // Should be 403 (blockPlatformAdmin)
    expect(response.status()).toBe(403);
  });

  // ──────────────────────────────────────────────
  // Step 12: Create PPh 23 with Tax Resolution Engine
  // ──────────────────────────────────────────────
  test('12. PPh 23 with auto tax resolution engine', async ({ request }) => {
    const response = await request.post('/api/tax/pph23-transactions', {
      headers: createAuthHeaders(companyToken),
      data: {
        customerId: companyCustomerId,
        taxPeriod: '2026-03',
        transactionDate: '2026-03-25',
        grossAmount: 20_000_000,
        counterpartyName: 'PT Jasa Teknik Nusantara',
        counterpartyNpwp: '012345678901234',
        useResolution: true,
        serviceCategory: 'SERVICE',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tax_amount).toBeTruthy();

    // Resolution info should be returned
    if (body.resolution) {
      expect(body.resolution.ruleId).toBeTruthy();
      expect(body.resolution.legalBasis).toBeTruthy();
    }
  });

  // ──────────────────────────────────────────────
  // Step 13: Duplicate NPWP signup should fail
  // ──────────────────────────────────────────────
  test('13. Duplicate NPWP signup rejected', async ({ request }) => {
    const response = await request.post('/api/auth/signup-company', {
      data: {
        email: `duplicate.${UNIQUE}@example.com`,
        password: TEST_PASSWORD,
        fullName: 'Duplicate User',
        companyName: 'PT Duplicate',
        npwp: TEST_NPWP,
        jtcAgreement: { accepted: true, version: 'v1.0', dataProcessing: true, taxFilingAuthorization: true },
      },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toContain('NPWP');
  });

  // ──────────────────────────────────────────────
  // Step 14: Missing JTC agreement should fail
  // ──────────────────────────────────────────────
  test('14. Signup without JTC agreement rejected', async ({ request }) => {
    const response = await request.post('/api/auth/signup-company', {
      data: {
        email: `noagreement.${UNIQUE}@example.com`,
        password: TEST_PASSWORD,
        fullName: 'No Agreement',
        companyName: 'PT No Agreement',
        npwp: '999888777666555',
        jtcAgreement: { accepted: false },
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('약관');
  });

  // ──────────────────────────────────────────────
  // Cleanup: Delete test user (best effort)
  // ──────────────────────────────────────────────
  test.afterAll(async ({ request }) => {
    // Cleanup via Supabase admin (if service key available)
    if (companyUserId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await request.delete(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${companyUserId}`,
          {
            headers: {
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );
      } catch {
        // Best effort cleanup
      }
    }
  });
});

/**
 * Separate test: UMKM Expiry Scenario
 *
 * PT established 2020, UMKM start 2021 → 3yr limit reached (2021,2022,2023)
 * Should get GENERAL_25 regime
 */
test.describe('UMKM Expiry Scenario', () => {
  test('PT with expired UMKM period gets GENERAL_25', async ({ request }) => {
    // Use consultant token (has auth, can call determine-tax)
    const token = await loginAs(
      request,
      TEST_USERS.CONSULTANT_JTC.email,
      TEST_USERS.CONSULTANT_JTC.password
    );

    // We need a customer ID for determine-tax. Use the test customer.
    const customerId = TEST_USERS.CUSTOMER.customerId;

    const response = await request.post('/api/company-profile/determine-tax', {
      headers: createAuthHeaders(token),
      data: {
        id: customerId,
        annual_revenue: 2_000_000_000,
        legal_form: 'PT',
        is_umkm: true,
        umkm_final_tax_start_year: 2021,
        established_year: 2020,
        business_category: 'SERVICE',
        has_employees: true,
        is_pkp: false,
        pays_service_fees: false,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // PT 3yr limit: 2021→2023 done, 2026 = 5 years used > 3 → expired
    expect(body.data.regime).toBe('GENERAL_25');
    expect(body.data.reason).toContain('만료');
  });

  test('Individual with 500M exemption note (revenue < 4.8B)', async ({ request }) => {
    const token = await loginAs(
      request,
      TEST_USERS.CONSULTANT_JTC.email,
      TEST_USERS.CONSULTANT_JTC.password
    );

    const customerId = TEST_USERS.CUSTOMER.customerId;

    const response = await request.post('/api/company-profile/determine-tax', {
      headers: createAuthHeaders(token),
      data: {
        id: customerId,
        annual_revenue: 800_000_000,
        legal_form: 'OP',  // Orang Pribadi (individual)
        is_umkm: true,
        umkm_final_tax_start_year: 2023,
        established_year: 2020,
        business_category: 'SERVICE',
        has_employees: false,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // OP, revenue < 4.8B, UMKM start 2023, max 7 years → still eligible
    expect(body.data.regime).toBe('UMKM_FINAL');
  });
});

/**
 * Separate test: Revenue above 4.8B → always GENERAL_25
 */
test('High revenue company always gets GENERAL_25', async ({ request }) => {
  const token = await loginAs(
    request,
    TEST_USERS.CONSULTANT_JTC.email,
    TEST_USERS.CONSULTANT_JTC.password
  );

  const response = await request.post('/api/company-profile/determine-tax', {
    headers: createAuthHeaders(token),
    data: {
      id: TEST_USERS.CUSTOMER.customerId,
      annual_revenue: 10_000_000_000,  // 10B
      legal_form: 'PT',
      is_umkm: false,
      business_category: 'TRADING',
      has_employees: true,
      is_pkp: true,
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data.regime).toBe('GENERAL_25');
  expect(body.data.applicableTaxes).toContain('PPN 11% (부가가치세)');
});
