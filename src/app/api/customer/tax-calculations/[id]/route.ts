import { NextRequest } from 'next/server';
import { customerOperation } from '@/middleware/compose';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

/**
 * DELETE /api/customer/tax-calculations/[id]
 *
 * Customer can delete their own unassigned draft calculation.
 */
async function handleDelete(req: RequestWithSession): Promise<Response> {
  try {
    const userId = req.session.userId;
    const admin = getSupabaseAdmin();

    // Extract id from URL
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();

    if (!id) {
      return Response.json({ error: 'Calculation ID is required' }, { status: 400 });
    }

    // Get customer record
    const { data: customer } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!customer) {
      return Response.json({ error: 'Customer record not found' }, { status: 404 });
    }

    // Verify ownership + unassigned
    const { data: calc } = await admin
      .from('tax_calculation')
      .select('id, customer_id, consultant_id')
      .eq('id', id)
      .single();

    if (!calc) {
      return Response.json({ error: 'Calculation not found' }, { status: 404 });
    }

    if (calc.customer_id !== customer.id) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    if (calc.consultant_id !== null) {
      return Response.json({ error: 'Cannot delete: calculation has been assigned to a consultant' }, { status: 400 });
    }

    // Delete
    const { error: deleteError } = await admin
      .from('tax_calculation')
      .delete()
      .eq('id', id);

    if (deleteError) {
      loggers.api.error({ err: deleteError }, 'Failed to delete calculation');
      return Response.json({ error: 'Failed to delete' }, { status: 500 });
    }

    loggers.api.info({ userId, calculationId: id }, 'Customer deleted draft calculation');

    return Response.json({ success: true, message: 'Calculation deleted' });
  } catch (error) {
    loggers.api.error({ err: error }, 'Tax calculation delete error');
    return Response.json({ error: 'Failed to delete calculation' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  return customerOperation('INVOICE_DELETE')(request as RequestWithSession, handleDelete);
}
