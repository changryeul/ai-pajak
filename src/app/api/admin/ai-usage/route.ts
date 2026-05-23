import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// In-memory rate limit config (admin can modify at runtime)
const DEFAULT_LIMITS: Record<string, { maxRequests: number; windowMs: number; label: string }> = {
  chatbot: { maxRequests: 20, windowMs: 3600000, label: 'AI Chatbot' },
  ocr: { maxRequests: 10, windowMs: 3600000, label: 'OCR (Dokumen)' },
  report: { maxRequests: 5, windowMs: 86400000, label: 'Laporan AI' },
  savings: { maxRequests: 10, windowMs: 3600000, label: 'Analisis Pajak' },
  validation: { maxRequests: 20, windowMs: 3600000, label: 'Validasi SPT' },
  anomaly: { maxRequests: 10, windowMs: 3600000, label: 'Deteksi Anomali' },
  general: { maxRequests: 100, windowMs: 86400000, label: 'AI Umum' },
};

// Runtime config (modified by admin, stored in memory + DB)
const runtimeLimits: Record<string, { maxRequests: number; windowMs: number }> = {};

export function getRuntimeLimits() {
  return { ...DEFAULT_LIMITS, ...runtimeLimits };
}

async function checkAdmin(userId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin().from('user_roles').select('role').eq('user_id', userId).single();
  return data?.role === 'PLATFORM_ADMIN';
}

/**
 * GET /api/admin/ai-usage - Get rate limits config + usage stats
 * PUT /api/admin/ai-usage - Update rate limits
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !await checkAdmin(user.id)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const limits = getRuntimeLimits();

    // Estimate monthly cost based on limits
    // Assume average user makes 30% of limit
    const { data: users } = await getSupabaseAdmin().from('user_roles').select('user_id').eq('is_active', true);
    const activeUsers = users?.length || 0;

    const costPerCall: Record<string, number> = {
      chatbot: 0.01, ocr: 0.02, report: 0.015, savings: 0.008,
      validation: 0.005, anomaly: 0.005, general: 0.01,
    };

    const costEstimates = Object.entries(limits).map(([type, config]) => {
      const cost = costPerCall[type] || 0.01;
      const avgUsage = config.maxRequests * 0.3; // 30% utilization
      const window = config.windowMs <= 3600000 ? 'hour' : 'day';
      const callsPerDay = window === 'hour' ? avgUsage * 8 : avgUsage; // 8 active hours
      const monthlyCost = callsPerDay * 30 * activeUsers * cost;

      return {
        type,
        label: (DEFAULT_LIMITS[type] || {}).label || type,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        window,
        costPerCall: cost,
        estimatedMonthlyCost: Math.round(monthlyCost * 100) / 100,
      };
    });

    const totalMonthlyCost = costEstimates.reduce((s, e) => s + e.estimatedMonthlyCost, 0);

    // ── Actual usage from ai_usage_log ──
    const admin = getSupabaseAdmin();
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // This month totals
    const { data: monthlyUsage } = await admin
      .from('ai_usage_log')
      .select('feature, input_tokens, output_tokens, cost_usd, success')
      .gte('created_at', thisMonthStart);

    // Today totals
    const { data: todayUsage } = await admin
      .from('ai_usage_log')
      .select('feature, input_tokens, output_tokens, cost_usd')
      .gte('created_at', todayStart);

    // Aggregate by feature
    const actualByFeature: Record<string, { calls: number; tokens: number; cost: number; errors: number }> = {};
    for (const row of monthlyUsage || []) {
      const f = row.feature || 'unknown';
      if (!actualByFeature[f]) actualByFeature[f] = { calls: 0, tokens: 0, cost: 0, errors: 0 };
      actualByFeature[f].calls++;
      actualByFeature[f].tokens += (row.input_tokens || 0) + (row.output_tokens || 0);
      actualByFeature[f].cost += row.cost_usd || 0;
      if (!row.success) actualByFeature[f].errors++;
    }

    const actualMonthlyTotal = (monthlyUsage || []).reduce((s, r) => s + (r.cost_usd || 0), 0);
    const actualMonthlyTokens = (monthlyUsage || []).reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
    const actualMonthlyCalls = (monthlyUsage || []).length;

    const actualTodayTotal = (todayUsage || []).reduce((s, r) => s + (r.cost_usd || 0), 0);
    const actualTodayCalls = (todayUsage || []).length;

    return NextResponse.json({
      success: true,
      data: {
        limits: costEstimates,
        summary: {
          activeUsers,
          totalMonthlyCostEstimate: Math.round(totalMonthlyCost * 100) / 100,
          currency: 'USD',
        },
        actual: {
          monthly: {
            totalCost: Math.round(actualMonthlyTotal * 10000) / 10000,
            totalTokens: actualMonthlyTokens,
            totalCalls: actualMonthlyCalls,
            byFeature: actualByFeature,
          },
          today: {
            totalCost: Math.round(actualTodayTotal * 10000) / 10000,
            totalCalls: actualTodayCalls,
          },
        },
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !await checkAdmin(user.id)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await request.json();
    const { type, maxRequests, windowMs } = body;

    if (!type || !maxRequests) return NextResponse.json({ error: 'type and maxRequests required' }, { status: 400 });

    // Update runtime config
    runtimeLimits[type] = {
      maxRequests: parseInt(maxRequests),
      windowMs: windowMs ? parseInt(windowMs) : (DEFAULT_LIMITS[type]?.windowMs || 3600000),
    };

    return NextResponse.json({
      success: true,
      message: `${type} limit updated to ${maxRequests}`,
      data: { type, maxRequests: runtimeLimits[type].maxRequests, windowMs: runtimeLimits[type].windowMs },
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
