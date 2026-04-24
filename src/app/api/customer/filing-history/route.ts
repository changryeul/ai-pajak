import { NextRequest } from 'next/server';
import { customerOperation } from '@/middleware/compose';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

/**
 * GET /api/customer/filing-history
 *
 * Returns the customer's last 5 years of annual SPT filings. For each year
 * we emit a fixed set of document *slots* (SPT / BPE / A1* / 재무제표*)
 * with a `path` of null when the document is missing — the UI renders the
 * empty slots as upload buttons (keynote slide-19/20: BPE 틀이 있어야
 * 고객이 올릴 수 있음).
 *
 * Asterisks:
 *   - A1 slots only for 1770SS / 1770S (employment income).
 *   - 재무제표 slot only for 1770 (business income).
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

interface DocSlot {
  type: 'SPT' | 'BPE' | 'A1' | '재무제표';
  name: string;
  path: string | null;
  taxDocumentId?: string | null;
  number?: string | null;
}

interface YearEntry {
  year: number;
  filingId: string;
  filingType: string;
  submittedAt: string | null;
  status: string;
  documents: DocSlot[];
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
  if (taxType === 'SPT_1770SS') return '1770SS';
  if (taxType === 'SPT_1770S') return '1770S';
  if (taxType === 'SPT_1770') return '1770';
  if (taxType === 'SPT_1771') return '1771';
  return taxType.replace('SPT_', '');
}

function needsFinancials(taxType: string): boolean {
  return taxType === 'SPT_1770' || taxType === 'SPT_1771';
}

function needsA1(taxType: string): boolean {
  return (
    taxType === 'SPT_TAHUNAN'
    || taxType === 'SPT_1770SS'
    || taxType === 'SPT_1770S'
  );
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

    const grouped = new Map<number, YearEntry>();

    for (const row of (filings || []) as FilingRow[]) {
      const year = toYear(row.tax_period, row.filed_at, row.created_at);
      if (grouped.has(year)) continue; // keep the newest per year

      const docs: DocSlot[] = [];

      // 1) SPT slot — always present for an existing filing (server-generated PDF).
      docs.push({
        type: 'SPT',
        name: `SPT Pribadi ${year}`,
        path: `/api/tax/spt/${filingLabel(row.tax_type).toLowerCase()}?filingId=${row.id}`,
      });

      // 2) BPE slot — always show. path = uploaded tax_document if exists,
      //    otherwise null (UI renders upload button).
      const bpeDoc = (row.tax_document || []).find((d) => d.document_type === 'BPE');
      docs.push({
        type: 'BPE',
        name: `BPE ${year}`,
        path: bpeDoc
          ? `/api/customer/filing-document/${bpeDoc.id}`
          : null,
        taxDocumentId: bpeDoc?.id ?? null,
        number: row.bpe_number,
      });

      // 3) A1 slots — one per uploaded A1 doc, plus one empty slot for upload
      //    (employment income forms only).
      if (needsA1(row.tax_type)) {
        const a1Docs = (row.tax_document || []).filter(
          (d) => d.document_type === 'A1' || d.document_type === 'FORM_1721_A1' || d.document_type === 'SALARY_SLIP',
        );
        for (const a1 of a1Docs) {
          docs.push({
            type: 'A1',
            name: a1.file_name || `A1 ${year}`,
            path: `/api/customer/filing-document/${a1.id}`,
            taxDocumentId: a1.id,
          });
        }
        // Always show one extra empty slot so customer can add another A1.
        docs.push({
          type: 'A1',
          name: `A1 ${year}`,
          path: null,
          taxDocumentId: null,
        });
      }

      // 4) 재무제표 slot — 1770/1771 only.
      if (needsFinancials(row.tax_type)) {
        const fsDoc = (row.tax_document || []).find(
          (d) =>
            d.document_type === 'FINANCIAL_STATEMENT'
            || d.document_type === 'BALANCE_SHEET',
        );
        docs.push({
          type: '재무제표',
          name: `재무제표 ${year}`,
          path: fsDoc ? `/api/customer/filing-document/${fsDoc.id}` : null,
          taxDocumentId: fsDoc?.id ?? null,
        });
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

    const years: YearEntry[] = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      const entry = grouped.get(y);
      if (entry) {
        years.push(entry);
      } else {
        // No filing row yet for this year — still emit an empty BPE slot so
        // the customer can attach a DJP-issued BPE for an externally filed
        // SPT. The upload endpoint creates a placeholder tax_filing row when
        // it receives a year-only payload.
        const emptyDocs: DocSlot[] = [
          { type: 'BPE', name: `BPE ${y}`, path: null, taxDocumentId: null, number: null },
        ];
        years.push({
          year: y,
          filingId: '',
          filingType: '',
          submittedAt: null,
          status: 'NONE',
          documents: emptyDocs,
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
