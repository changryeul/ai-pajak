/**
 * AI Usage Tracker — Logs token usage and cost for monitoring
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';

// Approximate pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
};

export interface AIUsageParams {
  userId?: string;
  customerId?: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
}

export async function logAIUsage(params: AIUsageParams): Promise<void> {
  const pricing = MODEL_PRICING[params.model] || { input: 5.0, output: 15.0 };
  const costUsd = (params.inputTokens * pricing.input + params.outputTokens * pricing.output) / 1_000_000;

  try {
    await getSupabaseAdmin().from('ai_usage_log').insert({
      user_id: params.userId || null,
      customer_id: params.customerId || null,
      feature: params.feature,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      total_tokens: params.inputTokens + params.outputTokens,
      cost_usd: costUsd,
      duration_ms: params.durationMs || null,
      success: params.success ?? true,
      error_message: params.errorMessage || null,
    });
  } catch {
    // Non-blocking — don't fail the request if logging fails
  }
}
