import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'];

/**
 * GET /api/operator/queue/realtime-stats
 *
 * Real-time queue statistics for operator dashboard.
 * Returns status distribution, hourly throughput, aging metrics.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: allRoles } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const role = allRoles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });

  // 1. Status distribution
  const { data: allItems } = await admin
    .from('djp_submission_queue')
    .select('status, created_at, updated_at, auto_approved');

  const statusCounts: Record<string, number> = {};
  let autoApprovedCount = 0;
  let totalProcessed = 0;

  for (const item of allItems || []) {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    if (item.auto_approved) autoApprovedCount++;
    if (['COMPLETED', 'FAILED'].includes(item.status)) totalProcessed++;
  }

  const autoApprovalRate = totalProcessed > 0
    ? Math.round((autoApprovedCount / totalProcessed) * 100)
    : 0;

  // 2. Hourly throughput (last 24h, completed items)
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data: completedRecent } = await admin
    .from('djp_submission_queue')
    .select('completed_at')
    .eq('status', 'COMPLETED')
    .gte('completed_at', oneDayAgo.toISOString())
    .order('completed_at', { ascending: true });

  // Build hourly buckets
  const hourlyThroughput: Array<{ hour: string; count: number }> = [];
  for (let i = 23; i >= 0; i--) {
    const bucketStart = new Date(now.getTime() - i * 60 * 60 * 1000);
    const bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000);
    const count = (completedRecent || []).filter(item => {
      const t = new Date(item.completed_at);
      return t >= bucketStart && t < bucketEnd;
    }).length;
    hourlyThroughput.push({
      hour: bucketStart.toISOString().slice(11, 16), // HH:MM
      count,
    });
  }

  // 3. Queue aging (oldest pending items)
  const { data: oldestPending } = await admin
    .from('djp_submission_queue')
    .select('id, status, created_at, tax_type, customer_id')
    .not('status', 'in', '("COMPLETED","FAILED")')
    .order('created_at', { ascending: true })
    .limit(5);

  const agingItems = (oldestPending || []).map(item => {
    const ageMs = now.getTime() - new Date(item.created_at).getTime();
    const ageHours = Math.round(ageMs / 3600000 * 10) / 10;
    return {
      id: item.id,
      status: item.status,
      taxType: item.tax_type,
      ageHours,
      createdAt: item.created_at,
      slaWarning: ageHours > 48, // 48시간 초과 SLA 경고
    };
  });

  // 4. Average processing time (completed items this month)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const { data: monthCompleted } = await admin
    .from('djp_submission_queue')
    .select('created_at, completed_at')
    .eq('status', 'COMPLETED')
    .gte('completed_at', monthStart.toISOString());

  let avgProcessingHours = 0;
  if (monthCompleted && monthCompleted.length > 0) {
    const totalMs = monthCompleted.reduce((sum, item) => {
      if (item.created_at && item.completed_at) {
        return sum + (new Date(item.completed_at).getTime() - new Date(item.created_at).getTime());
      }
      return sum;
    }, 0);
    avgProcessingHours = Math.round((totalMs / monthCompleted.length / 3600000) * 10) / 10;
  }

  return NextResponse.json({
    success: true,
    data: {
      statusDistribution: statusCounts,
      hourlyThroughput,
      agingItems,
      metrics: {
        totalItems: (allItems || []).length,
        activeItems: (allItems || []).filter(i => !['COMPLETED', 'FAILED'].includes(i.status)).length,
        completedToday: hourlyThroughput.reduce((sum, h) => sum + h.count, 0),
        avgProcessingHours,
        autoApprovalRate,
        autoApprovedCount,
        slaBreaches: agingItems.filter(i => i.slaWarning).length,
      },
      updatedAt: now.toISOString(),
    },
  });
}
