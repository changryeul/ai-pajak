import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BankingService } from '@/lib/banking';

/**
 * GET /api/integrations/banking
 * Get bank connection status
 *
 * POST /api/integrations/banking
 * Actions: get-widget-token, exchange-token, get-accounts,
 *          get-transactions, get-monthly-summary, get-annual-summary
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Check for stored bank connections in document metadata
    const { data: connections } = await supabase
      .from('document')
      .select('metadata, created_at')
      .eq('customer_id', customer?.id)
      .eq('document_type', 'OTHER')
      .like('file_name', 'bank_connection%')
      .order('created_at', { ascending: false });

    const bankConnections = (connections || [])
      .map(c => (c.metadata as Record<string, unknown>)?.bank_connection)
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      data: {
        connections: bankConnections,
        hasConnection: bankConnections.length > 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get banking status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'get-widget-token': {
        const result = await BankingService.getWidgetToken(customer?.id || user.id);
        return NextResponse.json({ success: true, data: result });
      }

      case 'exchange-token': {
        const { publicToken } = body;
        if (!publicToken) {
          return NextResponse.json({ error: 'publicToken required' }, { status: 400 });
        }
        const result = await BankingService.exchangeToken(publicToken);
        return NextResponse.json({ success: true, data: result });
      }

      case 'get-accounts': {
        const { accessToken } = body;
        if (!accessToken) {
          return NextResponse.json({ error: 'accessToken required' }, { status: 400 });
        }
        const accounts = await BankingService.getAccounts(accessToken);
        return NextResponse.json({ success: true, data: { accounts } });
      }

      case 'get-transactions': {
        const { accessToken, startDate, endDate } = body;
        if (!accessToken || !startDate || !endDate) {
          return NextResponse.json({ error: 'accessToken, startDate, endDate required' }, { status: 400 });
        }
        const transactions = await BankingService.getTransactions(accessToken, startDate, endDate);
        return NextResponse.json({ success: true, data: { transactions } });
      }

      case 'get-monthly-summary': {
        const { accessToken, period, accountInfo } = body;
        if (!accessToken || !period) {
          return NextResponse.json({ error: 'accessToken and period required' }, { status: 400 });
        }
        const statement = await BankingService.getMonthlyStatement(
          accessToken, period, accountInfo || { accountNumber: '', accountName: '', provider: 'OTHER' }
        );
        const summary = BankingService.calculateMonthlyRevenue(statement);
        return NextResponse.json({ success: true, data: { statement, summary } });
      }

      case 'get-annual-summary': {
        const { monthlySummaries, year } = body;
        if (!monthlySummaries || !year) {
          return NextResponse.json({ error: 'monthlySummaries and year required' }, { status: 400 });
        }
        const annual = BankingService.calculateAnnualRevenue(monthlySummaries, year);
        return NextResponse.json({ success: true, data: annual });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Banking integration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Banking operation failed' },
      { status: 500 }
    );
  }
}
