import * as fs from 'fs';
import * as path from 'path';

/**
 * Test User Fixtures for Role-Based E2E Testing
 *
 * CRITICAL: These are TEST accounts only
 * - Created by global-setup.ts before tests run
 * - Dynamic IDs are loaded from .playwright-test-data.json
 */

// Load dynamic test data if available
function loadTestData(): {
  userIds?: Record<string, string>;
  customerId?: string;
  consultantId?: string;
  taxAdvisorConsultantId?: string;
  taxPartnerId?: string;
  platformId?: string;
  activePoaId?: string;
  draftPoaId?: string;
  pendingPoaId?: string;
  unsignedDraftPoaId?: string;
  scopeMismatchCustomerId?: string;
  scopeMismatchPoaId?: string;
} {
  try {
    const dataPath = path.resolve(process.cwd(), '.playwright-test-data.json');
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }
  } catch {
    // Ignore errors - will use fallback values
  }
  return {};
}

const testData = loadTestData();

/**
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
   */
  CUSTOMER: {
    email: 'customer.test@example.com',
    password: 'TestPassword123!',
    role: 'CUSTOMER',
    get customerId() {
      return testData.customerId || '00000000-0000-0000-0000-000000000010';
    },
    fullName: 'John Doe Test',
    npwp: '1234567890123456',
  },

  /**
   * CONSULTANT_JTC - Jakarta Tax Consulting consultant
   */
  CONSULTANT_JTC: {
    email: 'consultant.test@jakartatax.co.id',
    password: 'TestPassword123!',
    role: 'CONSULTANT_JTC',
    get consultantId() {
      return testData.consultantId || '00000000-0000-0000-0000-000000000020';
    },
    fullName: 'Jane Smith Consultant',
    get taxPartnerId() {
      return testData.taxPartnerId || '00000000-0000-0000-0000-000000000003';
    },
  },

  /**
   * TAX_ADVISOR_JTC - Licensed tax advisor
   */
  TAX_ADVISOR_JTC: {
    email: 'advisor.test@jakartatax.co.id',
    password: 'TestPassword123!',
    role: 'TAX_ADVISOR_JTC',
    get consultantId() {
      return testData.taxAdvisorConsultantId || '00000000-0000-0000-0000-000000000021';
    },
    fullName: 'Bob Johnson Tax Advisor',
    get taxPartnerId() {
      return testData.taxPartnerId || '00000000-0000-0000-0000-000000000003';
    },
    licenseNumber: 'BREVET-A-12345',
  },

  /**
   * PLATFORM_ADMIN - AI Pajak platform administrator
   */
  PLATFORM_ADMIN: {
    email: 'admin.test@aipajak.com',
    password: 'TestPassword123!',
    role: 'PLATFORM_ADMIN',
    fullName: 'Alice Admin',
  },

  /**
   * SYSTEM - Automated billing service
   */
  SYSTEM: {
    serviceRoleKey: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!,
    role: 'SYSTEM',
  },

  /**
   * TAX_OPERATOR_SUPERVISOR - Operator supervisor (approvals, workload, statistics)
   *
   * NOTE: the email was updated from @jakartatax.co.id to @aipajak.com to
   * match `scripts/seed-master-and-external.ts` which is the canonical seed
   * for the operator team on prod/staging.
   */
  TAX_OPERATOR_SUPERVISOR: {
    email: 'supervisor.test@aipajak.com',
    password: 'TestPassword123!',
    role: 'TAX_OPERATOR_SUPERVISOR',
    fullName: 'Sam Supervisor',
  },

  /**
   * TAX_OPERATOR - Regular operator
   */
  TAX_OPERATOR: {
    email: 'operator.test@aipajak.com',
    password: 'TestPassword123!',
    role: 'TAX_OPERATOR',
    fullName: 'Olivia Operator',
  },

  /**
   * TAX_OPERATOR_MASTER - Platform master (Phase K-1.3)
   * Seeded by scripts/seed-master-and-external.ts
   */
  TAX_OPERATOR_MASTER: {
    email: 'master.test@aipajak.com',
    password: 'TestPassword123!',
    role: 'TAX_OPERATOR_MASTER',
    fullName: 'Mia Master',
  },

  /**
   * CUSTOMER (COMPANY) - Corporate customer for corporate-plan tests.
   * Seeded by scripts/seed-test-users.ts + scripts/seed-company-customer.ts
   */
  COMPANY_CUSTOMER: {
    email: 'company.test@example.com',
    password: 'TestPassword123!',
    role: 'CUSTOMER',
    customerType: 'COMPANY' as const,
    fullName: 'PT Example Indonesia',
    customerId: '00000000-0000-0000-0000-000000000011',
    npwp: '0123456789012000',
  },

  /**
   * EXTERNAL CONSULTANT - Consultant of a non-JTC tax_partner
   * (PT Mitra Pajak Sentosa). Used to test Phase B-1 tenant isolation
   * and Phase B-3 consultant tier subscriptions.
   *
   * Seeded by scripts/seed-master-and-external.ts.
   */
  EXTERNAL_CONSULTANT: {
    email: 'external.consultant@mitrapajak.com',
    password: 'TestPassword123!',
    role: 'CONSULTANT_JTC',
    fullName: 'Eddy External Consultant',
    partnerId: '00000000-0000-0000-0000-000000000040',
    partnerName: 'PT Mitra Pajak Sentosa',
  },
};

/**
 * Test Data - Active POA
 * Note: POAs are created dynamically by global-setup.ts
 */
