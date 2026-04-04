import { NextRequest } from 'next/server';
import { customerOperation } from '@/middleware/compose';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

/**
 * GET /api/customer/tax-calculations
 *
 * Returns the customer's own draft tax calculations.
 * Query params: period (YYYY-MM), taxType, source
 */
async function handleList(req: RequestWithSession): Promise<Response> {
  try {
    const userId = req.session.userId;
    const admin = getSupabaseAdmin();

    // Get customer record
    const { data: customer } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!customer) {
      return Response.json({ error: 'Customer record not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const period = url.searchParams.get('period');
    const taxType = url.searchParams.get('taxType');
    const source = url.searchParams.get('source');

    let query = admin
      .from('tax_calculation')
      .select('id, tax_type, tax_period, tax_year, income_data, calculation_result, source, invoice_classification, created_at, updated_at')
      .eq('customer_id', customer.id)
      .is('consultant_id', null)
      .order('created_at', { ascending: false });

    if (period) query = query.eq('tax_period', period);
    if (taxType) query = query.eq('tax_type', taxType);
    if (source) query = query.eq('source', source);

    const { data: calculations, error } = await query.limit(100);

    if (error) {
      loggers.api.error({ err: error }, 'Failed to fetch tax calculations');
      return Response.json({ error: 'Failed to fetch calculations' }, { status: 500 });
    }

    return Response.json({
      success: true,
      data: calculations || [],
      count: (calculations || []).length,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Tax calculations list error');
    return Response.json({ error: 'Failed to fetch calculations' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return customerOperation()(request as RequestWithSession, handleList);
}
