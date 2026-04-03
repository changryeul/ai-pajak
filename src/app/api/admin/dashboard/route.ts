import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RequestWithSession } from '@/types/auth';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { UserRole } from '@/types/auth';
import {
  bucketAmount,
  validateMaskedData,
} from '@/lib/admin/data-masking';
import { loggers } from '@/lib/logger';

/**
 * CRITICAL ENDPOINT - Platform Admin Dashboard
 *
 * HARD RULES ENFORCED:
 * 1. PLATFORM_ADMIN can ONLY access aggregated/anonymized data
 * 2. NO customer PII (names, NPWP, addresses)
 * 3. NO tax filing details
 * 4. NO specific transaction amounts (bucketed only)
 * 5. All data must pass validateMaskedData() check
 * 6. All access is audit logged
 *
 * This endpoint provides platform health metrics and analytics ONLY.
 * PLATFORM_ADMIN cannot see individual customer data or tax filings.
 *
 * @route GET /api/admin/dashboard
 */

interface DashboardResponse {
  success: boolean;
  generatedAt: string;
  platformMetrics: {
    totalCustomers: number;
    activeCustomers: number;
    newCustomersThisMonth: number;
    customersByType: {
      individual: number;
      company: number;
    };
  };
  taxPartnerMetrics: {
    totalTaxPartners: number;
    activeTaxPartners: number;
    totalConsultants: number;
    activeConsultants: number;
    consultantsByRole: {
      consultant: number;
      taxAdvisor: number;
    };
  };
  filingMetrics: {
    totalFilings: number;
    filingsThisMonth: number;
    filingsByStatus: {
      draft: number;
      submitted: number;
      approved: number;
      rejected: number;
    };
    filingsByType: {
      PPh21: number;
      PPh23: number;
      PPN: number;
      other: number;
    };
    averageFilingsPerCustomer: number;
  };
  billingMetrics: {
    totalRevenue: string; // Bucketed amount
    monthlyRevenue: string; // Bucketed amount
    transactionCount: number;
    transactionCountThisMonth: number;
    averageTransactionValue: string; // Bucketed amount
    paymentSuccessRate: number; // Percentage
  };
  systemMetrics: {
    totalDocuments: number;
    documentsThisMonth: number;
    activePOAs: number;
    poasThisMonth: number;
    totalAuditLogs: number;
    auditLogsThisMonth: number;
  };
  warning: string;
}

