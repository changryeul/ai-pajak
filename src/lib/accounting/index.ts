/**
 * Accounting provider factory
 * Use getProvider('ACCURATE') or getProvider('MEKARI') to access a unified interface.
 */
import { accurateProvider } from './providers/accurate';
import { mekariProvider } from './providers/mekari';
import type { AccountingProvider, AccountingProviderId } from './types';

const PROVIDERS: Record<AccountingProviderId, AccountingProvider> = {
  ACCURATE: accurateProvider,
  MEKARI: mekariProvider,
};

export function getProvider(id: AccountingProviderId): AccountingProvider {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(`Unknown accounting provider: ${id}`);
  }
  return provider;
}

export function listProviders(): Array<{ id: AccountingProviderId; displayName: string }> {
  return Object.values(PROVIDERS).map(p => ({ id: p.id, displayName: p.displayName }));
}

export type { AccountingProvider, AccountingProviderId, ConnectionCredentials, NormalizedInvoice } from './types';
