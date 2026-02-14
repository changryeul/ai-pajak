import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { withAudit } from '@/middleware/audit';
import type { RequestWithSession } from '@/types/auth';

type ReportType = 'tax_summary' | 'filing_history' | 'payment_history' | 'annual_summary';

interface TaxFilingRow {
  id: string;
  tax_type: string;
  tax_period: string;
  status: string;
  tax_data: Record<string, unknown> | null;
  filed_at: string | null;
  created_at: string;
  bpe_number: string | null;
}

interface BillingTransactionRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  description: string | null;
  created_at: string;
}

async function handleGetReport(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const reportType = url.searchParams.get('type') as ReportType;
  const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString());

  if (!reportType || !['tax_summary', 'filing_history', 'payment_history', 'annual_summary'].includes(reportType)) {
    return NextResponse.json(
      { success: false, error: 'Invalid report type' },
      { status: 400 }
    );
  }

  const { role, userId } = req.session;

  try {
    // Get customer ID for filtering
    let customerId: string | null = null;

    if (role === 'CUSTOMER') {
      const { data: customer } = await getSupabaseAdmin()
        .from('customer')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!customer) {
        return NextResponse.json({
          success: true,
          data: getEmptyReportData(reportType),
        });
      }
      customerId = customer.id;
    }

    let reportData: Record<string, unknown>;

    switch (reportType) {
      case 'tax_summary':
        reportData = await generateTaxSummary(customerId, year);
        break;
      case 'filing_history':
        reportData = await generateFilingHistory(customerId, year);
        break;
      case 'payment_history':
        reportData = await generatePaymentHistory(customerId, year);
        break;
      case 'annual_summary':
        reportData = await generateAnnualSummary(customerId, year);
        break;
      default:
        reportData = {};
    }

    return NextResponse.json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

function getEmptyReportData(reportType: ReportType): Record<string, unknown> {
  switch (reportType) {
    case 'tax_summary':
      return {
        totalIncome: 0,
        totalDeductions: 0,
        taxableIncome: 0,
        taxDue: 0,
        taxPaid: 0,
        taxTypes: [],
      };
    case 'filing_history':
      return {
        totalFilings: 0,
        accepted: 0,
        pending: 0,
        rejected: 0,
        filings: [],
      };
    case 'payment_history':
      return {
        totalPaid: 0,
        payments: [],
      };
    case 'annual_summary':
      return {
        year: new Date().getFullYear(),
        totalIncome: 0,
        totalExpenses: 0,
        netIncome: 0,
        totalTax: 0,
        effectiveTaxRate: 0,
        monthlyBreakdown: [],
      };
  }
}

async function generateTaxSummary(customerId: string | null, year: number): Promise<Record<string, unknown>> {
  // Build query
  let query = getSupabaseAdmin()
    .from('tax_filing')
    .select('*')
    .gte('tax_period', `${year}-01`)
    .lte('tax_period', `${year}-12`);

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data: filings, error } = await query;

  if (error) {
    console.error('Error fetching filings for tax summary:', error);
    throw error;
  }

  const typedFilings = (filings || []) as TaxFilingRow[];

  // Calculate totals from tax_data
  let totalIncome = 0;
  let totalDeductions = 0;
  let taxableIncome = 0;
  let taxDue = 0;

  const taxTypeMap = new Map<string, { amount: number; count: number }>();

  for (const filing of typedFilings) {
    const taxData = filing.tax_data || {};

    totalIncome += (taxData.grossIncome as number) || 0;
    totalDeductions += (taxData.deductions as number) || 0;
    taxableIncome += (taxData.taxableIncome as number) || 0;

    const filingTax = (taxData.taxDue as number) || (taxData.calculatedTax as number) || (taxData.netTaxDue as number) || 0;
    taxDue += filingTax;

    // Aggregate by tax type
    const typeData = taxTypeMap.get(filing.tax_type) || { amount: 0, count: 0 };
    typeData.amount += filingTax;
    typeData.count += 1;
    taxTypeMap.set(filing.tax_type, typeData);
  }

  const taxTypes = Array.from(taxTypeMap.entries()).map(([type, data]) => ({
    type: formatTaxType(type),
    amount: data.amount,
    count: data.count,
  }));

  return {
    totalIncome,
    totalDeductions,
    taxableIncome,
    taxDue,
    taxPaid: taxDue, // Assuming paid if filed
    taxTypes,
  };
}

