/**
 * Signature-provider contract (PSrE pluggability).
 *
 * Kominfo-certified PSrE providers (Privy, VIDA) issue legally-binding
 * digital signatures under UU ITE 11/2008 art. 11 + PP 71/2019. Our
 * initial stack records canvas-drawn signatures with a SHA256 + IP + UA
 * audit trail (minimum-viable evidence) — good enough for non-DJP
 * internal mandates but NOT equivalent to a certified PSrE signature.
 *
 * This module sets up a clean boundary so a Privy or VIDA connector
 * can drop in without touching the signature route or the mandate UI.
 *
 * Why not ship one of them today: Privy/VIDA onboarding requires a
 * signed contract + per-signature pricing + a production-API key.
 * Until that is in place, canvas is the live provider and the PSrE
 * entries here are stubs that throw `not_configured`.
 */

export type SignatureProviderId = 'canvas' | 'privy' | 'vida';

export type SignaturePurpose =
  | 'POA_MANDATE'
  | 'SPT_SUBMISSION'
  | 'PROFILE_CHANGE'
  | 'OTHER';

/** Metadata from the HTTP request — IP + UA — forwarded to every provider. */
export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

/** Input to `sign()`. The shape matches whichever provider is active. */
export type SignInput =
  | {
      kind: 'canvas';
      /** `data:image/png;base64,...` from react-signature-canvas. */
      dataUrl: string;
    }
  | {
      kind: 'psre';
      /** Provider-issued transaction / document id. */
      providerRef: string;
      /** Optional provider-side hash of the signed document. */
      providerHash?: string;
    };

/** Shared output written to `signature_audit`. */
export interface SignResult {
  provider: SignatureProviderId;
  /** SHA256 hex of the signed bytes (canvas) or provider-returned hash (PSrE). */
  hashSha256: string;
  /** Supabase Storage path when applicable (canvas), null for PSrE. */
  storagePath: string | null;
  /** Provider-issued reference for PSrE (transaction id), null for canvas. */
  externalRef: string | null;
  /** Byte size of the signature payload (for canvas audit), optional. */
  byteSize: number | null;
}

export interface SignatureProvider {
  /** Provider identifier written to `signature_audit.external_provider`. */
  readonly id: SignatureProviderId;
  /** Whether the provider is configured and usable in this environment. */
  isConfigured(): boolean;
  /**
   * Persist a signature. Must throw `new Error('not_configured')` when
   * the provider has no credentials, so the caller can fall back to a
   * configured provider (typically 'canvas') with a clear error code.
   */
  sign(params: {
    customerId: string;
    purpose: SignaturePurpose;
    input: SignInput;
    meta: RequestMetadata;
  }): Promise<SignResult>;
}
