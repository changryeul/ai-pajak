/**
 * Format an ISO timestamp for the audit timeline UI.
 *
 * Uses UTC + explicit suffix so SSR (Vercel functions in UTC) and client
 * hydration produce identical output — no React hydration mismatch.
 */
export function formatAuditTs(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
