/**
 * Phase 2 of the supervisor invoice line-item feature.
 *
 * Given a consultant_session_document (slot=WITHHOLDING_INVOICE or VAT_IN_OUT),
 * downloads the file from Supabase storage and calls Claude Sonnet 4.6 with
 * vision to extract the per-line breakdown. Returns rows shaped for direct
 * insertion into consultant_session_invoice_line.
 *
 * Mirrors the graceful-fallback pattern of parseConsultantDocument so the
 * supervisor UI never breaks when the API key is missing, the file is a
 * synthetic placeholder, or the model output is malformed.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

const STORAGE_BUCKET = 'consultant-erp-docs';
const MODEL = 'claude-sonnet-4-6';
const MAX_OUTPUT = 12_000;

export interface InvoiceLineExtracted {
  line_no: number;
  invoice_number: string | null;
  invoice_date: string | null; // YYYY-MM-DD
  counterparty_name: string | null;
  counterparty_npwp: string | null;
  currency: string;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  subtotal: number | null;
  vat_amount: number | null;
  withholding_amount: number | null;
  total: number | null;
}

export interface InvoiceLineParseResult {
  lines: InvoiceLineExtracted[];
  mode: 'CLAUDE' | 'MOCK';
  modelVersion: string;
  confidence: number;
  reason: string | null;
}

const PROMPT = `You are extracting line items from an Indonesian tax invoice (Faktur Pajak, withholding invoice, or commercial invoice). The document may be a PDF, image, or spreadsheet.

Return ONLY valid JSON shaped as:
{
  "lines": [
    {
      "line_no": 1,
      "invoice_number": "INV-2026-001",
      "invoice_date": "2026-05-10",
      "counterparty_name": "PT Mitra Sukses",
      "counterparty_npwp": "01.234.567.8-901.000",
      "currency": "IDR",
      "description": "Jasa konsultasi",
      "quantity": 1,
      "unit_price": 10000000,
      "subtotal": 10000000,
      "vat_amount": 1100000,
      "withholding_amount": 200000,
      "total": 10900000
    }
  ]
}

Rules:
- Emit one entry per visible line item. If the invoice has 5 lines, return 5 entries.
- line_no starts at 1 and increases by 1 per line.
- invoice_number / invoice_date / counterparty_* are the SAME on every line of the same invoice — denormalize them onto each line.
- invoice_date MUST be ISO YYYY-MM-DD. If only month/year visible, set to YYYY-MM-01.
- counterparty_npwp: keep the original format (with dots and dashes if shown).
- currency: 3-letter ISO. Default to "IDR" if not labelled.
- Numbers: emit plain numbers (no thousand separators, no currency prefix). Use null only when the field is genuinely absent.
- vat_amount: if "PPN" line items appear separately, attach the amount to the line they tax; if the invoice shows a single VAT total, distribute proportionally by subtotal. Be conservative — null is OK.
- withholding_amount: PPh21/22/23/26/4(2) deducted from this line. null if not visible.
- total = subtotal + vat_amount - withholding_amount when those are present.
- If the document is NOT an invoice (e.g. bank statement, payroll), return {"lines": []}.
- Do not wrap the JSON in markdown code fences. Output ONLY the JSON value.`;

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) return fence[1];
  const startObj = text.indexOf('{');
  const startArr = text.indexOf('[');
  let start = -1;
  if (startObj < 0) start = startArr;
  else if (startArr < 0) start = startObj;
  else start = Math.min(startObj, startArr);
  return start < 0 ? text : text.slice(start).trim();
}

function isLikelyRealStoragePath(p: string): boolean {
  return /\.(pdf|xlsx|xls|csv|png|jpe?g|webp|zip|txt)$/i.test(p);
}

function inferContentType(filename: string, mimeType: string | null): {
  type: 'document' | 'image' | 'text';
  mediaType: string;
} {
  if (mimeType) {
    if (mimeType === 'application/pdf') return { type: 'document', mediaType: mimeType };
    if (mimeType.startsWith('image/')) return { type: 'image', mediaType: mimeType };
    if (mimeType.startsWith('text/') || mimeType === 'application/vnd.ms-excel' || mimeType.includes('spreadsheetml'))
      return { type: 'text', mediaType: mimeType };
  }
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return { type: 'document', mediaType: 'application/pdf' };
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    const m = ext === 'jpg' ? 'jpeg' : ext;
    return { type: 'image', mediaType: `image/${m}` };
  }
  return { type: 'text', mediaType: 'text/plain' };
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]/g, '');
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return String(v);
}

function normalizeRows(rows: unknown[]): InvoiceLineExtracted[] {
  return rows.map((raw, i) => {
    const r = (raw as Record<string, unknown>) ?? {};
    const lineNo = Number(r.line_no);
    return {
      line_no: Number.isFinite(lineNo) && lineNo > 0 ? Math.floor(lineNo) : i + 1,
      invoice_number: toStringOrNull(r.invoice_number),
      invoice_date: toStringOrNull(r.invoice_date),
      counterparty_name: toStringOrNull(r.counterparty_name),
      counterparty_npwp: toStringOrNull(r.counterparty_npwp),
      currency: (toStringOrNull(r.currency) ?? 'IDR').slice(0, 3).toUpperCase(),
      description: toStringOrNull(r.description),
      quantity: toNumber(r.quantity),
      unit_price: toNumber(r.unit_price),
      subtotal: toNumber(r.subtotal),
      vat_amount: toNumber(r.vat_amount),
      withholding_amount: toNumber(r.withholding_amount),
      total: toNumber(r.total),
    };
  });
}

export async function parseInvoiceLines(opts: {
  documentId: string;
  slot: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string | null;
}): Promise<InvoiceLineParseResult> {
  // Slot guard — only invoice-like slots are eligible.
  if (opts.slot !== 'WITHHOLDING_INVOICE' && opts.slot !== 'VAT_IN_OUT') {
    return {
      lines: [],
      mode: 'MOCK',
      modelVersion: 'wrong-slot-fallback',
      confidence: 0,
      reason: `slot=${opts.slot} not invoice-eligible`,
    };
  }
  if (!isLikelyRealStoragePath(opts.storagePath)) {
    return {
      lines: [],
      mode: 'MOCK',
      modelVersion: 'synthetic-path-fallback',
      confidence: 0,
      reason: 'storage_path does not look like a real file',
    };
  }
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your-')) {
    return {
      lines: [],
      mode: 'MOCK',
      modelVersion: 'no-api-key-fallback',
      confidence: 0,
      reason: 'ANTHROPIC_API_KEY not configured',
    };
  }

  const admin = getSupabaseAdmin();
  const { data: blob, error: dlErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(opts.storagePath);
  if (dlErr || !blob) {
    loggers.api.warn(
      { err: dlErr, documentId: opts.documentId, storagePath: opts.storagePath },
      'invoice parser: storage download failed',
    );
    return {
      lines: [],
      mode: 'MOCK',
      modelVersion: 'storage-miss-fallback',
      confidence: 0,
      reason: dlErr?.message ?? 'storage download failed',
    };
  }

  const arrayBuf = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString('base64');
  const { type, mediaType } = inferContentType(opts.originalFilename, opts.mimeType);

  const client = new Anthropic();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];
  if (type === 'document') {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    });
  } else if (type === 'image') {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    });
  } else {
    const text = Buffer.from(arrayBuf).toString('utf-8');
    content.push({
      type: 'text',
      text: `Original filename: ${opts.originalFilename}\nMime: ${mediaType}\n\nFile content:\n${text.slice(0, 60_000)}`,
    });
  }
  content.push({ type: 'text', text: PROMPT });

  let raw: string;
  try {
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: MAX_OUTPUT,
      messages: [{ role: 'user', content }],
    });
    const final = await stream.finalMessage();
    const block = final.content[0];
    if (block.type !== 'text') throw new Error('Non-text response from model');
    raw = block.text;
  } catch (e) {
    loggers.api.warn(
      { err: e, documentId: opts.documentId },
      'invoice parser: Claude call failed',
    );
    return {
      lines: [],
      mode: 'MOCK',
      modelVersion: 'claude-error-fallback',
      confidence: 0,
      reason: e instanceof Error ? e.message : 'claude error',
    };
  }

  let parsed: { lines?: unknown };
  try {
    parsed = JSON.parse(extractJson(raw)) as { lines?: unknown };
  } catch {
    loggers.api.warn(
      { documentId: opts.documentId, raw: raw.slice(0, 500) },
      'invoice parser: JSON parse failed',
    );
    return {
      lines: [],
      mode: 'MOCK',
      modelVersion: 'json-parse-fallback',
      confidence: 0,
      reason: 'model returned non-JSON output',
    };
  }

  const rowsRaw: unknown[] = Array.isArray(parsed.lines) ? parsed.lines : [];
  const lines = normalizeRows(rowsRaw);

  return {
    lines,
    mode: 'CLAUDE',
    modelVersion: `${MODEL}@2026-05`,
    confidence: lines.length > 0 ? 85 : 50,
    reason: null,
  };
}
