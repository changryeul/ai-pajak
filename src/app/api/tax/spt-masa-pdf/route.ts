import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { generateSPTMasaPDFBuffer } from '@/lib/tax/spt-masa/pdf-generator';

/**
 * POST /api/tax/spt-masa-pdf
 *
 * Generate SPT Masa preview PDF
 * Body: { filingId } or { customerId, taxType, period } for on-the-fly generation
 */
async function handlePost(req: RequestWithSession): Promise<Response> {
  const body = await req.json();
  const { filingId, customerId, taxType, period } = body;

  let sptMasaResult;
  let customerData;

  if (filingId) {
    // Fetch from existing filing record
    const { data: filing, error } = await getSupabaseAdmin()
      .from('tax_filing')
      .select('tax_data, customer_id')
      .eq('id', filingId)
      .single();

    if (error || !filing) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
    }

    sptMasaResult = filing.tax_data?.spt_masa_result;
    if (!sptMasaResult) {
      return NextResponse.json({ error: 'No SPT Masa data in filing' }, { status: 400 });
    }

    const { data: customer } = await getSupabaseAdmin()
      .from('customer')
      .select('full_name, company_name, npwp, customer_type')
      .eq('id', filing.customer_id)
      .single();

    customerData = {
      name: customer?.customer_type === 'INDIVIDUAL' ? customer.full_name : customer?.company_name || 'Unknown',
      npwp: customer?.npwp || '',
    };
  } else if (customerId && taxType && period) {
    // Generate on-the-fly from SPT Masa Calculator
    const { SPTMasaCalculator } = await import('@/lib/tax/spt-masa-calculator');

    if (taxType === 'PPh21') {
      sptMasaResult = await SPTMasaCalculator.calculatePPh21Masa({ month: period, customerId });
    } else if (taxType === 'PPh23') {
      sptMasaResult = await SPTMasaCalculator.calculatePPh23Masa({ month: period, customerId });
    } else if (taxType === 'PPh4_2' || taxType === 'PPh_FINAL') {
      sptMasaResult = await SPTMasaCalculator.calculatePPh42Masa({ month: period, customerId });
    } else if (taxType === 'PPN') {
      sptMasaResult = await SPTMasaCalculator.calculatePPNMasa({ month: period, customerId });
    } else {
      return NextResponse.json({ error: 'Invalid taxType' }, { status: 400 });
    }

    const { data: customer } = await getSupabaseAdmin()
      .from('customer')
      .select('full_name, company_name, npwp, customer_type')
      .eq('id', customerId)
      .single();

    customerData = {
      name: customer?.customer_type === 'INDIVIDUAL' ? customer.full_name : customer?.company_name || 'Unknown',
      npwp: customer?.npwp || '',
    };
  } else {
    return NextResponse.json({ error: 'filingId or (customerId, taxType, period) required' }, { status: 400 });
  }

  try {
    const pdfBuffer = await generateSPTMasaPDFBuffer({
      sptMasa: sptMasaResult,
      customer: customerData,
      generatedAt: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    });

    const pdfBytes = new Uint8Array(pdfBuffer);
    const filename = `SPT_Masa_${sptMasaResult.tax_type}_${sptMasaResult.period}.pdf`;

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(
    request as RequestWithSession, handlePost
  );
}
