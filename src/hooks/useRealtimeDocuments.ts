'use client';

/**
 * Real-time Documents Hook
 *
 * Subscribe to document processing updates in real-time
 */

import { useEffect, useCallback, useState } from 'react';
import { subscribeToDocumentUpdates, type RealtimePayload } from '@/lib/realtime';

export type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface DocumentUpdate {
  id: string;
  customerId: string;
  fileName: string;
  fileType: string;
  category?: string;
  status?: DocumentStatus;
  ocrData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

interface UseRealtimeDocumentsOptions {
  customerId: string | null;
  onUpdate?: (update: DocumentUpdate) => void;
  enabled?: boolean;
}

export function useRealtimeDocuments({
  customerId,
  onUpdate,
  enabled = true,
}: UseRealtimeDocumentsOptions) {
  const [latestUpdate, setLatestUpdate] = useState<DocumentUpdate | null>(null);

  const handleDocumentUpdate = useCallback(
    (payload: RealtimePayload) => {
      const doc = payload.eventType === 'DELETE' ? payload.old : payload.new;
      if (!doc) return;

      const update: DocumentUpdate = {
        id: doc.id as string,
        customerId: doc.customer_id as string,
        fileName: doc.file_name as string,
        fileType: doc.file_type as string,
        category: doc.category as string | undefined,
        status: doc.ocr_status as DocumentStatus | undefined,
        ocrData: doc.ocr_data as Record<string, unknown> | undefined,
        createdAt: doc.created_at as string,
        updatedAt: doc.updated_at as string,
        eventType: payload.eventType,
      };

      setLatestUpdate(update);
      onUpdate?.(update);
    },
    [onUpdate]
  );

  useEffect(() => {
    if (!customerId || !enabled) return;

    const unsubscribe = subscribeToDocumentUpdates(customerId, handleDocumentUpdate);

    return () => {
      unsubscribe();
    };
  }, [customerId, enabled, handleDocumentUpdate]);

  return { latestUpdate };
}
