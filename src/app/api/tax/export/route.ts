import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { generateExcel, PPH23_COLUMNS, PPH26_COLUMNS, PPN_COLUMNS } from '@/lib/tax/export/excel-export';

/**
 * POST /api/tax/export
 * Body: { type: 'PPh23' | 'PPh26' | 'PPN', customerId, period }
 * Returns: Excel file
 */
async function handlePost(req: RequestWithSession): Promise<Response> {
  const body = await req.json();
  const { type, customerId, period } = body;

  if (!type || !customerId || !period) {
    return NextResponse.json({ error: 'type, customerId, period required' }, { status: 400 });
  }

  let rows: Record<string, unknown>[] = [];
  let columns;
  let sheetName: string;

  if (type === 'PPh23') {
    const { data } = await getSupabaseAdmin().from('pph23_transaction')
      .select('*').eq('customer_id', customerId).eq('tax_period', period).order('transaction_date');
    rows = (data || []).map(r => ({ ...r, tax_rate: `${(Number(r.tax_rate) * 100).toFixed(0)}%` }));
    columns = PPH23_COLUMNS;
    sheetName = `PPh23_${period}`;
  } else if (type === 'PPh26') {
    const { data } = await getSupabaseAdmin().from('pph26_transaction')
      .select('*').eq('customer_id', customerId).eq('tax_period', period).order('transaction_date');
    rows = (data || []).map(r => ({
      ...r,
      standard_rate: '20%',
      applied_rate: `${(Number(r.applied_rate) * 100).toFixed(1)}%`,
      treaty_applied: r.treaty_applied ? 'Yes' : 'No',
      has_cod: r.has_cod ? 'Yes' : 'No',
    }));
    columns = PPH26_COLUMNS;
    sheetName = `PPh26_${period}`;
  } else if (type === 'PPN') {
    const { data } = await getSupabaseAdmin().from('ppn_faktur_monthly')
      .select('*').eq('customer_id', customerId).eq('tax_period', period).order('faktur_date');
    rows = data || [];
    columns = PPN_COLUMNS;
    sheetName = `PPN_${period}`;
  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data for this period' }, { status: 404 });
  }

  const title = `${type} — Masa Pajak ${period}`;
  const buffer = generateExcel(sheetName, columns, rows, title);
  const filename = `${sheetName}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    },
  });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePost);
}
