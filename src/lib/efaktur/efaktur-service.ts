import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type {
  FakturPajak,
  CreateFakturRequest,
  FakturLineItem,
  FakturSummary,
} from './types';

export class EFakturService {
  /**
   * Generate a Faktur Pajak serial number
   * Format: KKK.FFF-YY.NNNNNNNN
   */
  static async generateSerialNumber(): Promise<string> {
    const admin = getSupabaseAdmin();
    const { data } = await admin.rpc('nextval_text', { seq_name: 'faktur_serial_seq' })
      .single();

    // Fallback: use timestamp-based if RPC not available
    const seq = data || Date.now() % 100000000;
    const year = new Date().getFullYear().toString().slice(-2);
    const seqStr = String(seq).padStart(8, '0');
    return `010.000-${year}.${seqStr}`;
  }

  /**
   * Calculate line item totals
   */
  static calculateTotals(items: FakturLineItem[]): { dpp: number; ppnAmount: number; ppnbmAmount: number; totalAmount: number } {
    const dpp = items.reduce((sum, item) => sum + item.dpp, 0);
    const ppnAmount = items.reduce((sum, item) => sum + item.ppnAmount, 0);
    const ppnbmAmount = items.reduce((sum, item) => sum + (item.ppnbmAmount || 0), 0);
    return { dpp, ppnAmount, ppnbmAmount, totalAmount: dpp + ppnAmount + ppnbmAmount };
  }

  /**
   * Create a new Faktur Pajak
   */
  static async create(customerId: string, request: CreateFakturRequest, consultantId?: string): Promise<FakturPajak> {
    const admin = getSupabaseAdmin();
    const totals = this.calculateTotals(request.items);

    const { data, error } = await admin
      .from('faktur_pajak')
      .insert({
        customer_id: customerId,
        consultant_id: consultantId,
        transaction_type: request.transactionType,
        buyer_npwp: request.buyerNpwp,
        buyer_name: request.buyerName,
        buyer_address: request.buyerAddress,
        seller_npwp: request.sellerNpwp,
        seller_name: request.sellerName,
        dpp: totals.dpp,
        ppn_amount: totals.ppnAmount,
        ppnbm_amount: totals.ppnbmAmount,
        total_amount: totals.totalAmount,
        items: request.items,
        tax_period: request.taxPeriod,
        status: 'DRAFT',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create faktur: ${error.message}`);
    return this.mapToFaktur(data);
  }

  /**
   * Approve and issue a Faktur (assign serial number)
   */
  static async approve(fakturId: string): Promise<FakturPajak> {
    const admin = getSupabaseAdmin();
    const serialNumber = await this.generateSerialNumber();

    const { data, error } = await admin
      .from('faktur_pajak')
      .update({
        serial_number: serialNumber,
        status: 'APPROVED',
        issue_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', fakturId)
      .eq('status', 'DRAFT')
      .select()
      .single();

    if (error) throw new Error(`Failed to approve faktur: ${error.message}`);
    return this.mapToFaktur(data);
  }

  /**
   * Void a Faktur
   */
  static async void_(fakturId: string, reason: string): Promise<FakturPajak> {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from('faktur_pajak')
      .update({
        status: 'VOID',
        void_date: new Date().toISOString().split('T')[0],
        void_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fakturId)
      .in('status', ['DRAFT', 'APPROVED', 'ISSUED'])
      .select()
      .single();

    if (error) throw new Error(`Failed to void faktur: ${error.message}`);
    return this.mapToFaktur(data);
  }

  /**
   * List Faktur for a customer with pagination
   */
  static async list(customerId: string, options?: {
    transactionType?: string;
    taxPeriod?: string;
    status?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ data: FakturPajak[]; total: number }> {
    const admin = getSupabaseAdmin();
    const page = options?.page || 1;
    const perPage = options?.perPage || 20;
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = admin
      .from('faktur_pajak')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (options?.transactionType) query = query.eq('transaction_type', options.transactionType);
    if (options?.taxPeriod) query = query.eq('tax_period', options.taxPeriod);
    if (options?.status) query = query.eq('status', options.status);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list faktur: ${error.message}`);

    return {
      data: (data || []).map(this.mapToFaktur),
      total: count || 0,
    };
  }

  /**
   * Get monthly PPN summary (for SPT Masa PPN)
   */
  static async getMonthlySummary(customerId: string, taxPeriod: string): Promise<FakturSummary> {
    const admin = getSupabaseAdmin();

    // Single query for both OUTPUT and INPUT
    const { data: rows } = await admin
      .from('faktur_pajak')
      .select('transaction_type, ppn_amount')
      .eq('customer_id', customerId)
      .eq('tax_period', taxPeriod)
      .neq('status', 'VOID');

    let totalOutput = 0, totalInput = 0, outputCount = 0, inputCount = 0;
    for (const r of rows || []) {
      const amount = Number(r.ppn_amount);
      if (r.transaction_type === 'OUTPUT') { totalOutput += amount; outputCount++; }
      else { totalInput += amount; inputCount++; }
    }

    return {
      totalOutput,
      totalInput,
      netPayable: totalOutput - totalInput,
      outputCount,
      inputCount,
      period: taxPeriod,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapToFaktur(row: any): FakturPajak {
    return {
      id: row.id,
      customerId: row.customer_id,
      consultantId: row.consultant_id,
      transactionType: row.transaction_type,
      serialNumber: row.serial_number,
      buyerNpwp: row.buyer_npwp,
      buyerName: row.buyer_name,
      buyerAddress: row.buyer_address,
      sellerNpwp: row.seller_npwp,
      sellerName: row.seller_name,
      dpp: Number(row.dpp),
      ppnAmount: Number(row.ppn_amount),
      ppnbmAmount: Number(row.ppnbm_amount),
      totalAmount: Number(row.total_amount),
      items: row.items || [],
      status: row.status,
      issueDate: row.issue_date,
      voidDate: row.void_date,
      voidReason: row.void_reason,
      djpApprovalCode: row.djp_approval_code,
      taxFilingId: row.tax_filing_id,
      taxPeriod: row.tax_period,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
