import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/tax/regional
 *
 * Calculate regional taxes (Pajak Daerah):
 * - PBB (Pajak Bumi dan Bangunan)
 * - BPHTB (Bea Perolehan Hak atas Tanah dan Bangunan)
 * - Pajak Reklame
 * - Pajak Restoran
 * - Pajak Hotel
 * - Pajak Parkir
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { taxType } = body;

    switch (taxType) {
      case 'PBB': {
        const { njop, njoptkp = 12_000_000, njkpRate = 0.20 } = body;
        if (!njop) return NextResponse.json({ error: 'njop required' }, { status: 400 });
        const njopKena = Math.max(0, njop - njoptkp);
        const njkp = njopKena * njkpRate;
        const pbb = Math.round(njkp * 0.005); // 0.5%
        return NextResponse.json({
          success: true, data: { taxType: 'PBB', njop, njoptkp, njopKena, njkp, pbb,
            formula: 'PBB = 0.5% x NJKP, NJKP = 20% x (NJOP - NJOPTKP)',
            legalBasis: 'UU No. 1/2022 tentang HKPD' }
        });
      }

      case 'BPHTB': {
        const { transactionValue, npoptkp = 80_000_000 } = body;
        if (!transactionValue) return NextResponse.json({ error: 'transactionValue required' }, { status: 400 });
        const npopKena = Math.max(0, transactionValue - npoptkp);
        const bphtb = Math.round(npopKena * 0.05); // 5%
        return NextResponse.json({
          success: true, data: { taxType: 'BPHTB', transactionValue, npoptkp, npopKena, bphtb,
            formula: 'BPHTB = 5% x (NPOP - NPOPTKP)',
            legalBasis: 'UU No. 1/2022 tentang HKPD' }
        });
      }

      case 'RESTAURANT': {
        const { revenue } = body;
        if (!revenue) return NextResponse.json({ error: 'revenue required' }, { status: 400 });
        const tax = Math.round(revenue * 0.10); // 10%
        return NextResponse.json({
          success: true, data: { taxType: 'RESTAURANT', revenue, taxRate: 0.10, tax,
            legalBasis: 'UU No. 1/2022 - Pajak Barang dan Jasa Tertentu' }
        });
      }

      case 'HOTEL': {
        const { revenue } = body;
        if (!revenue) return NextResponse.json({ error: 'revenue required' }, { status: 400 });
        const tax = Math.round(revenue * 0.10);
        return NextResponse.json({
          success: true, data: { taxType: 'HOTEL', revenue, taxRate: 0.10, tax,
            legalBasis: 'UU No. 1/2022 - PBJT' }
        });
      }

      case 'PARKING': {
        const { revenue } = body;
        if (!revenue) return NextResponse.json({ error: 'revenue required' }, { status: 400 });
        const tax = Math.round(revenue * 0.10);
        return NextResponse.json({
          success: true, data: { taxType: 'PARKING', revenue, taxRate: 0.10, tax,
            legalBasis: 'UU No. 1/2022 - PBJT' }
        });
      }

      case 'ADVERTISEMENT': {
        const { value, durationDays = 30 } = body;
        if (!value) return NextResponse.json({ error: 'value required' }, { status: 400 });
        const tax = Math.round(value * 0.25); // max 25%
        return NextResponse.json({
          success: true, data: { taxType: 'ADVERTISEMENT', value, durationDays, taxRate: 0.25, tax,
            legalBasis: 'UU No. 1/2022 - Pajak Reklame (maks 25%)' }
        });
      }

      default:
        return NextResponse.json({
          error: 'Unknown taxType',
          validTypes: ['PBB', 'BPHTB', 'RESTAURANT', 'HOTEL', 'PARKING', 'ADVERTISEMENT'],
        }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Calculation failed' }, { status: 500 });
  }
}
