import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

async function checkAdmin(userId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin().from('user_roles').select('role').eq('user_id', userId).single();
  return data?.role === 'PLATFORM_ADMIN';
}

/**
 * GET /api/admin/billing?view=overview|transactions|subscriptions|revenue
 * PUT /api/admin/billing - Update subscription plan, process refund
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !await checkAdmin(user.id)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const url = new URL(request.url);
    const view = url.searchParams.get('view') || 'overview';

    switch (view) {
      case 'overview': {
        // Get all billing transactions
        const { data: transactions } = await getSupabaseAdmin()
          .from('billing_transaction')
          .select('id, amount, currency, status, payment_method, description, created_at, customer_id')
          .order('created_at', { ascending: false });

        const txs = transactions || [];
        const paid = txs.filter(t => t.status === 'PAID');
        const pending = txs.filter(t => t.status === 'PENDING');
        const failed = txs.filter(t => t.status === 'FAILED');

        // Monthly revenue (last 12 months)
        const monthlyRevenue: Record<string, number> = {};
        for (const tx of paid) {
          const month = tx.created_at.slice(0, 7);
          monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (tx.amount || 0);
        }

        // Get subscriptions
        const { data: subs } = await getSupabaseAdmin()
          .from('subscription')
          .select('id, plan, status, customer_id, created_at')
          .order('created_at', { ascending: false });

        const activeSubs = (subs || []).filter(s => s.status === 'ACTIVE');
        const planCounts: Record<string, number> = {};
        for (const s of activeSubs) {
          planCounts[s.plan] = (planCounts[s.plan] || 0) + 1;
        }

        const totalRevenue = paid.reduce((s, t) => s + (t.amount || 0), 0);
        const mrr = totalRevenue / Math.max(1, Object.keys(monthlyRevenue).length);
        const arpu = activeSubs.length > 0 ? mrr / activeSubs.length : 0;

        return NextResponse.json({
          success: true,
          data: {
            overview: {
              totalRevenue,
              totalTransactions: txs.length,
              paidCount: paid.length,
              pendingCount: pending.length,
              failedCount: failed.length,
              pendingAmount: pending.reduce((s, t) => s + (t.amount || 0), 0),
              mrr: Math.round(mrr),
              arpu: Math.round(arpu),
              activeSubscriptions: activeSubs.length,
              planDistribution: planCounts,
            },
            monthlyRevenue: Object.entries(monthlyRevenue)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, amount]) => ({ month, amount })),
          },
        });
      }

      case 'transactions': {
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = 20;
        const status = url.searchParams.get('status');

        let query = getSupabaseAdmin()
          .from('billing_transaction')
          .select('*, customer:customer_id(full_name, email)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (status) query = query.eq('status', status);

        const { data, count } = await query;

        return NextResponse.json({
          success: true,
          data: {
            transactions: (data || []).map(t => {
              const cust = Array.isArray(t.customer) ? t.customer[0] : t.customer;
              return { ...t, customerName: cust?.full_name || '', customerEmail: cust?.email || '' };
            }),
            pagination: { page, limit, total: count || 0 },
          },
        });
      }

      case 'subscriptions': {
        const { data: subs } = await getSupabaseAdmin()
          .from('subscription')
          .select('*, customer:customer_id(full_name, email)')
          .order('created_at', { ascending: false });

        return NextResponse.json({
          success: true,
          data: {
            subscriptions: (subs || []).map(s => {
              const cust = Array.isArray(s.customer) ? s.customer[0] : s.customer;
              return { ...s, customerName: cust?.full_name || '', customerEmail: cust?.email || '' };
            }),
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
    }
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
    const { action } = body;

    switch (action) {
      case 'refund': {
        const { transactionId } = body;
        if (!transactionId) return NextResponse.json({ error: 'transactionId required' }, { status: 400 });
        const { error } = await getSupabaseAdmin()
          .from('billing_transaction')
          .update({ status: 'REFUNDED' })
          .eq('id', transactionId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, message: 'Refund processed' });
      }

      case 'update-plan': {
        const { subscriptionId, plan, status } = body;
        if (!subscriptionId) return NextResponse.json({ error: 'subscriptionId required' }, { status: 400 });
        const updateData: Record<string, unknown> = {};
        if (plan) updateData.plan = plan;
        if (status) updateData.status = status;
        const { error } = await getSupabaseAdmin().from('subscription').update(updateData).eq('id', subscriptionId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, message: 'Subscription updated' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
