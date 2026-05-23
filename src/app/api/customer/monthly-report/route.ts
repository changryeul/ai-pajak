import { NextRequest } from 'next/server';
import { customerOperation } from '@/middleware/compose';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

/**
 * GET /api/customer/monthly-report
 *
 * AI-powered monthly tax analysis report for customer.
 * Combines: tax calculations, filing status, anomaly detection, savings opportunities.
 *
 * Query params: period (YYYY-MM, defaults to previous month)
 */
async function handleReport(req: RequestWithSession): Promise<Response> {
  try {
    const userId = req.session.userId;
    const admin = getSupabaseAdmin();

    const { data: customer } = await admin
      .from('customer')
      .select('id, full_name, npwp')
      .eq('user_id', userId)
      .single();

    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const period = url.searchParams.get('period') || `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    const [year, month] = period.split('-').map(Number);

    // Fetch data in parallel
    const [calcResult, filingResult, queueResult, prevCalcResult] = await Promise.all([
      // Current month calculations
      admin.from('tax_calculation')
        .select('tax_type, income_data, calculation_result, source, created_at')
        .eq('customer_id', customer.id)
        .eq('tax_period', period)
        .order('created_at', { ascending: false }),

      // Current month filings
      admin.from('tax_filing')
        .select('tax_type, status, tax_data, filed_at, created_at')
        .eq('customer_id', customer.id)
        .eq('tax_period', period),

      // Queue status
      admin.from('djp_submission_queue')
        .select('tax_type, status, amount, ebilling_code, bpe_number')
        .eq('customer_id', customer.id)
        .eq('tax_period_year', year)
        .eq('tax_period_month', month),

      // Previous month calculations (for comparison)
      admin.from('tax_calculation')
        .select('tax_type, calculation_result')
        .eq('customer_id', customer.id)
        .eq('tax_period', `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`),
    ]);

    const calculations = calcResult.data || [];
    const filings = filingResult.data || [];
    const queue = queueResult.data || [];
    const prevCalculations = prevCalcResult.data || [];

    // Analyze
    const taxTypes = ['PPh21', 'PPh23', 'PPh_FINAL', 'PPN'];
    const summary = taxTypes.map(taxType => {
      const calcs = calculations.filter(c => c.tax_type === taxType);
      const filing = filings.find(f => f.tax_type === taxType);
      const queueItem = queue.find(q => q.tax_type === taxType);
      const prevCalcs = prevCalculations.filter(c => c.tax_type === taxType);

      const totalTax = calcs.reduce((sum, c) => sum + (c.calculation_result?.calculatedTax || 0), 0);
      const totalGross = calcs.reduce((sum, c) => sum + (c.calculation_result?.grossIncome || c.income_data?.gross_amount || 0), 0);
      const prevTotalTax = prevCalcs.reduce((sum, c) => sum + (c.calculation_result?.calculatedTax || 0), 0);

      const changePercent = prevTotalTax > 0 ? ((totalTax - prevTotalTax) / prevTotalTax) * 100 : 0;

      return {
        taxType,
        transactionCount: calcs.length,
        totalGross,
        totalTax,
        prevMonthTax: prevTotalTax,
        changePercent: Math.round(changePercent * 10) / 10,
        filingStatus: filing?.status || 'NOT_FILED',
        paymentStatus: queueItem?.status || 'NONE',
        bpeNumber: queueItem?.bpe_number || null,
      };
    });

    // Alerts — `messageKey` is a key inside the `monthlyReport` i18n namespace;
    // the client renders with `t(messageKey, messageParams)`.
    interface AlertRow {
      type: string;
      severity: string;
      messageKey: string;
      messageParams?: Record<string, string | number>;
    }
    const alerts: AlertRow[] = [];

    // Check for missing filings
    for (const s of summary) {
      if (s.transactionCount > 0 && s.filingStatus === 'NOT_FILED') {
        alerts.push({
          type: 'MISSING_FILING',
          severity: 'HIGH',
          messageKey: 'alertMissingFiling',
          messageParams: { taxType: s.taxType, count: s.transactionCount },
        });
      }
    }

    // Check for significant tax increase
    for (const s of summary) {
      if (s.changePercent > 50 && s.prevMonthTax > 0) {
        alerts.push({
          type: 'TAX_INCREASE',
          severity: 'MEDIUM',
          messageKey: 'alertTaxIncrease',
          messageParams: { taxType: s.taxType, changePercent: s.changePercent },
        });
      }
    }

    // Check for unpaid items
    for (const s of summary) {
      if (s.paymentStatus === 'PAYMENT_PENDING') {
        alerts.push({
          type: 'UNPAID',
          severity: 'HIGH',
          messageKey: 'alertUnpaid',
          messageParams: { taxType: s.taxType },
        });
      }
    }

    // Savings opportunities — `descriptionKey` lives under `monthlyReport` too.
    interface SavingsRow {
      category: string;
      descriptionKey: string;
      descriptionParams?: Record<string, string | number>;
      potentialSavings: number;
    }
    const savingsOpportunities: SavingsRow[] = [];

    // Check if customer has OCR-captured invoices without proper NPWP
    const noNpwpCalcs = calculations.filter(c =>
      c.source === 'CUSTOMER_OCR' && !c.income_data?.recipient_npwp
    );
    if (noNpwpCalcs.length > 0) {
      const surchargeAmount = noNpwpCalcs.reduce((sum, c) => sum + (c.calculation_result?.calculatedTax || 0), 0);
      savingsOpportunities.push({
        category: 'NPWP_SURCHARGE',
        descriptionKey: 'savingsNpwpSurcharge',
        descriptionParams: { count: noNpwpCalcs.length },
        potentialSavings: Math.round(surchargeAmount * 0.5),
      });
    }

    const totalTax = summary.reduce((sum, s) => sum + s.totalTax, 0);
    const totalGross = summary.reduce((sum, s) => sum + s.totalGross, 0);
    const totalSavings = savingsOpportunities.reduce((sum, s) => sum + s.potentialSavings, 0);

    return Response.json({
      success: true,
      data: {
        period,
        customer: { name: customer.full_name, npwp: customer.npwp },
        summary,
        totals: { totalGross, totalTax, totalSavings },
        alerts,
        savingsOpportunities,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Monthly report error');
    return Response.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return customerOperation()(request as RequestWithSession, handleReport);
}
