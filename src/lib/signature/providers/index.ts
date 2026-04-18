import 'server-only';
import { canvasProvider } from './canvas';
import { privyProvider } from './privy';
import { vidaProvider } from './vida';
import type { SignatureProvider, SignatureProviderId } from './types';

export type { SignatureProvider, SignatureProviderId, SignInput, SignResult, SignaturePurpose, RequestMetadata } from './types';

const REGISTRY: Record<SignatureProviderId, SignatureProvider> = {
  canvas: canvasProvider,
  privy: privyProvider,
  vida: vidaProvider,
};

/**
 * Resolve the provider for a given requested id, with automatic
 * fallback to canvas when the requested PSrE is not configured.
 *
 * The fallback is deliberate: if someone requests Privy in an
 * environment that lacks PRIVY_API_KEY (e.g., a preview deploy or
 * local dev), we MUST still be able to capture a signature — a POA
 * mandate can't just fail. `used` tells the caller what actually ran
 * so the UI can surface the downgrade to the user.
 */
export function resolveSignatureProvider(requested: SignatureProviderId): {
  provider: SignatureProvider;
  used: SignatureProviderId;
  degraded: boolean;
} {
  const direct = REGISTRY[requested];
  if (direct.isConfigured()) {
    return { provider: direct, used: requested, degraded: false };
  }
  // Fallback: canvas is always configured (bucket provisioned at migration time).
  return { provider: canvasProvider, used: 'canvas', degraded: true };
}

/** Ordered list of providers that are currently usable in this env. */
export function availableSignatureProviders(): SignatureProviderId[] {
  return (Object.keys(REGISTRY) as SignatureProviderId[]).filter((id) =>
    REGISTRY[id].isConfigured(),
  );
}
