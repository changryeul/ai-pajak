import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { JurnalService } from '@/lib/jurnal';

/**
 * GET /api/integrations/jurnal - Connection status + auth URL
 * POST /api/integrations/jurnal - Actions: get-company, get-accounts, get-invoices, get-reports
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const state = Buffer.from(JSON.stringify({ userId: user.id, t: Date.now() })).toString('base64');
    const authUrl = JurnalService.getAuthorizationUrl(state);

    return NextResponse.json({
      success: true,
      data: { isConnected: false, authorizationUrl: authUrl },
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, accessToken } = body;

    if (!accessToken) return NextResponse.json({ error: 'accessToken required' }, { status: 400 });

    switch (action) {
      case 'get-company': {
        const company = await JurnalService.getCompanyInfo(accessToken);
        return NextResponse.json({ success: true, data: company });
      }
      case 'get-accounts': {
        const accounts = await JurnalService.getAccounts(accessToken);
        return NextResponse.json({ success: true, data: { accounts } });
      }
      case 'get-contacts': {
        const contacts = await JurnalService.getContacts(accessToken, body.type);
        return NextResponse.json({ success: true, data: { contacts } });
      }
      case 'get-invoices': {
        const invoices = await JurnalService.getSalesInvoices(accessToken, body.startDate, body.endDate);
        return NextResponse.json({ success: true, data: { invoices } });
      }
      case 'get-profit-loss': {
        const report = await JurnalService.getProfitLoss(accessToken, body.startDate, body.endDate);
        return NextResponse.json({ success: true, data: report });
      }
      case 'get-balance-sheet': {
        const report = await JurnalService.getBalanceSheet(accessToken, body.asOfDate);
        return NextResponse.json({ success: true, data: report });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
