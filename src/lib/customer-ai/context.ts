import type { ChatContext, ContextKind } from '@/types/customer-ai';

/**
 * Map current pathname → ChatContext (kind + period + UI label).
 *
 * Used by CustomerAiChat to derive which thread to find-or-create when
 * the customer opens the FAB on a given tax page. Falls back to OTHER
 * for non-tax pages so non-tax inquiries route to a single shared thread.
 */
export function detectContext(pathname: string, now: Date = new Date()): ChatContext {
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const rules: Array<{ re: RegExp; kind: ContextKind; label: (p: string) => string }> = [
    { re: /^\/[a-z]{2}\/tax\/pph21/, kind: 'PPH21', label: (p) => `PPh21 · ${p}` },
    { re: /^\/[a-z]{2}\/tax\/pph23/, kind: 'PPH23', label: (p) => `PPh23 · ${p}` },
    { re: /^\/[a-z]{2}\/tax\/ppn/,   kind: 'PPN',   label: (p) => `PPN · ${p}` },
    { re: /^\/[a-z]{2}\/tax\/annual/, kind: 'CLOSING', label: (p) => `결산 · ${p}` },
  ];

  for (const r of rules) {
    if (r.re.test(pathname)) {
      return { kind: r.kind, period, label: r.label(period) };
    }
  }
  return { kind: 'OTHER', period: 'OTHER', label: '일반 문의' };
}

/** Human-readable thread label for UI display (NOT stored in DB). */
export function buildDisplayLabel(
  customerId: string,
  contextKind: ContextKind,
  contextPeriod: string,
): string {
  const custTag = customerId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const periodTag = contextPeriod.replace(/-/g, '');
  return `MSG-${custTag}-${periodTag}-${contextKind}`;
}
