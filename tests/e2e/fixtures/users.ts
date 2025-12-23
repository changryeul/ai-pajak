/**
 * Test User Fixtures for Role-Based E2E Testing
 *
 * CRITICAL: These are TEST accounts only
 * - Must be seeded in test database before running tests
 * - Never use in production
 * - Each role has specific permissions to test
 *
 * Role Hierarchy:
 * 1. CUSTOMER - Can create POA, cannot file tax
 * 2. CONSULTANT_JTC - Can calculate tax, cannot file tax
 * 3. TAX_ADVISOR_JTC - Can file tax (with active POA)
 * 4. PLATFORM_ADMIN - Cannot access tax data (CRITICAL TEST)
 * 5. SYSTEM - Can create billing, cannot access tax data
 */

export const TEST_USERS = {
  /**
   * CUSTOMER - Individual taxpayer
   * Permissions:
   * - Create POA
   * - Upload documents
   * - View own tax filings
   * - Cannot calculate or file tax
   */
  CUSTOMER: {
    email: 'customer.test@example.com',
    password: 'TestPassword123!',
    role: 'CUSTOMER',
    customerId: 'test-customer-uuid-001',
    fullName: 'John Doe Test',
    npwp: '1234567890123456',
  },

  /**
   * CONSULTANT_JTC - Jakarta Tax Consulting consultant
   * Permissions:
   * - Calculate tax
   * - Upload documents
   * - View assigned customer filings
   * - Cannot file tax (needs TAX_ADVISOR_JTC)
   */
  CONSULTANT_JTC: {
    email: 'consultant.test@jakartatax.co.id',
    password: 'TestPassword123!',
    role: 'CONSULTANT_JTC',
    consultantId: 'test-consultant-uuid-001',
    fullName: 'Jane Smith Consultant',
    taxPartnerId: 'jakarta-tax-consulting-uuid',
  },

  /**
   * TAX_ADVISOR_JTC - Licensed tax advisor
   * Permissions:
   * - Calculate tax
   * - File tax (requires active POA)
   * - Sign POA documents
   * - View all JTC customer filings
   * - Cannot file without POA (CRITICAL TEST)
   */
  TAX_ADVISOR_JTC: {
    email: 'advisor.test@jakartatax.co.id',
    password: 'TestPassword123!',
    role: 'TAX_ADVISOR_JTC',
    consultantId: 'test-advisor-uuid-001',
    fullName: 'Bob Johnson Tax Advisor',
    taxPartnerId: 'jakarta-tax-consulting-uuid',
    licenseNumber: 'BREVET-A-12345',
  },

  /**
   * PLATFORM_ADMIN - AI Pajak platform administrator
   * Permissions:
   * - View aggregated analytics
   * - Manage platform settings
   * - Cannot access tax data (CRITICAL TEST)
   * - Cannot access customer PII (CRITICAL TEST)
   * - Cannot file tax (CRITICAL TEST)
   */
  PLATFORM_ADMIN: {
    email: 'admin.test@aipajak.com',
    password: 'TestPassword123!',
    role: 'PLATFORM_ADMIN',
    fullName: 'Alice Admin',
  },

  /**
   * SYSTEM - Automated billing service
   * Authentication: Service role key (not username/password)
   * Permissions:
   * - Create billing transactions
   * - Cannot access tax data (CRITICAL TEST)
   * - Cannot file tax (CRITICAL TEST)
   */
  SYSTEM: {
    serviceRoleKey: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!,
    role: 'SYSTEM',
  },
};

/**
 * Test Data - Active POA
 * Required for tax filing tests
 */
export const TEST_POA = {
  id: 'test-poa-uuid-001',
  poaNumber: 'POA-TEST-2025-001',
  customerId: TEST_USERS.CUSTOMER.customerId,
  taxPartnerId: TEST_USERS.TAX_ADVISOR_JTC.taxPartnerId,
  scope: 'ALL_TAX_TYPES',
  validFrom: '2025-01-01',
  validTo: '2025-12-31',
  status: 'ACTIVE',
  customerSignedAt: '2025-01-15T10:00:00Z',
  partnerSignedAt: '2025-01-15T14:00:00Z',
  signedByAdvisorId: TEST_USERS.TAX_ADVISOR_JTC.consultantId,
};

/**
 * Test Data - Tax Filing
 */
export const TEST_TAX_FILING = {
  customerId: TEST_USERS.CUSTOMER.customerId,
  taxType: 'PPh21' as const,
  taxPeriod: '2025-01',
  taxYear: 2025,
  taxData: {
    grossIncome: 10_000_000,
    deductions: 500_000,
    taxableIncome: 9_500_000,
    calculatedTax: 475_000,
    netTaxDue: 475_000,
  },
  documentIds: ['test-doc-uuid-001'],
};

/**
 * Test Data - Billing Transaction
 */
export const TEST_BILLING = {
  idempotencyKey: 'test-billing-idempotency-001',
  customerId: TEST_USERS.CUSTOMER.customerId,
  taxFilingId: 'test-filing-uuid-001',
  taxPartnerId: TEST_USERS.TAX_ADVISOR_JTC.taxPartnerId,
  serviceType: 'TAX_FILING' as const,
  description: 'PPh21 tax filing service for January 2025',
  amountBase: 500_000,
  amountTax: 55_000,
  amountTotal: 555_000,
  currency: 'IDR' as const,
  dueDate: '2025-02-15',
};
