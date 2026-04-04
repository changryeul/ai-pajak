/**
 * Cron Guard — checks if a cron job is enabled before execution
 * Also logs execution result to cron_settings table
 */

import { createClient } from '@supabase/supabase-js';
import { loggers } from '@/lib/logger';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Check if cron job is enabled. Returns false if disabled.
 */
export async function isCronEnabled(cronId: string): Promise<boolean> {
  try {
    const supabase = getAdminClient();
    const { data } = await supabase
      .from('cron_settings')
      .select('is_enabled')
      .eq('id', cronId)
      .single();

    // If no row found, assume enabled (backward compatible)
    if (!data) return true;
    return data.is_enabled;
  } catch {
    // If table doesn't exist or query fails, allow execution
    return true;
  }
}

/**
 * Log cron execution result
 */
export async function logCronResult(
  cronId: string,
  status: 'success' | 'error' | 'skipped',
  durationMs: number,
  result?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getAdminClient();
    await supabase
      .from('cron_settings')
      .update({
        last_run_at: new Date().toISOString(),
        last_status: status,
        last_duration_ms: durationMs,
        last_result: result || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cronId);
  } catch {
    loggers.api.warn({ cronId }, 'Failed to log cron result');
  }
}
