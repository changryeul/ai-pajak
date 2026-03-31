/**
 * Google Analytics event tracking helpers
 */

type GAEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

export function trackEvent({ action, category, label, value }: GAEvent) {
  if (typeof window === 'undefined') return;
  if (!(window as any).gtag) return;

  (window as any).gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
}

// Pre-defined events for AI Pajak
export const analytics = {
  // Auth events
  login: (method: string) => trackEvent({ action: 'login', category: 'auth', label: method }),
  signup: (method: string) => trackEvent({ action: 'sign_up', category: 'auth', label: method }),

  // SPT events
  sptStarted: (type: string) => trackEvent({ action: 'spt_started', category: 'tax', label: type }),
  sptCompleted: (type: string) => trackEvent({ action: 'spt_completed', category: 'tax', label: type }),
  sptDownloaded: (type: string) => trackEvent({ action: 'spt_downloaded', category: 'tax', label: type }),

  // AI events
  chatMessage: () => trackEvent({ action: 'chat_message', category: 'ai' }),
  ocrUpload: () => trackEvent({ action: 'ocr_upload', category: 'ai' }),
  savingsAnalysis: () => trackEvent({ action: 'savings_analysis', category: 'ai' }),

  // Tool events
  toolUsed: (toolName: string) => trackEvent({ action: 'tool_used', category: 'tools', label: toolName }),

  // Payment events
  planSelected: (plan: string) => trackEvent({ action: 'plan_selected', category: 'payment', label: plan }),
  paymentCompleted: (plan: string, amount: number) => trackEvent({ action: 'purchase', category: 'payment', label: plan, value: amount }),

  // Language change
  languageChanged: (locale: string) => trackEvent({ action: 'language_changed', category: 'settings', label: locale }),

  // Page views (auto-tracked by GA4, but custom ones)
  pageView: (path: string) => trackEvent({ action: 'page_view', category: 'navigation', label: path }),
};
