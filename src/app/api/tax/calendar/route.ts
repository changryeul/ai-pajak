import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  // Monthly deadlines
  for (let month = 1; month <= 12; month++) {
    const monthName = new Date(year, month - 1).toLocaleString('id-ID', { month: 'long' });
    const prevMonth = month === 1 ? 'Desember' : new Date(year, month - 2).toLocaleString('id-ID', { month: 'long' });

    // PPh 21/23 - 10th of following month
    events.push({
      id: `pph21-${month}`,
      date: `${year}-${String(month).padStart(2, '0')}-10`,
      title: `Setor PPh 21/23 - ${prevMonth}`,
      description: `Batas setor PPh 21/23 masa ${prevMonth} ${month === 1 ? year - 1 : year}`,
      taxType: 'PPh 21/23',
      isAnnual: false,
      penalty: 'Bunga 2%/bulan',
      priority: 'HIGH',
    });

    // PPh 21/23 SPT Masa - 20th
    events.push({
      id: `spt-masa-pph-${month}`,
      date: `${year}-${String(month).padStart(2, '0')}-20`,
      title: `Lapor SPT Masa PPh 21/23 - ${prevMonth}`,
      description: `Batas lapor SPT Masa PPh 21/23 masa ${prevMonth}`,
      taxType: 'SPT Masa PPh',
      isAnnual: false,
      penalty: 'Denda Rp 100.000',
      priority: 'MEDIUM',
    });

    // PPN - End of following month
    const lastDay = new Date(year, month, 0).getDate();
    events.push({
      id: `ppn-${month}`,
      date: `${year}-${String(month).padStart(2, '0')}-${lastDay}`,
      title: `Setor & Lapor PPN - ${prevMonth}`,
      description: `Batas setor dan lapor SPT Masa PPN masa ${prevMonth}`,
      taxType: 'PPN',
      isAnnual: false,
      penalty: 'Denda Rp 500.000 + bunga 2%',
      priority: 'HIGH',
    });

    // PPh Final UMKM - 15th
    events.push({
      id: `pph-final-${month}`,
      date: `${year}-${String(month).padStart(2, '0')}-15`,
      title: `Setor PPh Final UMKM - ${prevMonth}`,
      description: `Batas setor PPh Final 0.5% masa ${prevMonth}`,
      taxType: 'PPh Final',
      isAnnual: false,
      penalty: 'Bunga 2%/bulan',
      priority: 'MEDIUM',
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
