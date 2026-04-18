'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Options<T> {
  /** Debounce in ms. 300 per PR1 plan. */
  delay?: number;
  /** Called with the latest payload once the debounce fires. Server must be idempotent. */
  save: (value: T) => Promise<void>;
  /**
   * Skip the very first effect — avoids a save on mount when the form just
   * hydrated from the server. Default true.
   */
  skipFirst?: boolean;
  /**
   * When false, all saves are suppressed. Use this to gate autosave on an
   * async seed fetch (render with defaults → fetch server state → flip enabled)
   * so the defaults never overwrite the persisted values.
   * Default true (backwards compatible).
   */
  enabled?: boolean;
}

/**
 * Debounced auto-save with an explicit status state.
 *
 * Status transitions:
 *   idle → saving → saved   (happy path; resets to idle after ~1.2s)
 *   idle → saving → error   (last save failed; user keeps editing to retry)
 *
 * The hook never retries automatically on failure — the user is in control
 * and the /settings UI shows an explicit retry button.
 */
export function useAutoSave<T>(value: T, options: Options<T>): {
  status: AutoSaveStatus;
  retry: () => void;
} {
  const { delay = 300, save, skipFirst = true, enabled = true } = options;
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const isFirstRun = useRef(skipFirst);
  const latestValue = useRef(value);
  const savedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync so `retry()` always uses the freshest payload.
  latestValue.current = value;

  const doSave = useCallback(async (payload: T) => {
    setStatus('saving');
    try {
      await save(payload);
      setStatus('saved');
      if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
      savedResetTimer.current = setTimeout(() => setStatus('idle'), 1200);
    } catch {
      setStatus('error');
    }
  }, [save]);

  useEffect(() => {
    if (!enabled) return;
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void doSave(latestValue.current);
    }, delay);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay, doSave, enabled]);

  // Cleanup reset timer on unmount
  useEffect(() => {
    return () => {
      if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
    };
  }, []);

  const retry = useCallback(() => {
    void doSave(latestValue.current);
  }, [doSave]);

  return { status, retry };
}
