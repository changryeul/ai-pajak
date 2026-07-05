import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/reports/client-profitability?consultantId=xxx
 *
 * Analyze profitability per client for tax consultants.
 * Revenue from subscription/billing vs time spent (estimated).
 */
async function handleProfitability(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const { role, userId } = req.session;

  if (role !== 'CONSULTANT' && role !== 'TAX_ADVISOR') {
    return NextResponse.json({ error: 'Consultants only' }, { status: 403 });
  }

  try {
    const { data: consultant } = await getSupabaseAdmin()
      .from('consultant')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!consultant) {
      return NextResponse.json({ error: 'Consultant not found' }, { status: 404 });
    }

    // Get assigned customers
    const { data: assignments } = await getSupabaseAdmin()
      .from('customer_consultant')
      .select(`
        customer_id,
        customer:customer_id (
          id, full_name, npwp, customer_type, created_at
        )
      `)
      .eq('consultant_id', consultant.id)
      .eq('is_active', true);

    const clientStats = await Promise.all(
      (assignments || []).map(async (assignment) => {
        const customerData = assignment.customer;
        const customer = (Array.isArray(customerData) ? customerData[0] : customerData) as Record<string, unknown>;
        const customerId = customer.id as string;

        // Count filings
        const { count: filingCount } = await getSupabaseAdmin()
          .from('tax_filing')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', customerId);

        // Count documents
        const { count: docCount } = await getSupabaseAdmin()
          .from('tax_document')
          .select('id', { count: 'exact', head: true })
          .eq('uploaded_by_user_id', userId);

        // Get billing for customer
        const { data: billings } = await getSupabaseAdmin()
          .from('billing_transaction')
          .select('amount, status')
          .eq('customer_id', customerId)
          .eq('status', 'PAID');

        const totalRevenue = (billings || []).reduce((s, b) => s + (b.amount || 0), 0);
        const filings = filingCount || 0;

        // Estimate time (hours) based on filings and documents
        const estimatedHours = filings * 2 + (docCount || 0) * 0.5;
        const hourlyRate = estimatedHours > 0 ? totalRevenue / estimatedHours : 0;

        return {
          customerId,
          customerName: customer.full_name as string,
          customerType: customer.customer_type as string,
          npwp: customer.npwp as string | null,
          joinedAt: customer.created_at as string,
          filingCount: filings,
          documentCount: docCount || 0,
          totalRevenue,
          estimatedHours,
          hourlyRate: Math.round(hourlyRate),
          profitability: totalRevenue > 0
            ? hourlyRate >= 200_000 ? 'HIGH' : hourlyRate >= 100_000 ? 'MEDIUM' : 'LOW'
            : 'UNKNOWN',
        };
      })
    );

    // Sort by revenue descending
    clientStats.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const summary = {
      totalClients: clientStats.length,
      totalRevenue: clientStats.reduce((s, c) => s + c.totalRevenue, 0),
      totalHours: clientStats.reduce((s, c) => s + c.estimatedHours, 0),
      avgHourlyRate: clientStats.length > 0
        ? Math.round(clientStats.reduce((s, c) => s + c.hourlyRate, 0) / clientStats.length)
        : 0,
      highProfitCount: clientStats.filter(c => c.profitability === 'HIGH').length,
      lowProfitCount: clientStats.filter(c => c.profitability === 'LOW').length,
    };

    return NextResponse.json({ success: true, data: { clients: clientStats, summary } });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate profitability report' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth)(request as RequestWithSession, handleProfitability);
}
