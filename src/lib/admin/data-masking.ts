import { createHash } from 'crypto';

/**
 * Data Masking Utilities for Platform Admin
 *
 * Platform admins can access metadata and analytics ONLY
 * All customer PII must be masked/hashed/bucketed
 *
 * HARD RULE #1: PLATFORM_ADMIN cannot access raw customer tax data
 *
 * ANONYMIZATION STANDARDS:
 *
 * 1. Customer Identifiers:
 *    - UUID: Show first 8 chars + "..." (e.g., "a1b2c3d4...")
 *    - NPWP: SHA-256 hash (first 16 chars)
 *    - Email: Show first 2 chars + "***@domain"
 *    - Phone: Show country code + "***" + last 2 digits
 *    - Name: Show initials only (e.g., "J. D.")
 *
 * 2. Financial Amounts:
 *    - Range/Percentile buckets (NOT exact amounts)
 *    - Buckets: < 1M, 1M-5M, 5M-10M, 10M-50M, > 50M
 *    - Percentages OK (e.g., payment success rate)
 *
 * 3. Time Periods:
 *    - Aggregate by: day, week, month (NOT specific timestamps)
 *    - Counts per period OK (e.g., "285 filings this month")
 *    - Specific filing times NOT accessible
 *
 * 4. Aggregation Rules:
 *    - Counts: OK (total customers, total filings)
 *    - Averages: OK (average filings per customer)
 *    - Distributions: OK (filings by type, by status)
 *    - Individual records: NOT OK
 */

/**
 * Mask customer identifier for platform admin view
 *
 * Shows only first 8 characters of UUID
 *
 * @example
 * maskCustomerId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
 * // Returns: 'a1b2c3d4...'
 */
export function maskCustomerId(customerId: string): string {
  if (!customerId || customerId.length < 8) {
    return '********';
  }
  return customerId.substring(0, 8) + '...';
}

/**
 * Hash customer NPWP for analytics
 *
 * Uses SHA-256 with salt to create consistent but non-reversible hash
 *
 * @example
 * hashNPWP('1234567890123456')
 * // Returns: 'e8f9a1b2c3d4e5f6'
 */
export function hashNPWP(npwp: string): string {
  if (!npwp) {
    return 'N/A';
  }

  const salt = process.env.NPWP_SALT || 'default-salt-change-in-production';
  const hash = createHash('sha256');
  hash.update(npwp + salt);

  // Return first 16 chars of hash
  return hash.digest('hex').substring(0, 16);
}

/**
 * Hash any customer identifier
 *
 * Generic hashing function for any sensitive identifier
 */
export function hashIdentifier(identifier: string, salt?: string): string {
  if (!identifier) {
    return 'N/A';
  }

  const hashSalt = salt || process.env.ID_HASH_SALT || 'default-salt';
  const hash = createHash('sha256');
  hash.update(identifier + hashSalt);

  return hash.digest('hex').substring(0, 16);
}

/**
 * Bucket financial amounts for platform admin view
 *
 * Groups amounts into ranges instead of showing exact values
 *
 * @example
 * bucketAmount(3500000) // Returns: '1M - 5M'
 * bucketAmount(75000000) // Returns: '> 50M'
 */
export function bucketAmount(amount: number): string {
  if (amount < 0) return 'Invalid';
  if (amount === 0) return '0';
  if (amount < 1_000_000) return '< 1M';
  if (amount < 5_000_000) return '1M - 5M';
  if (amount < 10_000_000) return '5M - 10M';
  if (amount < 50_000_000) return '10M - 50M';
  return '> 50M';
}

/**
 * Mask email address
 *
 * Shows first 2 chars + domain
 *
 * @example
 * maskEmail('john.doe@example.com')
 * // Returns: 'jo***@example.com'
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '***@***.***';
  }

  const [localPart, domain] = email.split('@');

  if (localPart.length <= 2) {
    return '**@' + domain;
  }

  return localPart.substring(0, 2) + '***@' + domain;
}

/**
 * Mask phone number
 *
 * Shows only country code and last 2 digits
 *
 * @example
 * maskPhoneNumber('+628123456789')
 * // Returns: '+62*******89'
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) {
    return '***';
  }

  const countryCode = phone.substring(0, 3); // e.g., '+62'
  const lastTwo = phone.slice(-2);
  const maskedMiddle = '*'.repeat(phone.length - 5);

  return countryCode + maskedMiddle + lastTwo;
}

/**
 * Mask customer name
 *
 * Shows only initials
 *
 * @example
 * maskCustomerName('John Doe')
 * // Returns: 'J. D.'
 */
