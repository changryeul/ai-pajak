/**
 * Lightweight in-memory cache for onboarding redirect decisions.
 *
 * The middleware consults customer.{customer_type, onboarding_step} on every
 * page request to decide where an INDIVIDUAL customer should be sent. A naive
 * implementation would round-trip to Postgres on every navigation — at scale
 * that is noticeable. This cache holds the decision for 5 minutes per userId
 * which is well within tolerance (users advance onboarding rarely, and a
 * stale entry only costs one extra redirect).
 *
 * Scope: single Next.js runtime instance. On Vercel with multiple edge/runtime
 * instances each gets its own cache — that's fine, they converge on their own.
 */

export interface OnboardingState {
  customerType: 'INDIVIDUAL' | 'COMPANY' | null;
  onboardingStep: number | null;
}

interface Entry {
  state: OnboardingState;
  fetchedAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, Entry>();

export function getCached(userId: string): OnboardingState | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(userId);
    return null;
  }
  return entry.state;
}

export function setCached(userId: string, state: OnboardingState): void {
  cache.set(userId, { state, fetchedAt: Date.now() });
}

export function invalidate(userId: string): void {
  cache.delete(userId);
}
