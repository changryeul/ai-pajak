import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get Audit Logs
 *
 * CRITICAL SECURITY:
 * - PLATFORM_ADMIN is blocked from accessing audit logs
 * - Audit logs contain sensitive customer and tax data references
 *
 * @route GET /api/audit/logs
 */
async function handleGetLogs(req: RequestWithSession): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const activityType = searchParams.get('activityType');
  const customerId = searchParams.get('customerId');

  try {
    // Build query
    let query = supabaseAdmin
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    // Apply filters
    if (activityType) {
      query = query.eq('activity_type', activityType);
    }

    // Role-based filtering
    const { role, userId } = req.session;

    if (role === 'CUSTOMER') {
      // Customers can only see their own audit logs
      const { data: customer } = await supabaseAdmin
        .from('customer')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (customer) {
        query = query.eq('customer_id', customer.id);
      } else {
        return NextResponse.json({
          success: true,
          data: { logs: [], pagination: { page, limit, total: 0 } },
        });
      }
    } else if (role === 'CONSULTANT_JTC' || role === 'TAX_ADVISOR_JTC') {
      // Consultants can see logs for their assigned customers
      if (customerId) {
        // Verify consultant has access to this customer
        const { data: consultant } = await supabaseAdmin
          .from('consultant')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (consultant) {
          const { data: assignment } = await supabaseAdmin
            .from('customer_consultant')
            .select('id')
            .eq('customer_id', customerId)
            .eq('consultant_id', consultant.id)
            .eq('is_active', true)
            .single();

          if (!assignment) {
            return NextResponse.json(
              { success: false, error: 'Access denied to this customer' },
              { status: 403 }
            );
          }

          query = query.eq('customer_id', customerId);
        }
      }
    }

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch audit logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: logs || [],
        pagination: {
          page,
          limit,
          total: count || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error in audit logs:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin // CRITICAL: Block platform admin from accessing audit logs
  )(request as RequestWithSession, handleGetLogs);
}
