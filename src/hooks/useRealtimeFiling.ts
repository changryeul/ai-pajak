'use client';

/**
 * Real-time Filing Hook
 *
 * Subscribe to tax filing status updates in real-time
 */

import { useEffect, useCallback, useState } from 'react';
import { subscribeToFilingUpdates, type RealtimePayload } from '@/lib/realtime';

export type FilingStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'IN_REVIEW'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PAID';

interface FilingUpdate {
  id: string;
  customerId: string;
  taxType: string;
  taxPeriod: string;
  status: FilingStatus;
  previousStatus?: FilingStatus;
  submittedAt?: string;
  updatedAt: string;
}

interface UseRealtimeFilingOptions {
  customerId: string | null;
  onStatusChange?: (update: FilingUpdate) => void;
  enabled?: boolean;
}

export function useRealtimeFiling({
  customerId,
  onStatusChange,
  enabled = true,
}: UseRealtimeFilingOptions) {
  const [latestUpdate, setLatestUpdate] = useState<FilingUpdate | null>(null);

  const handleFilingUpdate = useCallback(
    (payload: RealtimePayload) => {
      if (payload.eventType === 'UPDATE' && payload.new) {
        const data = payload.new;
        const update: FilingUpdate = {
          id: data.id as string,
          customerId: data.customer_id as string,
          taxType: data.tax_type as string,
          taxPeriod: data.tax_period as string,
          status: data.status as FilingStatus,
          previousStatus: payload.old?.status as FilingStatus | undefined,
          submittedAt: data.submitted_at as string | undefined,
          updatedAt: data.updated_at as string,
        };

        setLatestUpdate(update);
        onStatusChange?.(update);
      }
    },
    [onStatusChange]
  );

  useEffect(() => {
    if (!customerId || !enabled) return;

    const unsubscribe = subscribeToFilingUpdates(customerId, handleFilingUpdate);

    return () => {
      unsubscribe();
    };
  }, [customerId, enabled, handleFilingUpdate]);

  return { latestUpdate };
}
