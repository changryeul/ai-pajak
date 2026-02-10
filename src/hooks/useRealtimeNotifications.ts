'use client';

/**
 * Real-time Notifications Hook
 *
 * Subscribe to notification updates in real-time
 */

import { useEffect, useCallback, useState } from 'react';
import { subscribeToNotifications, type RealtimePayload } from '@/lib/realtime';
import type { Notification } from '@/lib/notifications/types';

interface UseRealtimeNotificationsOptions {
  userId: string | null;
  onNewNotification?: (notification: Notification) => void;
  enabled?: boolean;
}

export function useRealtimeNotifications({
  userId,
  onNewNotification,
  enabled = true,
}: UseRealtimeNotificationsOptions) {
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null);

  const handleNotification = useCallback(
    (payload: RealtimePayload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        const data = payload.new;
        const notification: Notification = {
          id: data.id as string,
          userId: data.user_id as string,
          type: data.type as Notification['type'],
          priority: data.priority as Notification['priority'],
          title: data.title as string,
          message: data.message as string,
          data: data.data as Record<string, unknown> | undefined,
          channels: data.channels as Notification['channels'],
          read: data.read as boolean,
          readAt: data.read_at as string | undefined,
          createdAt: data.created_at as string,
          expiresAt: data.expires_at as string | undefined,
        };

        setLatestNotification(notification);
        onNewNotification?.(notification);
      }
    },
    [onNewNotification]
  );

  useEffect(() => {
    if (!userId || !enabled) return;

    const unsubscribe = subscribeToNotifications(userId, handleNotification);

    return () => {
      unsubscribe();
    };
  }, [userId, enabled, handleNotification]);

  return { latestNotification };
}
