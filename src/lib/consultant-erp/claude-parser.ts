/**
 * Claude Sonnet 4.6 parser for Consultant ERP source documents.
 *
 * Fetches the document from Supabase Storage, sends it to Anthropic with the
 * slot-specific prompt, and returns the extracted rows. Falls back to the
 * P3 mvp mock when the file cannot be fetched (e.g. dev fixtures with fake
 * storage paths), so the surrounding UI keeps working.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { promptForSlot } from './parsing-prompts';
import { getMockRowsForSlot, type MockRow } from './mock-parser';

const STORAGE_BUCKET = 'consultant-erp-docs';
const MODEL = 'claude-sonnet-4-6';
const MAX_OUTPUT = 12_000;

interface ClaudeParseResult {
  rows: MockRow[];
  mode: 'CLAUDE' | 'MOCK';
  modelVersion: string;
  confidence: number;
  reason: string | null;
}

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
  // Real upload paths start with the session UUID and end with a file
  // extension. Mock paths used by the P3 mvp were synthetic placeholders.
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

export async function parseConsultantDocument(opts: {
  documentId: string;
  slot: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string | null;
}): Promise<ClaudeParseResult> {
  const prompt = promptForSlot(opts.slot);
  if (!prompt) {
    return {
      rows: getMockRowsForSlot(opts.slot),
      mode: 'MOCK',
      modelVersion: 'no-prompt-fallback',
      confidence: 60,
      reason: `No prompt configured for slot=${opts.slot}`,
    };
  }
  if (!isLikelyRealStoragePath(opts.storagePath)) {
    return {
      rows: getMockRowsForSlot(opts.slot),
      mode: 'MOCK',
      modelVersion: 'synthetic-path-fallback',
      confidence: 50,
      reason: 'storage_path does not look like a real file',
    };
  }
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your-')) {
    return {
      rows: getMockRowsForSlot(opts.slot),
      mode: 'MOCK',
      modelVersion: 'no-api-key-fallback',
      confidence: 50,
      reason: 'ANTHROPIC_API_KEY not configured',
    };
  }

  // 1. Download from storage.
  const admin = getSupabaseAdmin();
  const { data: blob, error: dlErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(opts.storagePath);
  if (dlErr || !blob) {
    loggers.api.warn(
      { err: dlErr, documentId: opts.documentId, storagePath: opts.storagePath },
      'storage download failed, falling back to mock',
    );
    return {
      rows: getMockRowsForSlot(opts.slot),
      mode: 'MOCK',
      modelVersion: 'storage-miss-fallback',
      confidence: 40,
      reason: dlErr?.message ?? 'storage download failed',
    };
  }

  const arrayBuf = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString('base64');
  const { type, mediaType } = inferContentType(opts.originalFilename, opts.mimeType);

  // 2. Build message content
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
    // For text/Excel/CSV: decode UTF-8 if possible
    const text = Buffer.from(arrayBuf).toString('utf-8');
    content.push({
      type: 'text',
      text: `Original filename: ${opts.originalFilename}\nMime: ${mediaType}\n\nFile content:\n${text.slice(0, 60_000)}`,
    });
  }
  content.push({ type: 'text', text: prompt });

  // 3. Call Claude
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
      { err: e, documentId: opts.documentId, slot: opts.slot },
      'Claude call failed, falling back to mock',
    );
    return {
      rows: getMockRowsForSlot(opts.slot),
      mode: 'MOCK',
      modelVersion: 'claude-error-fallback',
      confidence: 40,
      reason: e instanceof Error ? e.message : 'claude error',
    };
  }

  // 4. Parse JSON → row[]
  let parsed: { rows?: unknown } | unknown[];
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    loggers.api.warn(
      { documentId: opts.documentId, slot: opts.slot, raw: raw.slice(0, 500) },
      'Claude JSON parse failed, falling back to mock',
    );
    return {
      rows: getMockRowsForSlot(opts.slot),
      mode: 'MOCK',
      modelVersion: 'json-parse-fallback',
      confidence: 40,
      reason: 'model returned non-JSON output',
    };
  }
  const rowsRaw: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { rows?: unknown[] }).rows)
      ? (parsed as { rows: unknown[] }).rows
      : [];

  const rows: MockRow[] = rowsRaw.map((r, i) => {
    const obj = (r as Record<string, unknown>) ?? {};
    const label =
      (obj.employeeName as string)
      ?? (obj.counterpartyName as string)
      ?? (obj.fakturNo as string)
      ?? (obj.description as string)
      ?? `Row ${i + 1}`;
    return { rowIndex: i + 1, entityLabel: label, fields: obj };
  });

  return {
    rows,
    mode: 'CLAUDE',
    modelVersion: `${MODEL}@2026-05`,
    confidence: 88,
    reason: null,
  };
}
