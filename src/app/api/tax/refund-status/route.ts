import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/tax/refund-status?customerId=xxx
 *
 * Track tax refund status for filings with LEBIH_BAYAR status
 */
async function handleRefundStatus(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const customerIdParam = url.searchParams.get('customerId');
  const { role, userId } = req.session;

  let customerId = customerIdParam;
  if (!customerId && role === 'CUSTOMER') {
    const { data: customer } = await getSupabaseAdmin()
      .from('customer')
      .select('id')
      .eq('user_id', userId)
      .single();
    customerId = customer?.id || null;
  }

  if (!customerId) {
    return NextResponse.json({ error: 'customerId required' }, { status: 400 });
  }

  try {
    // Get filings with LEBIH_BAYAR or refund-related status
    const { data: filings } = await getSupabaseAdmin()
      .from('tax_filing')
      .select('id, tax_type, tax_year, status, tax_data, filed_at, created_at')
      .eq('customer_id', customerId)
      .order('tax_year', { ascending: false });

    const refundItems = (filings || [])
      .filter(f => {
        const taxData = f.tax_data as Record<string, unknown> | null;
        const summary = taxData?.summary as Record<string, unknown> | null;
        return summary?.status === 'LEBIH_BAYAR' || summary?.taxRefund;
      })
      .map(f => {
        const taxData = f.tax_data as Record<string, unknown>;
        const summary = taxData?.summary as Record<string, number>;
        const filedAt = f.filed_at ? new Date(f.filed_at) : null;
        const now = new Date();

        // Estimate refund timeline (3-12 months from filing)
        let estimatedDate: string | null = null;
        let refundStatus: string = 'PENDING';

        if (filedAt) {
          const monthsSinceFiling = (now.getTime() - filedAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
          estimatedDate = new Date(filedAt.getTime() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

          if (monthsSinceFiling < 1) refundStatus = 'SUBMITTED';
          else if (monthsSinceFiling < 3) refundStatus = 'UNDER_REVIEW';
          else if (monthsSinceFiling < 6) refundStatus = 'PROCESSING';
          else if (monthsSinceFiling < 12) refundStatus = 'AWAITING_TRANSFER';
          else refundStatus = 'COMPLETED';
        }

        return {
          filingId: f.id,
          taxType: f.tax_type,
          taxYear: f.tax_year,
          status: f.status,
          refundAmount: summary?.taxRefund || 0,
          refundStatus,
          filedAt: f.filed_at,
          estimatedRefundDate: estimatedDate,
        };
      });

    const totalPendingRefund = refundItems
      .filter(r => r.refundStatus !== 'COMPLETED')
      .reduce((s, r) => s + r.refundAmount, 0);

    return NextResponse.json({
      success: true,
      data: {
        refunds: refundItems,
        totalPendingRefund,
        totalRefunds: refundItems.length,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to get refund status' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleRefundStatus);
}