export const TEST_POA = {
  get id() {
    return testData.activePoaId || '00000000-0000-0000-0000-000000000100';
  },
  poaNumber: 'POA-TEST-2025-001',
  get customerId() {
    return testData.customerId || '00000000-0000-0000-0000-000000000010';
  },
  get taxPartnerId() {
    return testData.taxPartnerId || '00000000-0000-0000-0000-000000000003';
  },
  scope: 'ALL_TAX_TYPES',
  validFrom: '2025-01-01',
  validTo: '2026-12-31',
  status: 'ACTIVE',
};

export const TEST_POA_DRAFT = {
  get id() {
    return testData.draftPoaId || '00000000-0000-0000-0000-000000000101';
  },
  poaNumber: 'POA-TEST-2025-002',
  get customerId() {
    return testData.customerId || '00000000-0000-0000-0000-000000000010';
  },
  get taxPartnerId() {
    return testData.taxPartnerId || '00000000-0000-0000-0000-000000000003';
  },
  scope: 'ALL_TAX_TYPES',
  validFrom: '2025-01-01',
  validTo: '2026-12-31',
  status: 'DRAFT',
};

export const TEST_POA_PENDING = {
  get id() {
    return testData.pendingPoaId || '00000000-0000-0000-0000-000000000102';
  },
  poaNumber: 'POA-TEST-2025-003',
  get customerId() {
    return testData.customerId || '00000000-0000-0000-0000-000000000010';
  },
  get taxPartnerId() {
    return testData.taxPartnerId || '00000000-0000-0000-0000-000000000003';
  },
  scope: 'ALL_TAX_TYPES',
  validFrom: '2025-01-01',
  validTo: '2026-12-31',
  status: 'PENDING_SIGNATURE',
};

/**
 * Test Data - Unsigned Draft POA
 * This POA stays in DRAFT status and is used to test
 * that tax advisors cannot sign before customers
 */
export const TEST_POA_UNSIGNED_DRAFT = {
  get id() {
    return testData.unsignedDraftPoaId || '00000000-0000-0000-0000-000000000103';
  },
  poaNumber: 'POA-TEST-2025-004',
  get customerId() {
    return testData.customerId || '00000000-0000-0000-0000-000000000010';
  },
  get taxPartnerId() {
    return testData.taxPartnerId || '00000000-0000-0000-0000-000000000003';
  },
  scope: 'ALL_TAX_TYPES',
  validFrom: '2025-01-01',
  validTo: '2026-12-31',
  status: 'DRAFT',
};

/**
 * Test Data - Customer with PPh23-only POA
 * Used for testing POA scope mismatch (PPh21 filing with PPh23_ONLY POA)
 * Also used for testing that customers cannot sign another customer's POA
 */
export const TEST_SCOPE_MISMATCH_CUSTOMER = {
  get customerId() {
    return testData.scopeMismatchCustomerId || 'customer-with-pph23-only-poa-uuid';
  },
  get poaId() {
    return testData.scopeMismatchPoaId || 'another-customer-poa-uuid';
  },
  email: 'scope-mismatch.test@example.com',
  poaScope: 'PPh23_ONLY',
};

/**
 * Counter to ensure unique tax periods across tests
 */
let taxFilingCounter = 0;

/**
 * Helper function to generate unique tax filing data
 * Uses counter + timestamp to avoid unique constraint violations
 * when multiple tests run in parallel or sequentially
 */
export function getUniqueTaxFiling() {
  taxFilingCounter++;
  const timestamp = Date.now();
  // Use counter + timestamp for more variation
  // Year range: 2000-2099, Month range: 01-12
  const yearOffset = (taxFilingCounter + Math.floor(timestamp / 1000)) % 100;
  const monthOffset = ((taxFilingCounter * 7) + (timestamp % 1000)) % 12;

  const taxYear = 2000 + yearOffset;
  const taxMonth = (monthOffset + 1).toString().padStart(2, '0');

  return {
    customerId: testData.customerId || '00000000-0000-0000-0000-000000000010',
    taxType: 'PPh21' as const,
    taxPeriod: `${taxYear}-${taxMonth}`,
    taxYear,
    taxData: {
      grossIncome: 10_000_000,
      deductions: 500_000,
      taxableIncome: 9_500_000,
      calculatedTax: 475_000,
      netTaxDue: 475_000,
    },
    documentIds: ['test-doc-uuid-001'],
  };
}

/**
 * Test Data - Tax Filing (Static for backward compatibility)
 * Note: For tests that need unique periods, use getUniqueTaxFiling()
 */
export const TEST_TAX_FILING = {
  get customerId() {
    return testData.customerId || '00000000-0000-0000-0000-000000000010';
  },
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

export const TEST_TAX_FILING_SEEDED = {
  id: 'dynamic',
  filingNumber: 'TAX-2025-PPh21-TEST001',
  get customerId() {
    return testData.customerId || '00000000-0000-0000-0000-000000000010';
  },
  get taxPartnerId() {
    return testData.taxPartnerId || '00000000-0000-0000-0000-000000000003';
  },
  taxType: 'PPh21' as const,
  taxPeriod: '2025-01',
  taxYear: 2025,
};

/**
 * Test Data - Billing Transaction
 */
export const TEST_BILLING = {
  idempotencyKey: `test-billing-${Date.now()}`,
  get customerId() {
    return testData.customerId || '00000000-0000-0000-0000-000000000010';
  },
  // taxFilingId is optional for billing - omit it for basic billing tests
  get taxPartnerId() {
    return testData.taxPartnerId || '00000000-0000-0000-0000-000000000003';
  },
  serviceType: 'TAX_FILING' as const,
  description: 'PPh21 tax filing service for January 2025',
  amountBase: 500_000,
  amountTax: 55_000,
  amountTotal: 555_000,
  currency: 'IDR' as const,
  dueDate: '2025-02-15',
};
