'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ClosingDocument {
  id: string;
  session_id: string;
  doc_type: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
}

export interface ClosingAdjustmentEntry {
  id: string;
  session_id: string;
  direction: 'POSITIVE' | 'NEGATIVE';
  item_code: string;
  amount: number;
  cap_pct: number | null;
  note: string | null;
}

export interface ClosingSession {
  id: string;
  customer_id: string;
  fiscal_year: number;
  closing_type: 'UMKM' | 'PPH25';
  current_step: string;
  data: Record<string, unknown>;
  signed_statements_uploaded: boolean;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
}

interface State {
  loading: boolean;
  session: ClosingSession | null;
  documents: ClosingDocument[];
  adjustments: ClosingAdjustmentEntry[];
  error: string | null;
}

interface Options {
  fiscalYear: number;
  closingType: 'UMKM' | 'PPH25';
  /** When false, hook stays idle (e.g. waiting for session info to be ready) */
  enabled?: boolean;
}

/**
 * Loads (or creates) the annual-closing session for the given fiscal year +
 * closing type, and exposes helpers for persisting wizard state, uploading
 * documents, and saving Koreksi Fiskal entries.
 */
export function useClosingSession({ fiscalYear, closingType, enabled = true }: Options) {
  const [state, setState] = useState<State>({
    loading: enabled,
    session: null,
    documents: [],
    adjustments: [],
    error: null,
  });
  const inflightPatch = useRef<AbortController | null>(null);

  const refresh = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/tax/annual-closing/${sessionId}`, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'load failed');
    setState((s) => ({
      ...s,
      session: json.data.session,
      documents: json.data.documents ?? [],
      adjustments: json.data.adjustments ?? [],
      loading: false,
      error: null,
    }));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let aborted = false;
    (async () => {
      try {
        const createRes = await fetch('/api/tax/annual-closing', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fiscalYear, closingType }),
        });
        const createJson = await createRes.json();
        if (!createJson.success) throw new Error(createJson.error || 'create failed');
        const sessionId = createJson.data.id;
        if (aborted) return;
        await refresh(sessionId);
      } catch (err) {
        if (aborted) return;
        const msg = err instanceof Error ? err.message : 'load failed';
        setState((s) => ({ ...s, loading: false, error: msg }));
      }
    })();
    return () => { aborted = true; };
  }, [fiscalYear, closingType, enabled, refresh]);

  /** Patch session fields. Cancels any in-flight request to keep last-write-wins. */
  const patch = useCallback(
    async (updates: {
      currentStep?: string;
      data?: Record<string, unknown>;
      signedStatementsUploaded?: boolean;
      status?: 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
    }) => {
      const sessionId = state.session?.id;
      if (!sessionId) return null;
      inflightPatch.current?.abort();
      const ctrl = new AbortController();
      inflightPatch.current = ctrl;
      try {
        const res = await fetch(`/api/tax/annual-closing/${sessionId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!json.success) return null;
        setState((s) => ({ ...s, session: json.data }));
        return json.data as ClosingSession;
      } catch {
        return null;
      }
    },
    [state.session?.id]
  );

  const uploadDocument = useCallback(
    async (docType: string, file: File): Promise<ClosingDocument | null> => {
      const sessionId = state.session?.id;
      if (!sessionId) return null;
      const fd = new FormData();
      fd.append('docType', docType);
      fd.append('file', file);
      const res = await fetch(`/api/tax/annual-closing/${sessionId}/document`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const json = await res.json();
      if (!json.success) return null;
      // Refresh to pick up potential session flag changes (signed statements).
      await refresh(sessionId);
      return json.data as ClosingDocument;
    },
    [state.session?.id, refresh]
  );

  const deleteDocument = useCallback(
    async (docId: string): Promise<boolean> => {
      const sessionId = state.session?.id;
      if (!sessionId) return false;
      const res = await fetch(`/api/tax/annual-closing/${sessionId}/document/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) return false;
      await refresh(sessionId);
      return true;
    },
    [state.session?.id, refresh]
  );

  const saveAdjustments = useCallback(
    async (
      entries: { direction: 'POSITIVE' | 'NEGATIVE'; itemCode: string; amount: number; capPct?: number | null }[]
    ) => {
      const sessionId = state.session?.id;
      if (!sessionId) return false;
      const res = await fetch(`/api/tax/annual-closing/${sessionId}/adjustments`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const json = await res.json();
      if (!json.success) return false;
      await refresh(sessionId);
      return true;
    },
    [state.session?.id, refresh]
  );

  return {
    ...state,
    patch,
    uploadDocument,
    deleteDocument,
    saveAdjustments,
  };
}
