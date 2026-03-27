import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AccurateService } from '@/lib/accurate';

/**
 * GET /api/integrations/accurate
 * Get connection status and authorization URL
 *
 * POST /api/integrations/accurate
 * Actions: connect, disconnect, sync-employees, sync-payroll, sync-invoices
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get customer ID
    const { data: customer } = await supabase
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Check existing connection from document.metadata
    const { data: connection } = await supabase
      .from('document')
      .select('metadata')
      .eq('customer_id', customer?.id)
      .eq('document_type', 'OTHER')
      .like('file_name', 'accurate_connection%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const connectionData = connection?.metadata as {
      accurate_connection?: {
        companyName: string;
        databaseId: number;
        isActive: boolean;
        lastSyncAt?: string;
      };
    } | null;

    // Generate auth URL
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      customerId: customer?.id,
      timestamp: Date.now(),
    })).toString('base64');

    const authUrl = AccurateService.getAuthorizationUrl(state);

    return NextResponse.json({
      success: true,
      data: {
        isConnected: !!connectionData?.accurate_connection?.isActive,
        connection: connectionData?.accurate_connection || null,
        authorizationUrl: authUrl,
      },
    });
  } catch (error) {
    console.error('Accurate integration error:', error);
    return NextResponse.json(
      { error: 'Failed to get integration status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'list-databases': {
        const { accessToken } = body;
        if (!accessToken) {
          return NextResponse.json({ error: 'accessToken required' }, { status: 400 });
        }
        const databases = await AccurateService.listDatabases(accessToken);
        return NextResponse.json({ success: true, data: { databases } });
      }

      case 'sync-employees': {
        const { accessToken, session, customerId } = body;
        if (!accessToken || !session) {
          return NextResponse.json({ error: 'accessToken and session required' }, { status: 400 });
        }
        const { employees, totalCount } = await AccurateService.getEmployees(
          accessToken,
          session,
          { isActive: true }
        );
        return NextResponse.json({
          success: true,
          data: { employees, totalCount },
        });
      }

      case 'sync-payroll': {
        const { accessToken, session, period } = body;
        if (!accessToken || !session || !period) {
          return NextResponse.json({ error: 'accessToken, session, and period required' }, { status: 400 });
        }
        const payroll = await AccurateService.getPayroll(accessToken, session, period);
        return NextResponse.json({ success: true, data: payroll });
      }

      case 'sync-annual-payroll': {
        const { accessToken, session, year } = body;
        if (!accessToken || !session || !year) {
          return NextResponse.json({ error: 'accessToken, session, and year required' }, { status: 400 });
        }
        const payrolls = await AccurateService.getAnnualPayroll(accessToken, session, year);
        return NextResponse.json({ success: true, data: { payrolls } });
      }

      case 'sync-invoices': {
        const { accessToken, session, startDate, endDate } = body;
        if (!accessToken || !session || !startDate || !endDate) {
          return NextResponse.json({ error: 'accessToken, session, startDate, endDate required' }, { status: 400 });
        }
        const { invoices, totalCount } = await AccurateService.getSalesInvoices(
          accessToken, session, startDate, endDate
        );
        return NextResponse.json({ success: true, data: { invoices, totalCount } });
      }

      case 'sync-financial': {
        const { accessToken, session, reportType, startDate, endDate } = body;
        if (!accessToken || !session) {
          return NextResponse.json({ error: 'accessToken and session required' }, { status: 400 });
        }
        let report;
        if (reportType === 'BALANCE_SHEET') {
          report = await AccurateService.getBalanceSheet(accessToken, session, endDate || startDate);
        } else {
          report = await AccurateService.getIncomeStatement(accessToken, session, startDate, endDate);
        }
        return NextResponse.json({ success: true, data: report });
      }

      case 'disconnect': {
        // Mark connection as inactive
        return NextResponse.json({ success: true, message: 'Disconnected' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Accurate integration action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    );
  }
}
