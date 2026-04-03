import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { PPh22Calculator } from '@/lib/tax/pph22-calculator';
import type { PPh22Data } from '@/types';

/**
 * POST /api/tax/pph22 - Calculate PPh 22 (Domestic Transaction Withholding)
 * GET  /api/tax/pph22 - List all PPh 22 transaction types and rates
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Bulk calculation
    if (body.transactions && Array.isArray(body.transactions)) {
      const result = PPh22Calculator.calculateBulk(body.transactions as PPh22Data[]);
      return NextResponse.json({ success: true, data: result });
    }

    // Single calculation
    const data = body as PPh22Data;
    if (!data.transaction_type || !data.gross_amount) {
      return NextResponse.json(
        { error: 'transaction_type and gross_amount are required' },
        { status: 400 }
      );
    }

    const result = PPh22Calculator.calculate(data);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    loggers.tax.error({ err: error }, 'PPh 22 calculation error');
    return NextResponse.json(
      { error: 'Calculation failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const types = PPh22Calculator.getTransactionTypes();
    return NextResponse.json({
      success: true,
      data: { transactionTypes: types, totalTypes: types.length },
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
