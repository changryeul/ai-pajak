import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'];

async function getSupervisorUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const { data: roleData } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = roleData?.role;
  if (!SUPERVISOR_ROLES.includes(role)) {
    return { error: NextResponse.json({ error: 'Supervisor access required' }, { status: 403 }) };
  }

  return { user, role, admin };
}

/**
 * GET /api/operator/statistics
 *
 * Returns per-operator performance statistics.
 * Query params: period (daily|weekly|monthly), startDate, endDate, operatorId
 */
export async function GET(request: NextRequest) {
  const auth = await getSupervisorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { admin } = auth;

  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'monthly';
  const operatorId = url.searchParams.get('operatorId');

  // Calculate date range based on period
  const now = new Date();
  let startDate: string;
  const endDate = url.searchParams.get('endDate') || now.toISOString();

  if (url.searchParams.get('startDate')) {
    startDate = url.searchParams.get('startDate')!;
  } else {
    const start = new Date(now);
    if (period === 'daily') {
      start.setDate(start.getDate() - 1);
    } else if (period === 'weekly') {
      start.setDate(start.getDate() - 7);
    } else {
      start.setMonth(start.getMonth() - 1);
    }
    startDate = start.toISOString();
  }

  // 1. Get all operators
  const { data: operators } = await admin
    .from('tax_operators')
    .select('id, name, employee_id, status');

  if (!operators) {
    return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 });
  }

  // 2. Get completed/failed queue items in period
  let queueQuery = admin
    .from('djp_submission_queue')
    .select('operator_id, status, created_at, completed_at')
    .in('status', ['COMPLETED', 'FAILED'])
    .gte('updated_at', startDate)
    .lte('updated_at', endDate);

  if (operatorId) {
    queueQuery = queueQuery.eq('operator_id', operatorId);
  }

  const { data: queueItems } = await queueQuery;

  // 3. Get complaint counts per operator in period
  let complaintQuery = admin
    .from('customer_complaints')
    .select('operator_id')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (operatorId) {
    complaintQuery = complaintQuery.eq('operator_id', operatorId);
  }

  const { data: complaints } = await complaintQuery;

  // 4. Get reassignment counts per operator
  let reassignQuery = admin
    .from('queue_reassignment_history')
    .select('from_operator_id')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (operatorId) {
    reassignQuery = reassignQuery.eq('from_operator_id', operatorId);
  }

  const { data: reassignments } = await reassignQuery;

  // 5. Aggregate per operator
  const stats: Record<string, {
    completed: number;
    failed: number;
    totalProcessingMs: number;
    processedCount: number;
    complaintCount: number;
    reassignmentCount: number;
  }> = {};

  for (const op of operators) {
    stats[op.id] = {
      completed: 0,
      failed: 0,
      totalProcessingMs: 0,
      processedCount: 0,
      complaintCount: 0,
      reassignmentCount: 0,
    };
  }

  for (const item of queueItems || []) {
    if (!item.operator_id || !stats[item.operator_id]) continue;
    const s = stats[item.operator_id];
    if (item.status === 'COMPLETED') {
      s.completed++;
      if (item.created_at && item.completed_at) {
        const ms = new Date(item.completed_at).getTime() - new Date(item.created_at).getTime();
        s.totalProcessingMs += ms;
        s.processedCount++;
      }
    } else {
      s.failed++;
    }
  }

  for (const c of complaints || []) {
    if (c.operator_id && stats[c.operator_id]) {
      stats[c.operator_id].complaintCount++;
    }
  }

  for (const r of reassignments || []) {
    if (r.from_operator_id && stats[r.from_operator_id]) {
      stats[r.from_operator_id].reassignmentCount++;
    }
  }

  // 6. Build response with ranking
  const operatorStats = operators
    .map(op => {
      const s = stats[op.id];
      const total = s.completed + s.failed;
      const avgHours = s.processedCount > 0
        ? Math.round((s.totalProcessingMs / s.processedCount / 3600000) * 10) / 10
        : 0;
      const successRate = total > 0
        ? Math.round((s.completed / total) * 1000) / 10
        : 0;

      return {
        operator_id: op.id,
        operator_name: op.name,
        employee_id: op.employee_id,
        status: op.status,
        completed: s.completed,
        failed: s.failed,
        total: total,
        success_rate_pct: successRate,
        avg_processing_time_hours: avgHours,
        complaint_count: s.complaintCount,
        reassignment_count: s.reassignmentCount,
      };
    })
    .sort((a, b) => {
      // Sort by success rate desc, then by completed desc
      if (b.success_rate_pct !== a.success_rate_pct) return b.success_rate_pct - a.success_rate_pct;
      return b.completed - a.completed;
    })
    .map((op, index) => ({ ...op, rank: index + 1 }));

  // 7. Totals
  const totals = operatorStats.reduce(
    (acc, op) => ({
      completed: acc.completed + op.completed,
      failed: acc.failed + op.failed,
      total: acc.total + op.total,
      complaint_count: acc.complaint_count + op.complaint_count,
    }),
    { completed: 0, failed: 0, total: 0, complaint_count: 0 }
  );

  const totalProcessingMs = Object.values(stats).reduce((sum, s) => sum + s.totalProcessingMs, 0);
  const totalProcessedCount = Object.values(stats).reduce((sum, s) => sum + s.processedCount, 0);
  const avgProcessingHours = totalProcessedCount > 0
    ? Math.round((totalProcessingMs / totalProcessedCount / 3600000) * 10) / 10
    : 0;

  return NextResponse.json({
    success: true,
    data: {
      period,
      startDate,
      endDate,
      operators: operatorStats,
      totals: {
        ...totals,
        avg_processing_time_hours: avgProcessingHours,
      },
    },
  });
}
