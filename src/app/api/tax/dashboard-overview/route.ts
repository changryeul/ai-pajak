import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole } from '@/types/auth';

/**
 * GET /api/tax/dashboard-overview
 *
 * Aggregated dashboard data for the redesigned monthly dashboard:
 * - KPIs (deadlines/attention/expected payment/submitted)
 * - Work queue (missing docs, AI review, billing, e-filing)
 * - Upcoming deadlines
 * - Risk alerts
 * - Client status (consultant only)
 * - Recent submissions
 */
export async function GET(request: NextRequest) {
  try {
    // Auth via Supabase server client (cookie-based)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const admin = getSupabaseAdmin();

    // Get user role(s) — user may have multiple roles
    const { data: userRoles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true);

    const roles = (userRoles || []).map(r => r.role as UserRole);

    // Block platform admin (unless has other roles)
    if (roles.length === 0) {
      // No roles — try to infer from customer or consultant table
      const { data: cust } = await admin.from('customer').select('id').eq('user_id', userId).maybeSingle();
      const { data: cons } = await admin.from('consultant').select('id').eq('user_id', userId).maybeSingle();
      if (cust) roles.push(UserRole.CUSTOMER);
      if (cons) roles.push(UserRole.CONSULTANT_JTC);
    }

    if (roles.length === 0) {
      return NextResponse.json({ error: 'No active role found', userId }, { status: 403 });
    }

    if (roles.includes(UserRole.PLATFORM_ADMIN) && roles.length === 1) {
      return NextResponse.json({ error: 'Platform admin blocked' }, { status: 403 });
    }

    // Pick primary role (prefer consultant/advisor over customer)
    const role = roles.find(r => r === UserRole.TAX_ADVISOR_JTC)
      || roles.find(r => r === UserRole.CONSULTANT_JTC)
      || roles.find(r => r === UserRole.CUSTOMER)
      || roles[0];

    const isConsultant = role === UserRole.CONSULTANT_JTC || role === UserRole.TAX_ADVISOR_JTC;

    // Determine scope: CUSTOMER sees own data, CONSULTANT sees assigned clients
    let customerIds: string[] = [];
    if (isConsultant) {
      const { data: consultant } = await admin.from('consultant').select('id').eq('user_id', userId).single();
      if (consultant) {
        const { data: assignments } = await admin
          .from('customer_consultant')
          .select('customer_id')
          .eq('consultant_id', consultant.id)
          .eq('is_active', true);
        customerIds = (assignments || []).map(a => a.customer_id);
      }
    } else {
      const { data: customer } = await admin.from('customer').select('id').eq('user_id', userId).single();
      if (customer) customerIds = [customer.id];
    }

    if (customerIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          kpis: { deadlines: 0, attention: 0, expectedTax: 0, submitted: 0 },
          workQueue: [],
          upcomingDeadlines: [],
          riskAlerts: [],
          clientStatus: [],
          recentSubmissions: [],
        },
      });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const nextMonth = new Date(year, month, 1);
    const nextMonthEnd = new Date(year, month + 1, 0);

    // Parallel data fetching
    const [queueData, calcData, filingData, customerData] = await Promise.all([
      // Queue items (pending submissions)
      admin
        .from('djp_submission_queue')
        .select('id, customer_id, tax_type, tax_period_month, tax_period_year, amount, status, created_at')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false }),

      // Tax calculations for current period
      admin
        .from('tax_calculation')
        .select('customer_id, tax_type, tax_period, calculation_result, income_data, source')
        .in('customer_id', customerIds)
        .eq('tax_period', period),

      // Tax filings
      admin
        .from('tax_filing')
        .select('id, customer_id, tax_type, tax_period, status, tax_data, filed_at, created_at')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
        .limit(50),

      // Customer info for client status
      admin
        .from('customer')
        .select('id, full_name, company_name, npwp')
        .in('id', customerIds),
    ]);

    const queue = queueData.data || [];
    const calcs = calcData.data || [];
    const filings = filingData.data || [];
    const customers = customerData.data || [];

    // ── KPIs ──
    // Deadlines this month (queue items not yet completed)
    const activeQueue = queue.filter(q => !['COMPLETED', 'FAILED'].includes(q.status));
    const deadlinesCount = activeQueue.filter(q => q.tax_period_year === year && q.tax_period_month === month).length;

    // Immediate attention: calcs without NPWP (potential issues), failed queues, overdue payments
    const calcsWithoutNpwp = calcs.filter(c => !c.income_data?.recipient_npwp).length;
    const failedQueue = queue.filter(q => q.status === 'FAILED').length;
    const attentionCount = calcsWithoutNpwp + failedQueue;

    // Expected tax for this month (sum of calculated tax)
    const expectedTax = calcs.reduce((sum, c) => sum + (c.calculation_result?.calculatedTax || 0), 0);

    // Submitted count (this year)
    const submittedCount = queue.filter(q =>
      q.status === 'COMPLETED' || q.status === 'DJP_SUBMITTED' || q.status === 'BPE_UPLOADED'
    ).length;

    // ── Work Queue ──
    const workQueue: Array<{ id: string; title: string; desc: string; priority: string; actionKey: string; count: number }> = [];

    if (calcsWithoutNpwp > 0) {
      workQueue.push({
        id: 'missing-docs',
        title: 'workQueue.missingDocs',
        desc: `${calcsWithoutNpwp} ${calcsWithoutNpwp === 1 ? 'item' : 'items'} missing NPWP`,
        priority: 'HIGH',
        actionKey: 'workQueue.requestDocs',
        count: calcsWithoutNpwp,
      });
    }

    const draftCalcs = calcs.filter(c => c.source === 'CUSTOMER_OCR').length;
    if (draftCalcs > 0) {
      workQueue.push({
        id: 'ai-review',
        title: 'workQueue.aiReview',
        desc: `${draftCalcs} AI calculations pending review`,
        priority: 'HIGH',
        actionKey: 'workQueue.startReview',
        count: draftCalcs,
      });
    }

    const pendingBilling = queue.filter(q => q.status === 'APPROVED' || q.status === 'PENDING_APPROVAL').length;
    if (pendingBilling > 0) {
      workQueue.push({
        id: 'billing',
        title: 'workQueue.createBilling',
        desc: `${pendingBilling} payments awaiting billing`,
        priority: 'MEDIUM',
        actionKey: 'workQueue.createBillingAction',
        count: pendingBilling,
      });
    }

    const readyForSubmit = queue.filter(q => q.status === 'PAYMENT_VERIFIED').length;
    if (readyForSubmit > 0) {
      workQueue.push({
        id: 'e-filing',
        title: 'workQueue.efilingSubmit',
        desc: `${readyForSubmit} filings ready to submit`,
        priority: 'MEDIUM',
        actionKey: 'workQueue.submitAction',
        count: readyForSubmit,
      });
    }

    // ── Upcoming Deadlines (next 30 days) ──
    const deadlineMap = new Map<string, { day: number; name: string }>([
      ['PPh21', { day: 10, name: 'PPh 21' }],
      ['PPh23', { day: 10, name: 'PPh 23' }],
      ['PPh25', { day: 15, name: 'PPh 25' }],
      ['PPh_FINAL', { day: 15, name: 'PPh 4(2)' }],
      ['PPN', { day: 30, name: 'PPN' }],
    ]);

    const upcomingDeadlines: Array<{ tax: string; due: string; entity: string; status: string; daysLeft: number }> = [];

    for (const [taxType, info] of deadlineMap) {
      // This month's deadline
      const deadline = new Date(year, month - 1, info.day);
      const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft >= 0 && daysLeft <= 30) {
        const hasFiling = filings.find(f =>
          f.tax_type === taxType &&
          f.tax_period === period &&
          (f.status === 'SUBMITTED' || f.status === 'ACCEPTED' || f.status === 'FILED')
        );

        const hasCalc = calcs.find(c => c.tax_type === taxType);
        const entity = customers[0] ? (customers[0].company_name || customers[0].full_name) : 'All entities';

        let status = 'pending';
        if (hasFiling) status = 'filed';
        else if (hasCalc) status = 'review';
        else if (daysLeft <= 3) status = 'urgent';
        else status = 'pending';

        upcomingDeadlines.push({
          tax: info.name,
          due: `${month}/${info.day}`,
          entity,
          status,
          daysLeft,
        });
      }
    }

    upcomingDeadlines.sort((a, b) => a.daysLeft - b.daysLeft);

    // ── Risk Alerts ──
    const riskAlerts: Array<{ type: string; message: string; severity: string }> = [];

    // Missing NPWP
    const noNpwpCalcs = calcs.filter(c => !c.income_data?.recipient_npwp);
    if (noNpwpCalcs.length > 0) {
      riskAlerts.push({
        type: 'NPWP_MISSING',
        message: `${noNpwpCalcs.length} transactions missing counterparty NPWP — 100% surcharge risk`,
        severity: 'HIGH',
      });
    }

    // Unusual tax rate
    const highRateCalcs = calcs.filter(c => {
      const rate = c.calculation_result?.taxRate || 0;
      return rate > 0.15;
    });
    if (highRateCalcs.length > 0) {
      riskAlerts.push({
        type: 'HIGH_RATE',
        message: `${highRateCalcs.length} transactions with rate > 15% — verify legal basis`,
        severity: 'MEDIUM',
      });
    }

    // Overdue queue
    const overdueQueue = queue.filter(q => q.status === 'FAILED').length;
    if (overdueQueue > 0) {
      riskAlerts.push({
        type: 'FAILED_SUBMISSION',
        message: `${overdueQueue} submissions failed — requires action`,
        severity: 'HIGH',
      });
    }

    // ── Client Status (consultant only) ──
    const clientStatus: Array<{ id: string; name: string; health: string; open: number; done: number }> = [];
    if (isConsultant) {
      for (const cust of customers) {
        const custQueue = queue.filter(q => q.customer_id === cust.id);
        const open = custQueue.filter(q => !['COMPLETED', 'FAILED'].includes(q.status)).length;
        const done = custQueue.filter(q => q.status === 'COMPLETED').length;
        const failed = custQueue.filter(q => q.status === 'FAILED').length;

        let health = 'healthy';
        if (failed > 0) health = 'attention';
        else if (open > 3) health = 'review';

        clientStatus.push({
          id: cust.id,
          name: cust.company_name || cust.full_name,
          health,
          open,
          done,
        });
      }
      clientStatus.sort((a, b) => {
        const order = { attention: 0, review: 1, healthy: 2 };
        return (order[a.health as keyof typeof order] || 3) - (order[b.health as keyof typeof order] || 3);
      });
    }

    // ── Recent Submissions ──
    const recentSubmissions = queue
      .filter(q => q.status === 'COMPLETED' || q.status === 'BPE_UPLOADED' || q.status === 'DJP_SUBMITTED')
      .slice(0, 5)
      .map(q => {
        const cust = customers.find(c => c.id === q.customer_id);
        return {
          taxType: q.tax_type,
          company: cust ? (cust.company_name || cust.full_name) : 'Unknown',
          status: q.status,
          amount: q.amount,
        };
      });

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          deadlines: deadlinesCount,
          attention: attentionCount,
          expectedTax,
          submitted: submittedCount,
        },
        workQueue,
        upcomingDeadlines: upcomingDeadlines.slice(0, 8),
        riskAlerts,
        clientStatus,
        recentSubmissions,
        isConsultant,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Dashboard overview error');
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
