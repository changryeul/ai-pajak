import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MONTHLY_TAX_DEADLINES, lastDayOfMonth } from '@/lib/tax/shared/constants';

/**
 * GET /api/tax/calendar?year=2026
 *
 * Get tax calendar with all deadlines for the year.
 * Includes PPh 21/23 monthly, PPN monthly, SPT Tahunan annual.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString());

    const events = generateTaxCalendar(year);

    return NextResponse.json({ success: true, data: { year, events } });
  } catch {
    return NextResponse.json({ error: 'Failed to get calendar' }, { status: 500 });
  }
}

interface TaxEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  taxType: string;
  isAnnual: boolean;
  penalty: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

function generateTaxCalendar(year: number): TaxEvent[] {
  const events: TaxEvent[] = [];

  // Monthly deadlines — Coretax / PMK 81/2024 (all PPh payments = 15th, SPT Masa = 20th)
  for (let month = 1; month <= 12; month++) {
    const prevMonth = month === 1 ? 'Desember' : new Date(year, month - 2).toLocaleString('id-ID', { month: 'long' });
    const mm = String(month).padStart(2, '0');

    // ── Payment deadlines (15th) ──

    // PPh 21 payment
    events.push({
      id: `pph21-pay-${month}`,
      date: `${year}-${mm}-${String(MONTHLY_TAX_DEADLINES.PPH21_PAYMENT).padStart(2, '0')}`,
      title: `Setor PPh 21 - ${prevMonth}`,
      description: `Batas setor PPh 21 masa ${prevMonth} ${month === 1 ? year - 1 : year} (Coretax: tanggal 15)`,
      taxType: 'PPh 21',
      isAnnual: false,
      penalty: 'Bunga per bulan (MRSB + 5%/12)',
      priority: 'HIGH',
    });

    // PPh 23 payment
    events.push({
      id: `pph23-pay-${month}`,
      date: `${year}-${mm}-${String(MONTHLY_TAX_DEADLINES.PPH23_PAYMENT).padStart(2, '0')}`,
      title: `Setor PPh 23 - ${prevMonth}`,
      description: `Batas setor PPh 23 masa ${prevMonth} (Coretax: tanggal 15)`,
      taxType: 'PPh 23',
      isAnnual: false,
      penalty: 'Bunga per bulan',
      priority: 'HIGH',
    });

    // PPh 4(2) Final payment
    events.push({
      id: `pph42-pay-${month}`,
      date: `${year}-${mm}-${String(MONTHLY_TAX_DEADLINES.PPH4_2_PAYMENT).padStart(2, '0')}`,
      title: `Setor PPh 4(2) Final - ${prevMonth}`,
      description: `Batas setor PPh 4(2) Final (sewa/konstruksi/dll) masa ${prevMonth}`,
      taxType: 'PPh 4(2)',
      isAnnual: false,
      penalty: 'Bunga per bulan',
      priority: 'HIGH',
    });

    // PPh 25 installment payment
    events.push({
      id: `pph25-pay-${month}`,
      date: `${year}-${mm}-${String(MONTHLY_TAX_DEADLINES.PPH25_PAYMENT).padStart(2, '0')}`,
      title: `Setor Angsuran PPh 25 - ${prevMonth}`,
      description: `Batas setor angsuran PPh 25 bulan ${prevMonth}`,
      taxType: 'PPh 25',
      isAnnual: false,
      penalty: 'Bunga per bulan',
      priority: 'MEDIUM',
    });

    // PPh 26 payment
    events.push({
      id: `pph26-pay-${month}`,
      date: `${year}-${mm}-${String(MONTHLY_TAX_DEADLINES.PPH26_PAYMENT).padStart(2, '0')}`,
      title: `Setor PPh 26 - ${prevMonth}`,
      description: `Batas setor PPh 26 (pembayaran ke non-resident) masa ${prevMonth}`,
      taxType: 'PPh 26',
      isAnnual: false,
      penalty: 'Bunga per bulan',
      priority: 'HIGH',
    });

    // PPh Final UMKM payment
    events.push({
      id: `pph-final-umkm-${month}`,
      date: `${year}-${mm}-${String(MONTHLY_TAX_DEADLINES.PPH_FINAL_UMKM_PAYMENT).padStart(2, '0')}`,
      title: `Setor PPh Final UMKM - ${prevMonth}`,
      description: `Batas setor PPh Final 0.5% masa ${prevMonth}`,
      taxType: 'PPh Final UMKM',
      isAnnual: false,
      penalty: 'Bunga per bulan',
      priority: 'MEDIUM',
    });

    // PPN payment — end of following month (NOT 15th; PPN has its own rule under PMK 81/2024)
    const ppnLastDay = lastDayOfMonth(year, month);
    events.push({
      id: `ppn-pay-${month}`,
      date: `${year}-${mm}-${String(ppnLastDay).padStart(2, '0')}`,
      title: `Setor PPN - ${prevMonth}`,
      description: `Batas setor PPN masa ${prevMonth} — akhir bulan berikutnya, sebelum lapor SPT Masa PPN`,
      taxType: 'PPN',
      isAnnual: false,
      penalty: 'Bunga per bulan',
      priority: 'HIGH',
    });

    // ── Filing deadlines (20th for most PPh, end of month for PPN) ──

    // SPT Masa PPh 21
    events.push({
      id: `spt-masa-pph21-${month}`,
      date: `${year}-${mm}-${String(MONTHLY_TAX_DEADLINES.PPH21_FILING).padStart(2, '0')}`,
      title: `Lapor SPT Masa PPh 21 - ${prevMonth}`,
      description: `Batas lapor SPT Masa PPh 21 masa ${prevMonth} (Coretax: tanggal 20)`,
      taxType: 'SPT Masa PPh 21',
      isAnnual: false,
      penalty: 'Denda Rp 100.000',
      priority: 'MEDIUM',
    });

    // SPT Masa PPh 23/26
    events.push({
      id: `spt-masa-pph23-${month}`,
      date: `${year}-${mm}-${String(MONTHLY_TAX_DEADLINES.PPH23_FILING).padStart(2, '0')}`,
      title: `Lapor SPT Masa PPh 23/26 - ${prevMonth}`,
      description: `Batas lapor SPT Masa PPh 23/26 masa ${prevMonth}`,
      taxType: 'SPT Masa PPh 23/26',
      isAnnual: false,
      penalty: 'Denda Rp 100.000',
      priority: 'MEDIUM',
    });

    // SPT Masa PPh 4(2)
    events.push({
      id: `spt-masa-pph42-${month}`,
      date: `${year}-${mm}-${String(MONTHLY_TAX_DEADLINES.PPH4_2_FILING).padStart(2, '0')}`,
      title: `Lapor SPT Masa PPh 4(2) - ${prevMonth}`,
      description: `Batas lapor SPT Masa PPh 4(2) Final masa ${prevMonth}`,
      taxType: 'SPT Masa PPh 4(2)',
      isAnnual: false,
      penalty: 'Denda Rp 100.000',
      priority: 'MEDIUM',
    });

    // SPT Masa PPN — end of following month (unchanged by PMK 81/2024)
    const lastDay = lastDayOfMonth(year, month);
    events.push({
      id: `spt-masa-ppn-${month}`,
      date: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      title: `Lapor SPT Masa PPN - ${prevMonth}`,
      description: `Batas lapor SPT Masa PPN masa ${prevMonth} (akhir bulan berikutnya)`,
      taxType: 'SPT Masa PPN',
      isAnnual: false,
      penalty: 'Denda Rp 500.000',
      priority: 'HIGH',
    });
  }

  // Annual deadlines
  events.push({
    id: `spt-tahunan-op-${year}`,
    date: `${year}-03-31`,
    title: 'SPT Tahunan Orang Pribadi',
    description: `Batas pelaporan SPT Tahunan PPh OP tahun pajak ${year - 1}`,
    taxType: 'SPT Tahunan OP',
    isAnnual: true,
    penalty: 'Denda Rp 100.000',
    priority: 'HIGH',
  });

  events.push({
    id: `spt-tahunan-badan-${year}`,
    date: `${year}-04-30`,
    title: 'SPT Tahunan Badan',
    description: `Batas pelaporan SPT Tahunan PPh Badan tahun pajak ${year - 1}`,
    taxType: 'SPT Tahunan Badan',
    isAnnual: true,
    penalty: 'Denda Rp 1.000.000',
    priority: 'HIGH',
  });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
