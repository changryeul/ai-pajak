/**
 * GET /api/tax/efaktur-export?customerId=...&month=...&year=...&type=output|input|both
 *
 * Generates a DJP e-Faktur Desktop compatible CSV file from:
 * 1. faktur_pajak table (if exists — manually created Faktur)
 * 2. accounting_invoice table (if exists — imported from Accurate/Mekari)
 *
 * DJP e-Faktur CSV format:
 *   FK row: Faktur header (transaction code, NPWP, amounts, etc.)
 *   OF row: Line item detail
 *
 * Reference: DJP e-Faktur Desktop v4.0 Import CSV Specification
 *
 * Auth: CONSULTANT_JTC / TAX_ADVISOR_JTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

// DJP e-Faktur transaction codes
const TRANSACTION_CODE_OUTPUT = '01'; // Penyerahan BKP/JKP
const TRANSACTION_CODE_INPUT = '01';

interface FakturRow {
  serialNumber: string;
  transactionType: 'OUTPUT' | 'INPUT';
  buyerNpwp: string;
  buyerName: string;
  buyerAddress: string;
  sellerNpwp: string;
  sellerName: string;
  dpp: number;
  ppnAmount: number;
  ppnbmAmount: number;
  invoiceDate: string;
  taxPeriodMonth: number;
  taxPeriodYear: number;
  items: Array<{
    description: string;
    price: number;
    quantity: number;
    dpp: number;
    ppn: number;
  }>;
}

function formatDate(dateStr: string): string {
  // Convert YYYY-MM-DD to DD/MM/YYYY for DJP
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function generateCSV(fakturList: FakturRow[]): string {
  const lines: string[] = [];

  for (const f of fakturList) {
    const txCode = f.transactionType === 'OUTPUT' ? TRANSACTION_CODE_OUTPUT : TRANSACTION_CODE_INPUT;
    const fgPengganti = '0'; // 0 = Normal, 1 = Pengganti (replacement)

    // FK row: Faktur header
    // FK,KdJenisTransaksi,FgPengganti,NomorFaktur,MasaPajak,TahunPajak,TanggalFaktur,
    // NpwpLawanTransaksi,NamaLawanTransaksi,AlamatLawanTransaksi,
    // JumlahDpp,JumlahPpn,JumlahPpnBm,IdKeteranganTambahan,
    // FgUangMuka,UangMukaDpp,UangMukaPpn,UangMukaPpnBm,Referensi
    lines.push([
      'FK',
      txCode,
      fgPengganti,
      f.serialNumber.replace(/[.\-]/g, ''), // Remove dots/dashes
      String(f.taxPeriodMonth).padStart(2, '0'),
      String(f.taxPeriodYear),
      formatDate(f.invoiceDate),
      (f.transactionType === 'OUTPUT' ? f.buyerNpwp : f.sellerNpwp).replace(/[.\-]/g, ''),
      f.transactionType === 'OUTPUT' ? f.buyerName : f.sellerName,
      f.transactionType === 'OUTPUT' ? f.buyerAddress : '',
      String(Math.round(f.dpp)),
      String(Math.round(f.ppnAmount)),
      String(Math.round(f.ppnbmAmount)),
      '', // IdKeteranganTambahan
      '0', // FgUangMuka
      '0', // UangMukaDpp
      '0', // UangMukaPpn
      '0', // UangMukaPpnBm
      '', // Referensi
    ].join(','));

    // OF rows: Line items
    for (const item of f.items) {
      // OF,KodeObjek,NamaBarangJasa,HargaSatuan,JumlahBarangJasa,
      // HargaTotal,Diskon,Dpp,Ppn,TarifPpnBm,PpnBm
      lines.push([
        'OF',
        '', // KodeObjek (item code, optional)
        `"${item.description.replace(/"/g, '""')}"`,
        String(Math.round(item.price)),
        String(item.quantity),
        String(Math.round(item.price * item.quantity)),
        '0', // Diskon
        String(Math.round(item.dpp)),
        String(Math.round(item.ppn)),
        '0', // TarifPpnBm
        '0', // PpnBm
      ].join(','));
    }
  }

  return lines.join('\n');
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = new URL(request.url).searchParams;
    const customerId = params.get('customerId');
    const month = parseInt(params.get('month') || '0', 10);
    const year = parseInt(params.get('year') || new Date().getFullYear().toString(), 10);
    const type = params.get('type') || 'both'; // output | input | both

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Get customer info for seller/buyer fields
    const { data: customer } = await admin
      .from('customer')
      .select('full_name, company_name, npwp, address')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customerName = customer.company_name || customer.full_name || '';
    const customerNpwp = customer.npwp || '';
    const customerAddress = customer.address || '';

    const fakturList: FakturRow[] = [];

    // Source 1: faktur_pajak table (manually created Faktur)
    let fpQuery = admin
      .from('faktur_pajak')
      .select('*')
      .eq('customer_id', customerId)
      .in('status', ['APPROVED', 'ISSUED']);

    if (month > 0) {
      fpQuery = fpQuery.eq('tax_period', `${year}-${String(month).padStart(2, '0')}`);
    }
    if (type === 'output') fpQuery = fpQuery.eq('transaction_type', 'OUTPUT');
    if (type === 'input') fpQuery = fpQuery.eq('transaction_type', 'INPUT');

    const { data: fakturs } = await fpQuery;

    for (const fp of fakturs || []) {
      const items = Array.isArray(fp.items) ? fp.items : [];
      fakturList.push({
        serialNumber: fp.serial_number || `000.000-00.00000000`,
        transactionType: fp.transaction_type,
        buyerNpwp: fp.buyer_npwp || '',
        buyerName: fp.buyer_name || '',
        buyerAddress: fp.buyer_address || '',
        sellerNpwp: fp.seller_npwp || customerNpwp,
        sellerName: fp.seller_name || customerName,
        dpp: fp.dpp || 0,
        ppnAmount: fp.ppn_amount || 0,
        ppnbmAmount: fp.ppnbm_amount || 0,
        invoiceDate: fp.issue_date || fp.created_at?.slice(0, 10) || '',
        taxPeriodMonth: month || parseInt(fp.tax_period?.split('-')[1] || '1', 10),
        taxPeriodYear: year,
        items: items.map((item: { description?: string; unitPrice?: number; quantity?: number; dpp?: number; ppnAmount?: number }) => ({
          description: item.description || 'Barang/Jasa',
          price: item.unitPrice || 0,
          quantity: item.quantity || 1,
          dpp: item.dpp || 0,
          ppn: item.ppnAmount || 0,
        })),
      });
    }

    // Source 2: accounting_invoice table (imported from Accurate/Mekari)
    let aiQuery = admin
      .from('accounting_invoice')
      .select('*')
      .eq('customer_id', customerId)
      .eq('has_ppn', true);

    if (month > 0) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      aiQuery = aiQuery.gte('invoice_date', startDate).lt('invoice_date', endDate);
    }
    if (type === 'output') aiQuery = aiQuery.eq('invoice_type', 'SALES');
    if (type === 'input') aiQuery = aiQuery.eq('invoice_type', 'PURCHASE');

    const { data: accInvoices } = await aiQuery;

    let seqCounter = (fakturs?.length || 0) + 1;
    for (const inv of accInvoices || []) {
      const invDate = inv.invoice_date || '';
      const invMonth = parseInt(invDate.split('-')[1] || String(month), 10);
      const seq = String(seqCounter++).padStart(8, '0');

      fakturList.push({
        serialNumber: `010.000-${String(year).slice(-2)}.${seq}`,
        transactionType: inv.invoice_type === 'SALES' ? 'OUTPUT' : 'INPUT',
        buyerNpwp: inv.invoice_type === 'SALES' ? (inv.counterparty_npwp || '') : customerNpwp,
        buyerName: inv.invoice_type === 'SALES' ? (inv.counterparty_name || '') : customerName,
        buyerAddress: inv.invoice_type === 'SALES' ? '' : customerAddress,
        sellerNpwp: inv.invoice_type === 'SALES' ? customerNpwp : (inv.counterparty_npwp || ''),
        sellerName: inv.invoice_type === 'SALES' ? customerName : (inv.counterparty_name || ''),
        dpp: (inv.subtotal || 0),
        ppnAmount: (inv.tax_amount || 0),
        ppnbmAmount: 0,
        invoiceDate: invDate,
        taxPeriodMonth: invMonth || month,
        taxPeriodYear: year,
        items: [{
          description: `${inv.invoice_number || 'Invoice'} - ${inv.counterparty_name || ''}`,
          price: inv.subtotal || 0,
          quantity: 1,
          dpp: inv.subtotal || 0,
          ppn: inv.tax_amount || 0,
        }],
      });
    }

    if (fakturList.length === 0) {
      return NextResponse.json({
        success: true,
        data: { count: 0, csv: '' },
        message: 'No e-Faktur data for the selected period',
      });
    }

    const csv = generateCSV(fakturList);

    loggers.api.info(
      { customerId, month, year, type, count: fakturList.length },
      'e-Faktur CSV exported',
    );

    // Return as downloadable CSV
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="efaktur-${customerName.replace(/\s/g, '_')}-${year}${month ? '-' + String(month).padStart(2, '0') : ''}.csv"`,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'e-Faktur export error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}
