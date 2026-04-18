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
 * VIDA Sign provider — STUB.
 *
 * VIDA (PT Indonesia Digital Identity) is another Kominfo-certified
 * PSrE, commonly used by banks and the DJP itself. Same legal status
 * as Privy under UU ITE 11/2008.
 *
 * Integration path when credentials arrive:
 *   1. Set VIDA_CLIENT_ID + VIDA_CLIENT_SECRET + VIDA_ENV
 *   2. OAuth client-credentials flow against /oauth/token
 *   3. Call /sign/document with PDF + signer email + redirect URL
 *   4. Store the VIDA document_id as externalRef
 *   5. On webhook, update signature_audit.external_ref + hash
 *
 * Reference: https://developers.vida.id
 */

function envVar(name: string): string | null {
  const v = process.env[name];
  return v && v.length > 0 ? v : null;
}

export const vidaProvider: SignatureProvider = {
  id: 'vida',
  isConfigured() {
    return Boolean(envVar('VIDA_CLIENT_ID') && envVar('VIDA_CLIENT_SECRET'));
  },
  async sign(_params: {
    customerId: string;
    purpose: SignaturePurpose;
    input: SignInput;
    meta: RequestMetadata;
  }): Promise<SignResult> {
    if (!this.isConfigured()) {
      loggers.api.warn({}, 'vida provider requested but not configured');
      throw new Error('not_configured');
    }
    // TODO(T-009): implement when VIDA contract is signed.
    throw new Error('not_implemented');
  },
};
