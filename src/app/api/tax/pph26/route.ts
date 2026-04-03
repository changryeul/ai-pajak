import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { PPh26Calculator } from '@/lib/tax/pph26-calculator';
import type { PPh26Data } from '@/types';

/**
 * POST /api/tax/pph26 - Calculate PPh 26 (Non-Resident Withholding Tax)
 *
 * Body: PPh26Data | { transactions: PPh26Data[] }
 *
 * GET /api/tax/pph26?action=treaties - List all treaty countries
 * GET /api/tax/pph26?action=check&country=JP - Check treaty for a country
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
      const result = PPh26Calculator.calculateBulk(body.transactions as PPh26Data[]);
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // Single calculation
    const data = body as PPh26Data;
    if (!data.income_type || !data.gross_amount || !data.recipient_country) {
      return NextResponse.json(
        { error: 'income_type, gross_amount, and recipient_country are required' },
        { status: 400 }
      );
    }

    const result = PPh26Calculator.calculate(data);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    loggers.tax.error({ err: error }, 'PPh 26 calculation error');
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

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'treaties') {
      const countries = PPh26Calculator.getTreatyCountries();
      return NextResponse.json({
        success: true,
        data: {
          standardRate: 0.20,
          treatyCountries: countries,
          totalTreaties: countries.length,
        },
      });
    }

    if (action === 'check') {
      const country = searchParams.get('country');
      if (!country) {
        return NextResponse.json({ error: 'country parameter required' }, { status: 400 });
      }
      const hasTreaty = PPh26Calculator.hasTreaty(country);
      const rates = hasTreaty ? PPh26Calculator.getTreatyCountries().find(c => c.code === country.toUpperCase()) : null;

      return NextResponse.json({
        success: true,
        data: {
          country: country.toUpperCase(),
          hasTreaty,
          standardRate: 0.20,
          treatyRates: rates ? {
            dividend: rates.dividendRate,
            interest: rates.interestRate,
            royalty: rates.royaltyRate,
            service: rates.serviceRate,
          } : null,
          reference: rates?.reference,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use ?action=treaties or ?action=check&country=XX' }, { status: 400 });
  } catch (error) {
    loggers.tax.error({ err: error }, 'PPh 26 API error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