async function generateFilingHistory(customerId: string | null, year: number): Promise<Record<string, unknown>> {
  let query = getSupabaseAdmin()
    .from('tax_filing')
    .select('*')
    .gte('tax_period', `${year}-01`)
    .lte('tax_period', `${year}-12`)
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data: filings, error } = await query;

  if (error) {
    console.error('Error fetching filings for history:', error);
    throw error;
  }

  const typedFilings = (filings || []) as TaxFilingRow[];

  const statusCounts = {
    accepted: 0,
    pending: 0,
    rejected: 0,
  };

  for (const filing of typedFilings) {
    if (filing.status === 'FILED' || filing.status === 'ACCEPTED') {
      statusCounts.accepted++;
    } else if (filing.status === 'DRAFT' || filing.status === 'UNDER_REVIEW') {
      statusCounts.pending++;
    } else if (filing.status === 'REJECTED') {
      statusCounts.rejected++;
    }
  }

  const filingsList = typedFilings.map((filing) => ({
    id: filing.id,
    type: formatTaxType(filing.tax_type),
    period: formatPeriod(filing.tax_period),
    status: filing.status,
    date: filing.filed_at || filing.created_at,
    bpeNumber: filing.bpe_number,
  }));

  return {
    totalFilings: typedFilings.length,
    accepted: statusCounts.accepted,
    pending: statusCounts.pending,
    rejected: statusCounts.rejected,
    filings: filingsList,
  };
}

async function generatePaymentHistory(customerId: string | null, year: number): Promise<Record<string, unknown>> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  let query = getSupabaseAdmin()
    .from('billing_transaction')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .eq('status', 'COMPLETED')
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data: transactions, error } = await query;

  if (error) {
    console.error('Error fetching payments:', error);
    // If table doesn't exist or other error, return empty data
    return {
      totalPaid: 0,
      payments: [],
    };
  }

  const typedTransactions = (transactions || []) as BillingTransactionRow[];

  let totalPaid = 0;
  const payments = typedTransactions.map((tx) => {
    totalPaid += tx.amount;
    return {
      id: tx.id,
      type: tx.description || 'Payment',
      amount: tx.amount,
      date: tx.created_at.split('T')[0],
      status: tx.status,
    };
  });

  return {
    totalPaid,
    payments,
  };
}

async function generateAnnualSummary(customerId: string | null, year: number): Promise<Record<string, unknown>> {
  let query = getSupabaseAdmin()
    .from('tax_filing')
    .select('*')
    .gte('tax_period', `${year}-01`)
    .lte('tax_period', `${year}-12`);

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data: filings, error } = await query;

  if (error) {
    console.error('Error fetching filings for annual summary:', error);
    throw error;
  }

  const typedFilings = (filings || []) as TaxFilingRow[];

  // Monthly breakdown
  const monthlyData = new Map<string, { income: number; tax: number }>();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Initialize all months
  months.forEach((month) => {
    monthlyData.set(month, { income: 0, tax: 0 });
  });

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalTax = 0;

  for (const filing of typedFilings) {
    const taxData = filing.tax_data || {};
    const income = (taxData.grossIncome as number) || 0;
    const expenses = (taxData.deductions as number) || (taxData.expenses as number) || 0;
    const tax = (taxData.taxDue as number) || (taxData.calculatedTax as number) || (taxData.netTaxDue as number) || 0;

    totalIncome += income;
    totalExpenses += expenses;
    totalTax += tax;

    // Extract month from tax_period (format: YYYY-MM)
    if (filing.tax_period) {
      const monthIndex = parseInt(filing.tax_period.split('-')[1]) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        const monthName = months[monthIndex];
        const existing = monthlyData.get(monthName)!;
        existing.income += income;
        existing.tax += tax;
      }
    }
  }

  const netIncome = totalIncome - totalExpenses;
  const effectiveTaxRate = totalIncome > 0 ? Math.round((totalTax / totalIncome) * 100) : 0;

  const monthlyBreakdown = months.map((month) => {
    const data = monthlyData.get(month)!;
    return {
      month,
      income: data.income,
      tax: data.tax,
    };
  });

  return {
    year,
    totalIncome,
    totalExpenses,
    netIncome,
    totalTax,
    effectiveTaxRate,
    monthlyBreakdown,
  };
}

function formatTaxType(type: string): string {
  const typeMap: Record<string, string> = {
    PPh21: 'PPh 21',
    PPh23: 'PPh 23',
    PPh_FINAL: 'PPh Final',
    PPN: 'PPN',
    SPT_MASA: 'SPT Masa',
    SPT_TAHUNAN: 'SPT Tahunan',
  };
  return typeMap[type] || type;
}

function formatPeriod(period: string): string {
  if (!period) return '-';
  const [year, month] = period.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex] || month} ${year}`;
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    withAudit('REPORT_VIEW')
  )(request as RequestWithSession, handleGetReport);
}
