/**
 * NotificationProvider — wires WebSocket, Zustand store, and React Query
 * together for real-time notification delivery.
 *
 * Place inside the authenticated layout so the JWT is available for
 * the WebSocket handshake.
 *
 * On mount:
 *   1. Fetches initial unread count via useUnreadCount() → syncs to store
 *   2. Fetches initial notifications via useNotifications() → syncs to store
 *   3. Connects WebSocket via useNotificationSocket()
 *
 * WebSocket event handlers:
 *   - notification:new → prepend to store, show toast if priority warrants it
 *   - notification:unread-count → update store count
 *
 * On unmount: WebSocket disconnects automatically (hook cleanup).
 */

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { useNotificationSocket, type NotificationPayload } from '@/hooks/use-notification-socket';
import { useNotificationStore, type Notification } from '@/stores/notification-store';

import { useNotifications } from './api/use-notifications';
import { useUnreadCount } from './api/use-unread-count';
import { showNotificationToast } from './components/notification-toast';

// ── Props ─────────────────────────────────────────────────────────────────────

interface NotificationProviderProps {
  children: ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: NotificationProviderProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Store actions (stable references via Zustand)
  const setNotifications = useNotificationStore((s) => s.setNotifications);
  const prependNotification = useNotificationStore((s) => s.prependNotification);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  // ── Initial data fetching ─────────────────────────────────────────────────

  const { data: unreadData } = useUnreadCount();
  const { data: notificationsData } = useNotifications();

  // Track when WebSocket last updated the unread count to avoid
  // the 60s REST poll overwriting a more recent WebSocket value.
  const wsCountUpdatedAtRef = useRef(0);

  // Sync unread count to store whenever React Query data updates,
  // but only if no WebSocket update happened in the last 5s.
  useEffect(() => {
    if (unreadData?.count !== undefined) {
      const wsAge = Date.now() - wsCountUpdatedAtRef.current;
      if (wsAge > 5_000) {
        setUnreadCount(unreadData.count);
      }
    }
  }, [unreadData?.count, setUnreadCount]);

  // Sync notification list to store whenever React Query data actually changes.
  // Use a ref to track the previous data reference and skip redundant updates
  // (select's flatMap creates new arrays on every render cycle).
  const prevNotificationsRef = useRef<typeof notificationsData>();
  useEffect(() => {
    if (notificationsData?.data && notificationsData !== prevNotificationsRef.current) {
      prevNotificationsRef.current = notificationsData;
      setNotifications(notificationsData.data);
    }
  }, [notificationsData, setNotifications]);

  // ── WebSocket event handlers ──────────────────────────────────────────────

  const handleNewNotification = useCallback(
    (payload: NotificationPayload) => {
      // Map WebSocket payload to store Notification type
      const notification: Notification = {
        id: payload.id,
        title: payload.title,
        body: payload.body,
        priority: payload.priority,
        actionUrl: payload.actionUrl,
        entityType: payload.entityType,
        entityId: payload.entityId,
        status: payload.status,
        createdAt: payload.createdAt,
      };

      // 1. Prepend to notification store
      prependNotification(notification);

      // 2. Show toast if priority warrants it
      showNotificationToast(notification, (url) => {
        void navigate({ to: url });
      });

      // 3. Invalidate React Query cache to keep in sync
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(),
      });
    },
    [prependNotification, navigate, queryClient],
  );

  const handleUnreadCount = useCallback(
    (count: number) => {
      wsCountUpdatedAtRef.current = Date.now();
      setUnreadCount(count);
    },
    [setUnreadCount],
  );

  const handleReconnect = useCallback(() => {
    // On reconnect, refetch unread count via REST to sync state
    void queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.unreadCount(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.list(),
    });
  }, [queryClient]);

  // ── WebSocket connection ──────────────────────────────────────────────────

  useNotificationSocket({
    onNotification: handleNewNotification,
    onUnreadCount: handleUnreadCount,
    onReconnect: handleReconnect,
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return <>{children}</>;
}
