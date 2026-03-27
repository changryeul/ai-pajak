import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/tax/customs
 *
 * Calculate customs duty and import taxes (Bea Masuk, PPN Impor, PPh 22 Impor).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      cifValue,        // Cost + Insurance + Freight (USD)
      exchangeRate,    // USD to IDR
      hsCode,          // Harmonized System code
      dutyRate = 0.10, // Bea Masuk rate (default 10%)
      quantity = 1,
      isLuxury = false,
      luxuryRate = 0,  // PPnBM rate
    } = body;

    if (!cifValue || !exchangeRate) {
      return NextResponse.json({ error: 'cifValue and exchangeRate required' }, { status: 400 });
    }

    const cifIDR = cifValue * exchangeRate * quantity;

    // Bea Masuk (Import Duty)
    const beaMasuk = Math.round(cifIDR * dutyRate);

    // Nilai Impor (Customs Value)
    const nilaiImpor = cifIDR + beaMasuk;

    // PPN Impor (11%)
    const ppnImpor = Math.round(nilaiImpor * 0.11);

    // PPh 22 Impor (2.5% with NPWP, 7.5% without)
    const pph22WithNpwp = Math.round(nilaiImpor * 0.025);
    const pph22WithoutNpwp = Math.round(nilaiImpor * 0.075);

    // PPnBM (Luxury goods tax)
    const ppnbm = isLuxury ? Math.round(nilaiImpor * luxuryRate) : 0;

    // Total
    const totalWithNpwp = beaMasuk + ppnImpor + pph22WithNpwp + ppnbm;
    const totalWithoutNpwp = beaMasuk + ppnImpor + pph22WithoutNpwp + ppnbm;

    return NextResponse.json({
      success: true,
      data: {
        input: { cifValue, exchangeRate, hsCode, dutyRate, quantity, isLuxury, luxuryRate },
        calculation: {
          cifIDR,
          beaMasuk,
          nilaiImpor,
          ppnImpor,
          pph22: { withNpwp: pph22WithNpwp, withoutNpwp: pph22WithoutNpwp },
          ppnbm,
          total: { withNpwp: totalWithNpwp, withoutNpwp: totalWithoutNpwp },
        },
        notes: [
          'Bea Masuk dihitung dari CIF x tarif bea masuk',
          'PPN Impor = 11% x Nilai Impor (CIF + Bea Masuk)',
          'PPh 22 Impor = 2.5% (dengan NPWP) atau 7.5% (tanpa NPWP)',
          isLuxury ? `PPnBM = ${(luxuryRate * 100)}% untuk barang mewah` : null,
        ].filter(Boolean),
        legalBasis: 'PMK 199/PMK.010/2019, UU No. 7/2021 (HPP)',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Customs calculation failed' }, { status: 500 });
  }
}