export function maskCustomerName(name: string): string {
  if (!name) {
    return '***';
  }

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].charAt(0) + '.';
  }

  return parts.map((part) => part.charAt(0) + '.').join(' ');
}

/**
 * Sanitize audit log for platform admin view
 *
 * Removes all customer PII while keeping security-relevant fields
 */
export interface AuditLog {
  id: string;
  customer_id: string;
  tax_filing_id: string | null;
  actor_user_id: string;
  actor_organization_id: string | null;
  actor_role: string;
  activity_type: string;
  tax_type: string | null;
  tax_period: string | null;
  activity_details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SanitizedAuditLog {
  id: string;
  activityType: string;
  actorRole: string;
  customerIdHash: string;
  timestamp: string;
  ipAddress: string | null;
  // All PII removed
}

export function sanitizeAuditLog(log: AuditLog): SanitizedAuditLog {
  return {
    id: log.id,
    activityType: log.activity_type,
    actorRole: log.actor_role,
    customerIdHash: hashIdentifier(log.customer_id),
    timestamp: log.created_at,
    ipAddress: log.ip_address, // Keep for security analysis
    // ❌ EXCLUDED (contains PII):
    // - customer_id (sensitive)
    // - tax_filing_id (sensitive)
    // - actor_user_id (sensitive)
    // - activity_details (contains tax data)
    // - tax_type (links to customer)
    // - tax_period (links to customer)
  };
}

/**
 * Aggregate customer data for dashboard
 *
 * Returns only aggregated metrics, no individual customer data
 */
export interface CustomerAggregate {
  totalCustomers: number;
  newCustomersThisMonth: number;
  activeCustomers: number;
  customersByType: {
    individual: number;
    company: number;
  };
  averageFilingsPerCustomer: number;
}

export interface BillingAggregate {
  totalRevenue: string; // Bucketed
  monthlyRevenue: string; // Bucketed
  transactionCount: number;
  averageTransactionValue: string; // Bucketed
  paymentSuccessRate: number; // Percentage
}

/**
 * Create aggregated dashboard data
 *
 * All amounts are bucketed, no individual customer data
 */
export function createDashboardData(data: {
  customers: any[];
  transactions: any[];
  filings: any[];
}): {
  customerMetrics: CustomerAggregate;
  billingMetrics: BillingAggregate;
} {
  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

  return {
    customerMetrics: {
      totalCustomers: data.customers.length,
      newCustomersThisMonth: data.customers.filter(
        (c) => new Date(c.created_at) > monthAgo
      ).length,
      activeCustomers: data.customers.filter((c) => c.is_active).length,
      customersByType: {
        individual: data.customers.filter((c) => c.customer_type === 'INDIVIDUAL')
          .length,
        company: data.customers.filter((c) => c.customer_type === 'COMPANY').length,
      },
      averageFilingsPerCustomer:
        data.filings.length / data.customers.length || 0,
    },
    billingMetrics: {
      totalRevenue: bucketAmount(
        data.transactions.reduce((sum, t) => sum + t.amount_total, 0)
      ),
      monthlyRevenue: bucketAmount(
        data.transactions
          .filter((t) => new Date(t.created_at) > monthAgo)
          .reduce((sum, t) => sum + t.amount_total, 0)
      ),
      transactionCount: data.transactions.length,
      averageTransactionValue: bucketAmount(
        data.transactions.reduce((sum, t) => sum + t.amount_total, 0) /
          data.transactions.length || 0
      ),
      paymentSuccessRate:
        (data.transactions.filter((t) => t.payment_status === 'PAID').length /
          data.transactions.length) *
          100 || 0,
    },
  };
}

/**
 * Validate that data is properly masked before sending to platform admin
 *
 * Throws error if any raw customer PII is detected
 */
export function validateMaskedData(data: any): void {
  const sensitiveFields = [
    'npwp',
    'full_name',
    'company_name',
    'address',
    'phone',
    'tax_data',
  ];

  function checkObject(obj: any, path: string = ''): void {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const key of Object.keys(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (sensitiveFields.includes(key)) {
        throw new Error(
          `Sensitive field detected: ${currentPath}. ` +
            `Data must be masked before sending to platform admin.`
        );
      }

      if (typeof obj[key] === 'object') {
        checkObject(obj[key], currentPath);
      }
    }
  }

  checkObject(data);
}
