import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type {
  SignatureProvider,
  SignInput,
  SignResult,
  RequestMetadata,
  SignaturePurpose,
} from './types';

/**
 * Canvas-signature provider — the always-configured fallback.
 *
 * Writes the PNG bytes to Supabase Storage and returns a SHA256 hash +
 * storage path. The calling route.ts layer handles the signature_audit
 * row; this provider only owns the storage + hashing side.
 */

const BUCKET = 'signatures';
const MAX_BYTES = 1_000_000;
const MIN_BYTES = 200;

async function sha256Hex(buffer: Buffer): Promise<string> {
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; size: number } {
  const commaIdx = dataUrl.indexOf(',');
  const b64 = dataUrl.slice(commaIdx + 1);
  const buffer = Buffer.from(b64, 'base64');
  return { buffer, size: buffer.length };
}

export const canvasProvider: SignatureProvider = {
  id: 'canvas',
  isConfigured() {
    // Storage bucket is provisioned via the 20260418000001 migration; always on.
    return true;
  },
  async sign(params: {
    customerId: string;
    purpose: SignaturePurpose;
    input: SignInput;
    meta: RequestMetadata;
  }): Promise<SignResult> {
    if (params.input.kind !== 'canvas') {
      throw new Error('canvas provider requires canvas input');
    }
    const { buffer, size } = dataUrlToBuffer(params.input.dataUrl);
    if (size > MAX_BYTES) throw new Error('signature_too_large');
    if (size < MIN_BYTES) throw new Error('signature_too_small');

    const hashSha256 = await sha256Hex(buffer);
    const storagePath = `${params.customerId}/${hashSha256}-${Date.now()}.png`;

    const admin = getSupabaseAdmin();
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'image/png', upsert: false });
    if (error) {
      loggers.api.error({ err: error, customerId: params.customerId }, 'canvas signature upload failed');
      throw new Error('upload_failed');
    }

    return {
      provider: 'canvas',
      hashSha256,
      storagePath,
      externalRef: null,
      byteSize: size,
    };
  },
};
