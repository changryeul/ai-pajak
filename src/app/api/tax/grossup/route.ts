import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GrossUpCalculator } from '@/lib/tax/grossup-calculator';

/**
 * POST /api/tax/grossup
 *
 * Calculate gross amount from desired net amount (employer bears tax).
 *
 * Body types:
 * 1. PPh 21: { type: 'pph21', netAnnualIncome, ptkpCategory, hasNpwp?, annualDeductions? }
 * 2. PPh 23: { type: 'pph23', netAmount, transactionType, hasNpwp? }
 * 3. PPh 26: { type: 'pph26', netAmount, recipientCountry, incomeType?, applyTreaty? }
 * 4. Flat:   { type: 'flat', netAmount, taxRate }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'type is required (pph21, pph23, pph26, flat)' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'pph21': {
        const { netAnnualIncome, ptkpCategory, hasNpwp, annualDeductions } = body;
        if (!netAnnualIncome || !ptkpCategory) {
          return NextResponse.json(
            { error: 'netAnnualIncome and ptkpCategory required for PPh 21 gross-up' },
            { status: 400 }
          );
        }
        result = GrossUpCalculator.grossUpPPh21({
          netAnnualIncome,
          ptkpCategory,
          hasNpwp,
          annualDeductions,
        });
        break;
      }

      case 'pph23': {
        const { netAmount, transactionType, hasNpwp: hasNpwp23 } = body;
        if (!netAmount || !transactionType) {
          return NextResponse.json(
            { error: 'netAmount and transactionType required for PPh 23 gross-up' },
            { status: 400 }
          );
        }
        result = GrossUpCalculator.grossUpPPh23(netAmount, transactionType, hasNpwp23 ?? true);
        break;
      }

      case 'pph26': {
        const { netAmount: net26, recipientCountry, incomeType, applyTreaty } = body;
        if (!net26 || !recipientCountry) {
          return NextResponse.json(
            { error: 'netAmount and recipientCountry required for PPh 26 gross-up' },
            { status: 400 }
          );
        }
        result = GrossUpCalculator.grossUpPPh26(net26, recipientCountry, incomeType, applyTreaty);
        break;
      }

      case 'flat': {
        const { netAmount: netFlat, taxRate } = body;
        if (!netFlat || taxRate == null) {
          return NextResponse.json(
            { error: 'netAmount and taxRate required for flat gross-up' },
            { status: 400 }
          );
        }
        result = GrossUpCalculator.grossUpFlat({ netAmount: netFlat, taxRate });
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown type: ${type}. Use pph21, pph23, pph26, or flat` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Gross-up calculation error:', error);
    return NextResponse.json(
      { error: 'Calculation failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