async function handler(request: RequestWithSession): Promise<Response> {
  const { session } = request;

  // Log platform admin access
  loggers.api.warn({ userId: session.userId, email: session.email, ipAddress: request.headers.get('x-forwarded-for') || 'unknown' }, 'Platform admin dashboard accessed');

  // Get Supabase client
  const supabase = await createClient();

  // Calculate date ranges
  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

  // Get aggregated customer metrics
  const { data: customers } = await supabase.from('customer').select('id, customer_type, is_active, created_at');

  const { data: taxPartners } = await supabase.from('tax_partner').select('id, is_active');

  const { data: consultants } = await supabase
    .from('consultant')
    .select('id, is_active, created_at')
    .eq('is_active', true);

  // Get user roles for consultant/tax advisor split
  interface ConsultantWithUserId {
    id: string;
    is_active: boolean;
    created_at: string;
    user_id?: string;
  }
  const consultantUserIds = consultants?.map((c) => (c as ConsultantWithUserId).user_id).filter(Boolean) || [];
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('user_id', consultantUserIds);

  const { data: taxFilings } = await supabase.from('tax_filing').select('id, filing_status, tax_type, created_at');

  const { data: billingTransactions } = await supabase
    .from('billing_transaction')
    .select('id, amount_total, payment_status, created_at');

  const { data: documents } = await supabase.from('document').select('id, created_at');

  const { data: poas } = await supabase.from('power_of_attorney').select('id, status, created_at');

  const { data: auditLogs } = await supabase.from('audit_log').select('id, created_at');

  // Calculate platform metrics
  const platformMetrics = {
    totalCustomers: customers?.length || 0,
    activeCustomers: customers?.filter((c) => c.is_active).length || 0,
    newCustomersThisMonth:
      customers?.filter((c) => new Date(c.created_at) > monthAgo).length || 0,
    customersByType: {
      individual:
        customers?.filter((c) => c.customer_type === 'INDIVIDUAL').length || 0,
      company: customers?.filter((c) => c.customer_type === 'COMPANY').length || 0,
    },
  };

  // Calculate tax partner metrics
  const consultantRoleCount =
    userRoles?.filter((ur) => ur.role === UserRole.CONSULTANT_JTC).length || 0;
  const taxAdvisorRoleCount =
    userRoles?.filter((ur) => ur.role === UserRole.TAX_ADVISOR_JTC).length || 0;

  const taxPartnerMetrics = {
    totalTaxPartners: taxPartners?.length || 0,
    activeTaxPartners: taxPartners?.filter((tp) => tp.is_active).length || 0,
    totalConsultants: consultants?.length || 0,
    activeConsultants: consultants?.filter((c) => c.is_active).length || 0,
    consultantsByRole: {
      consultant: consultantRoleCount,
      taxAdvisor: taxAdvisorRoleCount,
    },
  };

  // Calculate filing metrics
  const filingMetrics = {
    totalFilings: taxFilings?.length || 0,
    filingsThisMonth:
      taxFilings?.filter((f) => new Date(f.created_at) > monthAgo).length || 0,
    filingsByStatus: {
      draft: taxFilings?.filter((f) => f.filing_status === 'DRAFT').length || 0,
      submitted:
        taxFilings?.filter((f) => f.filing_status === 'SUBMITTED').length || 0,
      approved:
        taxFilings?.filter((f) => f.filing_status === 'APPROVED_BY_DJP').length ||
        0,
      rejected:
        taxFilings?.filter((f) => f.filing_status === 'REJECTED_BY_DJP').length ||
        0,
    },
    filingsByType: {
      PPh21: taxFilings?.filter((f) => f.tax_type === 'PPh21').length || 0,
      PPh23: taxFilings?.filter((f) => f.tax_type === 'PPh23').length || 0,
      PPN: taxFilings?.filter((f) => f.tax_type === 'PPN').length || 0,
      other:
        taxFilings?.filter(
          (f) => !['PPh21', 'PPh23', 'PPN'].includes(f.tax_type)
        ).length || 0,
    },
    averageFilingsPerCustomer:
      platformMetrics.totalCustomers > 0
        ? parseFloat(
            ((taxFilings?.length || 0) / platformMetrics.totalCustomers).toFixed(2)
          )
        : 0,
  };

  // Calculate billing metrics
  const totalRevenue =
    billingTransactions?.reduce((sum, t) => sum + t.amount_total, 0) || 0;
  const monthlyRevenue =
    billingTransactions
      ?.filter((t) => new Date(t.created_at) > monthAgo)
      .reduce((sum, t) => sum + t.amount_total, 0) || 0;
  const monthlyTransactionCount =
    billingTransactions?.filter((t) => new Date(t.created_at) > monthAgo).length ||
    0;
  const paidTransactions =
    billingTransactions?.filter((t) => t.payment_status === 'PAID').length || 0;
  const totalTransactions = billingTransactions?.length || 0;

  const billingMetrics = {
    totalRevenue: bucketAmount(totalRevenue), // ← Bucketed, not exact amount
    monthlyRevenue: bucketAmount(monthlyRevenue), // ← Bucketed
    transactionCount: totalTransactions,
    transactionCountThisMonth: monthlyTransactionCount,
    averageTransactionValue: bucketAmount(
      totalTransactions > 0 ? totalRevenue / totalTransactions : 0
    ), // ← Bucketed
    paymentSuccessRate:
      totalTransactions > 0
        ? parseFloat(((paidTransactions / totalTransactions) * 100).toFixed(2))
        : 0,
  };

  // Calculate system metrics
  const systemMetrics = {
    totalDocuments: documents?.length || 0,
    documentsThisMonth:
      documents?.filter((d) => new Date(d.created_at) > monthAgo).length || 0,
    activePOAs: poas?.filter((p) => p.status === 'ACTIVE').length || 0,
    poasThisMonth:
      poas?.filter((p) => new Date(p.created_at) > monthAgo).length || 0,
    totalAuditLogs: auditLogs?.length || 0,
    auditLogsThisMonth:
      auditLogs?.filter((a) => new Date(a.created_at) > monthAgo).length || 0,
  };

  // Prepare response
  const response: DashboardResponse = {
    success: true,
    generatedAt: new Date().toISOString(),
    platformMetrics,
    taxPartnerMetrics,
    filingMetrics,
    billingMetrics,
    systemMetrics,
    warning:
      'All data is aggregated and anonymized. Customer PII and tax data are not accessible to platform administrators.',
  };

  // CRITICAL: Validate no sensitive data leaked
  try {
    validateMaskedData(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggers.api.error({ err: errorMessage, userId: session.userId }, 'Data masking validation failed');

    return NextResponse.json(
      {
        error: 'Data masking validation failed',
        message:
          'Sensitive data detected in response. Please contact system administrator.',
      },
      { status: 500 }
    );
  }

  loggers.api.info({ userId: session.userId, totalCustomers: platformMetrics.totalCustomers, totalFilings: filingMetrics.totalFilings, transactionCount: billingMetrics.transactionCount }, 'Platform admin dashboard data generated');

  return NextResponse.json(response);
}

/**
 * GET /api/admin/dashboard
 *
 * Platform admin dashboard with aggregated metrics
 *
 * MIDDLEWARE STACK (3 layers):
 * 1. requireAuth - Must be logged in
 * 2. requireRole - Only PLATFORM_ADMIN allowed
 * 3. withAudit - All access is logged
 *
 * CRITICAL: blockPlatformAdmin is NOT used here because this endpoint
 * is specifically designed for platform admins. However, all data is
 * aggregated and masked per PLATFORM_ADMIN access policy.
 */
export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.PLATFORM_ADMIN),
    withAudit('PLATFORM_ADMIN_DASHBOARD_VIEW')
  )(request as RequestWithSession, handler);
}
