import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole } from '@/types/auth';
import type { RequestWithSession } from '@/types/auth';

/**
 * POST /api/tax/export-xml
 *
 * Generate e-SPT XML for DJP e-Filing upload.
 * Supports: SPT 1770SS, SPT 1770S, SPT Masa PPh 21/23
 */
async function handleExportXml(req: RequestWithSession): Promise<Response> {
  try {
    const { filingId, format } = await req.json() as { filingId: string; format?: string };

    if (!filingId) {
      return NextResponse.json({ error: 'filingId is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Get filing data
    const { data: filing, error } = await admin
      .from('tax_filing')
      .select('id, customer_id, tax_type, tax_period, tax_year, status, tax_data, filed_at')
      .eq('id', filingId)
      .single();

    if (error || !filing) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
    }

    // Verify ownership: customer can only export own filings, consultant must be assigned
    const userId = req.session.userId;
    const role = req.session.role;

    if (role === UserRole.CUSTOMER) {
      const { data: customer } = await admin.from('customer').select('id').eq('user_id', userId).single();
      if (!customer || filing.customer_id !== customer.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (role === UserRole.CONSULTANT_JTC || role === UserRole.TAX_ADVISOR_JTC) {
      const { data: consultant } = await admin.from('consultant').select('id').eq('user_id', userId).single();
      if (!consultant) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      // Verify consultant is assigned to this customer
      const { data: assignment } = await admin.from('customer').select('id').eq('id', filing.customer_id).eq('assigned_consultant_id', consultant.id).single();
      if (!assignment) {
        return NextResponse.json({ error: 'Not assigned to this customer' }, { status: 403 });
      }
    }

    // Get customer info
    const { data: customer } = await admin
      .from('customer')
      .select('full_name, npwp, nik, address, phone')
      .eq('id', filing.customer_id)
      .single();

    // Generate XML based on tax type
    const xml = generateSPTXml(filing, customer);

    const filename = `eSPT_${filing.tax_type}_${filing.tax_period || filing.tax_year}_${customer?.npwp?.replace(/\D/g, '') || 'unknown'}.xml`;

    loggers.api.info({ filingId, taxType: filing.tax_type }, 'e-SPT XML exported');

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'XML export error');
    return NextResponse.json({ error: 'XML export failed' }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateSPTXml(filing: any, customer: any): string {
  const taxData = filing.tax_data || {};
  const npwp = customer?.npwp?.replace(/\D/g, '') || '000000000000000';
  const name = customer?.full_name || '';
  const nik = customer?.nik || '';
  const address = customer?.address || '';

  const header = `<?xml version="1.0" encoding="UTF-8"?>`;

  if (filing.tax_type === 'SPT_1770SS' || filing.tax_type === 'SPT_TAHUNAN') {
    return `${header}
<SPT xmlns="urn:schemas-djp-go-id:spt:1770ss">
  <Header>
    <KodePembetulan>0</KodePembetulan>
    <TahunPajak>${filing.tax_year}</TahunPajak>
    <NPWP>${npwp}</NPWP>
    <NIK>${nik}</NIK>
    <NamaWP>${escapeXml(name)}</NamaWP>
    <AlamatWP>${escapeXml(address)}</AlamatWP>
    <StatusSPT>Normal</StatusSPT>
  </Header>
  <FormulirUtama>
    <A_PenghasilanBruto>${taxData.grossIncome || taxData.totalGrossIncome || 0}</A_PenghasilanBruto>
    <B_PengurangPenghasilan>${taxData.totalDeductions || 0}</B_PengurangPenghasilan>
    <C_PenghasilanNetoDN>${taxData.netIncome || 0}</C_PenghasilanNetoDN>
    <D_PTKP>${taxData.ptkpAmount || 0}</D_PTKP>
    <E_PKP>${taxData.taxableIncome || 0}</E_PKP>
    <F_PPhTerutang>${taxData.calculatedTax || taxData.taxDue || 0}</F_PPhTerutang>
    <G_PPhDipotong>${taxData.taxWithheld || taxData.totalTaxPaid || 0}</G_PPhDipotong>
    <H_PPhKurangLebihBayar>${taxData.taxOwed || taxData.remainingTax || 0}</H_PPhKurangLebihBayar>
  </FormulirUtama>
  <Lampiran>
    <DaftarBuktiPotong>
${(taxData.incomeSources || []).map((src: { employerName?: string; employerNpwp?: string; grossIncome?: number; taxWithheld?: number }, i: number) => `      <BuktiPotong>
        <No>${i + 1}</No>
        <NamaPemotong>${escapeXml(src.employerName || '')}</NamaPemotong>
        <NPWPPemotong>${(src.employerNpwp || '').replace(/\D/g, '')}</NPWPPemotong>
        <JenisPenghasilan>Gaji</JenisPenghasilan>
        <JumlahPenghasilan>${src.grossIncome || 0}</JumlahPenghasilan>
        <JumlahPPh>${src.taxWithheld || 0}</JumlahPPh>
      </BuktiPotong>`).join('\n')}
    </DaftarBuktiPotong>
  </Lampiran>
</SPT>`;
  }

  if (filing.tax_type === 'PPh21' || filing.tax_type === 'PPh23') {
    const sptMasa = taxData.spt_masa_result || taxData;
    return `${header}
<SPTMasa xmlns="urn:schemas-djp-go-id:spt:masa:${filing.tax_type.toLowerCase()}">
  <Header>
    <JenisPajak>${filing.tax_type}</JenisPajak>
    <MasaPajak>${filing.tax_period}</MasaPajak>
    <TahunPajak>${filing.tax_year}</TahunPajak>
    <KodePembetulan>0</KodePembetulan>
    <NPWP>${npwp}</NPWP>
    <NamaWP>${escapeXml(name)}</NamaWP>
  </Header>
  <Induk>
    <JumlahPenghasilan>${sptMasa.total_gross_income || 0}</JumlahPenghasilan>
    <JumlahPPhDipotong>${sptMasa.total_tax_withheld || 0}</JumlahPPhDipotong>
    <JumlahItem>${sptMasa.item_count || 0}</JumlahItem>
  </Induk>
  <DaftarPemotongan>
${(sptMasa.items || []).map((item: { recipient_name?: string; recipient_npwp?: string; gross_amount?: number; tax_withheld?: number }, i: number) => `    <Pemotongan>
      <No>${i + 1}</No>
      <NamaPenerima>${escapeXml(item.recipient_name || '')}</NamaPenerima>
      <NPWPPenerima>${(item.recipient_npwp || '').replace(/\D/g, '')}</NPWPPenerima>
      <JumlahBruto>${item.gross_amount || 0}</JumlahBruto>
      <PPh>${item.tax_withheld || 0}</PPh>
    </Pemotongan>`).join('\n')}
  </DaftarPemotongan>
</SPTMasa>`;
  }

  // Generic fallback
  return `${header}
<SPT>
  <TaxType>${filing.tax_type}</TaxType>
  <Period>${filing.tax_period || filing.tax_year}</Period>
  <NPWP>${npwp}</NPWP>
  <Data>${JSON.stringify(taxData)}</Data>
</SPT>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC),
    withAudit('SPT_XML_EXPORT')
  )(request as RequestWithSession, handleExportXml);
}
