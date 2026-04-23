import { NextRequest } from 'next/server';
import { customerOperation } from '@/middleware/compose';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

/**
 * GET /api/customer/filing-history
 *
 * Returns the customer's last 5 years of annual SPT filings, each bundled with
 * its related tax documents (SPT PDF, BPE, A1 slips, financial statements).
 *
 * Keynote slide-18/19: per-year accordion showing SPT + BPE + A1 + 재무제표.
 */

interface DocRow {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  ocr_data: Record<string, unknown> | null;
}

interface FilingRow {
  id: string;
  tax_type: string;
  tax_period: string;
  status: string;
  bpe_number: string | null;
  filed_at: string | null;
  tax_data: Record<string, unknown> | null;
  created_at: string;
  tax_document?: DocRow[];
}

function toYear(period: string | null, filedAt: string | null, createdAt: string): number {
  if (period) {
    const m = period.match(/^(\d{4})/);
    if (m) return Number(m[1]);
  }
  if (filedAt) return new Date(filedAt).getFullYear();
  return new Date(createdAt).getFullYear();
}

function filingLabel(taxType: string): string {
  // Normalize to the short label used in the keynote header (1770SS/1770S/1770).
  if (taxType === 'SPT_1770SS') return '1770SS';
  if (taxType === 'SPT_1770S') return '1770S';
  if (taxType === 'SPT_1770') return '1770';
  if (taxType === 'SPT_1771') return '1771';
  return taxType.replace('SPT_', '');
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  try {
    const userId = req.session.userId;
    const admin = getSupabaseAdmin();

    const { data: customer } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!customer) {
      return Response.json({ error: 'Customer record not found' }, { status: 404 });
    }

    const currentYear = new Date().getFullYear();
    const cutoff = new Date(currentYear - 5, 0, 1).toISOString();

    const { data: filings } = await admin
      .from('tax_filing')
      .select(`
        id, tax_type, tax_period, status, bpe_number, filed_at, tax_data, created_at,
        tax_document:tax_document!tax_filing_id(id, document_type, file_name, file_path, ocr_data)
      `)
      .eq('customer_id', customer.id)
      .in('tax_type', ['SPT_TAHUNAN', 'SPT_1770SS', 'SPT_1770S', 'SPT_1770', 'SPT_1771'])
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    const grouped = new Map<number, {
      year: number;
      filingId: string;
      filingType: string;
      submittedAt: string | null;
      status: string;
      documents: Array<{ type: string; name: string; path: string; number?: string | null }>;
    }>();

    for (const row of (filings || []) as FilingRow[]) {
      const year = toYear(row.tax_period, row.filed_at, row.created_at);
      if (grouped.has(year)) continue; // keep the newest per year

      const docs: Array<{ type: string; name: string; path: string; number?: string | null }> = [];
      // SPT PDF — always implied by the filing record itself.
      docs.push({
        type: 'SPT',
        name: `SPT Pribadi ${year}`,
        path: `/api/tax/spt/${filingLabel(row.tax_type).toLowerCase()}?filingId=${row.id}`,
      });

      if (row.bpe_number) {
        docs.push({
          type: 'BPE',
          name: `BPE ${year}`,
          path: `/api/tax/filings/${row.id}/bpe`,
          number: row.bpe_number,
        });
      }

      for (const d of row.tax_document || []) {
        if (d.document_type === 'A1' || d.document_type === 'SALARY_SLIP') {
          docs.push({
            type: 'A1',
            name: d.file_name || `A1 ${year}`,
            path: d.file_path,
          });
        } else if (d.document_type === 'FINANCIAL_STATEMENT' || d.document_type === 'BALANCE_SHEET') {
          docs.push({
            type: '재무제표',
            name: d.file_name || `재무제표 ${year}`,
            path: d.file_path,
          });
        }
      }

      grouped.set(year, {
        year,
        filingId: row.id,
        filingType: filingLabel(row.tax_type),
        submittedAt: row.filed_at,
        status: row.status,
        documents: docs,
      });
    }

    // Fill 5-year window, oldest last (matches keynote order: newest first).
    const years: typeof grouped extends Map<number, infer V> ? V[] : never = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      const entry = grouped.get(y);
      if (entry) {
        years.push(entry);
      } else {
        years.push({
          year: y,
          filingId: '',
          filingType: '',
          submittedAt: null,
          status: 'NONE',
          documents: [],
        });
      }
    }

    return Response.json({
      success: true,
      data: { years, customerId: customer.id },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Filing history fetch failed');
    return Response.json({ error: 'Failed to fetch filing history' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return customerOperation()(request as RequestWithSession, handleGet);
}
