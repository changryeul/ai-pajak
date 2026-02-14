/**
 * Dashboard Statistics API
 *
 * GET /api/dashboard/stats
 *
 * Returns aggregated statistics for the dashboard based on user role:
 * - Consultant: Active clients, pending filings, submitted this month, pending POAs
 * - Customer: Filing summary, pending actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import type { RequestWithSession } from '@/types/auth';
import { UserRole } from '@/types/auth';

interface ConsultantStats {
  activeClients: number;
  pendingFilings: number;
  submittedThisMonth: number;
  pendingPOAs: number;
  recentActivity: {
    type: string;
    count: number;
  }[];
}

interface CustomerStats {
  totalFilings: number;
  pendingFilings: number;
  completedFilings: number;
  activePoA: boolean;
  upcomingDeadlines: number;
}

async function handleGetStats(request: RequestWithSession): Promise<Response> {
  const { session } = request;
  const { role, userId } = session;

  try {
    if (role === UserRole.CONSULTANT_JTC || role === UserRole.TAX_ADVISOR_JTC) {
      return NextResponse.json({
        success: true,
        data: await getConsultantStats(userId),
      });
    }

    if (role === UserRole.CUSTOMER) {
      // Get customer ID
      const { data: customer } = await getSupabaseAdmin()
        .from('customer')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (customer) {
        return NextResponse.json({
          success: true,
          data: await getCustomerStats(customer.id),
        });
      }
    }

    if (role === UserRole.PLATFORM_ADMIN) {
      return NextResponse.json({
        success: true,
        data: await getPlatformStats(),
      });
    }

    return NextResponse.json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error('[DASHBOARD_STATS] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

async function getConsultantStats(userId: string): Promise<ConsultantStats> {
  // Get consultant ID
  const { data: consultant } = await getSupabaseAdmin()
    .from('consultant')
    .select('id, tax_partner_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!consultant) {
    return {
      activeClients: 0,
      pendingFilings: 0,
      submittedThisMonth: 0,
      pendingPOAs: 0,
      recentActivity: [],
    };
  }

  // Get active clients count
  const { count: activeClients } = await getSupabaseAdmin()
    .from('customer')
    .select('*', { count: 'exact', head: true });

  // Get pending filings count (DRAFT or UNDER_REVIEW)
  const { count: pendingFilings } = await getSupabaseAdmin()
    .from('tax_filing')
    .select('*', { count: 'exact', head: true })
    .eq('consultant_id', consultant.id)
    .in('status', ['DRAFT', 'UNDER_REVIEW']);

  // Get submitted this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: submittedThisMonth } = await getSupabaseAdmin()
    .from('tax_filing')
    .select('*', { count: 'exact', head: true })
    .eq('consultant_id', consultant.id)
    .eq('status', 'FILED')
    .gte('filed_at', startOfMonth.toISOString());

  // Get pending POAs
  const { count: pendingPOAs } = await getSupabaseAdmin()
    .from('power_of_attorney')
    .select('*', { count: 'exact', head: true })
    .eq('tax_partner_id', consultant.tax_partner_id)
    .in('status', ['DRAFT', 'PENDING_SIGNATURE']);

  // Get recent activity breakdown
  const { data: recentFilings } = await getSupabaseAdmin()
    .from('tax_filing')
    .select('status')
    .eq('consultant_id', consultant.id)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const activityCounts: Record<string, number> = {};
  recentFilings?.forEach((f) => {
    activityCounts[f.status] = (activityCounts[f.status] || 0) + 1;
  });

  const recentActivity = Object.entries(activityCounts).map(([type, count]) => ({
    type,
    count,
  }));

  return {
    activeClients: activeClients || 0,
    pendingFilings: pendingFilings || 0,
    submittedThisMonth: submittedThisMonth || 0,
    pendingPOAs: pendingPOAs || 0,
    recentActivity,
  };
}

async function getCustomerStats(customerId: string): Promise<CustomerStats> {
  // Get filing counts
  const { data: filings } = await getSupabaseAdmin()
    .from('tax_filing')
    .select('status')
    .eq('customer_id', customerId);

  const totalFilings = filings?.length || 0;
  const pendingFilings = filings?.filter((f) => f.status === 'DRAFT' || f.status === 'UNDER_REVIEW').length || 0;
  const completedFilings = filings?.filter((f) => f.status === 'FILED').length || 0;

  // Check for active POA
  const { data: activePoa } = await getSupabaseAdmin()
    .from('power_of_attorney')
    .select('id')
    .eq('customer_id', customerId)
    .eq('status', 'ACTIVE')
    .gte('valid_to', new Date().toISOString().split('T')[0])
    .limit(1)
    .single();

  // Count upcoming deadlines (within 30 days)
  // This would need a deadlines table or calculation logic
  const upcomingDeadlines = 0; // Placeholder

  return {
    totalFilings,
    pendingFilings,
    completedFilings,
    activePoA: !!activePoa,
    upcomingDeadlines,
  };
}

async function getPlatformStats() {
  // Platform-level anonymized stats
  const { count: totalUsers } = await getSupabaseAdmin()
    .from('user_roles')
    .select('*', { count: 'exact', head: true });

  const { count: totalCustomers } = await getSupabaseAdmin()
    .from('customer')
    .select('*', { count: 'exact', head: true });

  const { count: totalFilings } = await getSupabaseAdmin()
    .from('tax_filing')
    .select('*', { count: 'exact', head: true });

  const { count: activeConsultants } = await getSupabaseAdmin()
    .from('consultant')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  // Get monthly filing trend (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: monthlyFilings } = await getSupabaseAdmin()
    .from('tax_filing')
    .select('created_at')
    .gte('created_at', sixMonthsAgo.toISOString());

  const monthlyTrend: Record<string, number> = {};
  monthlyFilings?.forEach((f) => {
    const month = f.created_at.substring(0, 7); // YYYY-MM
    monthlyTrend[month] = (monthlyTrend[month] || 0) + 1;
  });

  return {
    totalUsers: totalUsers || 0,
    totalCustomers: totalCustomers || 0,
    totalFilings: totalFilings || 0,
    activeConsultants: activeConsultants || 0,
    monthlyTrend: Object.entries(monthlyTrend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count })),
  };
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth)(
    request as RequestWithSession,
    handleGetStats
  );
}
