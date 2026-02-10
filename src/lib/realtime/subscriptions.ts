/**
 * Real-time Subscription Utilities
 *
 * Supabase Realtime subscriptions for live updates
 */

import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

// Types for real-time events
export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimePayload<T = Record<string, unknown>> {
  eventType: RealtimeEventType;
  new: T;
  old: T | null;
  table: string;
}

export type RealtimeCallback<T = Record<string, unknown>> = (payload: RealtimePayload<T>) => void;

// Store active channels
const channels: Map<string, RealtimeChannel> = new Map();

// Singleton client
let realtimeClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client for realtime
 */
function getRealtimeClient(): SupabaseClient {
  if (!realtimeClient) {
    realtimeClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return realtimeClient;
}

/**
 * Subscribe to table changes
 */
export function subscribeToTable<T = Record<string, unknown>>(
  tableName: string,
  callback: RealtimeCallback<T>,
  filter?: {
    event?: RealtimeEventType | '*';
    filter?: string; // e.g., 'user_id=eq.123'
  }
): () => void {
  const client = getRealtimeClient();
  const channelKey = `${tableName}-${filter?.filter || 'all'}`;

  // Remove existing channel if any
  if (channels.has(channelKey)) {
    const existingChannel = channels.get(channelKey);
    existingChannel?.unsubscribe();
    channels.delete(channelKey);
  }

  const channel = client.channel(channelKey);

  // Use type assertion to bypass strict type checking for postgres_changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (channel as any).on(
    'postgres_changes',
    {
      event: filter?.event || '*',
      schema: 'public',
      table: tableName,
      filter: filter?.filter,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (payload: any) => {
      callback({
        eventType: payload.eventType as RealtimeEventType,
        new: payload.new as T,
        old: (payload.old as T) || null,
        table: tableName,
      });
    }
  );

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.info(`[Realtime] Subscribed to ${tableName}`);
    } else if (status === 'CHANNEL_ERROR') {
      console.error(`[Realtime] Error subscribing to ${tableName}`);
    }
  });

  channels.set(channelKey, channel);

  // Return unsubscribe function
  return () => {
    channel.unsubscribe();
    channels.delete(channelKey);
  };
}

/**
 * Subscribe to notification updates
 */
export function subscribeToNotifications(
  userId: string,
  callback: RealtimeCallback
): () => void {
  return subscribeToTable('notification', callback, {
    event: 'INSERT',
    filter: `user_id=eq.${userId}`,
  });
}

/**
 * Subscribe to filing status updates
 */
export function subscribeToFilingUpdates(
  customerId: string,
  callback: RealtimeCallback
): () => void {
  return subscribeToTable('tax_filing', callback, {
    event: 'UPDATE',
    filter: `customer_id=eq.${customerId}`,
  });
}

/**
 * Subscribe to document processing updates
 */
export function subscribeToDocumentUpdates(
  customerId: string,
  callback: RealtimeCallback
): () => void {
  return subscribeToTable('document', callback, {
    filter: `customer_id=eq.${customerId}`,
  });
}

/**
 * Subscribe to POA status updates
 */
export function subscribeToPOAUpdates(
  customerId: string,
  callback: RealtimeCallback
): () => void {
  return subscribeToTable('power_of_attorney', callback, {
    filter: `customer_id=eq.${customerId}`,
  });
}

/**
 * Unsubscribe from all channels
 */
export function unsubscribeAll(): void {
  channels.forEach((channel, key) => {
    channel.unsubscribe();
    channels.delete(key);
  });
}
