import 'server-only';
import { loggers } from '@/lib/logger';
import type {
  SignatureProvider,
  SignInput,
  SignResult,
  RequestMetadata,
  SignaturePurpose,
} from './types';

/**
 * Privy Digital Signature provider — STUB.
 *
 * Privy.id is a Kominfo-certified PSrE (Penyelenggara Sertifikasi
 * Elektronik). Using it here would upgrade every POA signature from
 * "evidence-of-intent" (UU ITE 11/2008 art. 5) to "sertifikasi
 * elektronik tersertifikasi" (art. 11) — i.e., probative parity with
 * a wet-ink signature in Indonesian courts.
 *
 * Integration path when credentials arrive:
 *   1. Set PRIVY_API_KEY + PRIVY_MERCHANT_KEY + PRIVY_ENV ('sandbox'|'production')
 *   2. Call Privy /merchant/document/create with the PDF to be signed
 *   3. Return document_id as externalRef
 *   4. Customer redirects to Privy web app, signs, webhook fires back
 *   5. On webhook, update signature_audit.external_ref with the finalised
 *      document id and store Privy's returned hash
 *
 * The stub throws `not_configured` so the factory falls back to canvas
 * with a clear error for diagnostics.
 *
 * Reference: https://developer.privy.id
 */

function envVar(name: string): string | null {
  const v = process.env[name];
  return v && v.length > 0 ? v : null;
}

export const privyProvider: SignatureProvider = {
  id: 'privy',
  isConfigured() {
    return Boolean(envVar('PRIVY_API_KEY') && envVar('PRIVY_MERCHANT_KEY'));
  },
  async sign(_params: {
    customerId: string;
    purpose: SignaturePurpose;
    input: SignInput;
    meta: RequestMetadata;
  }): Promise<SignResult> {
    if (!this.isConfigured()) {
      loggers.api.warn({}, 'privy provider requested but not configured');
      throw new Error('not_configured');
    }
    // TODO(T-009): implement when Privy contract is signed.
    //   const res = await fetch(`${privyBase()}/merchant/document/create`, { ... });
    //   const { document_id, hash } = await res.json();
    //   return { provider: 'privy', hashSha256: hash, storagePath: null, externalRef: document_id, byteSize: null };
    throw new Error('not_implemented');
  },
};
