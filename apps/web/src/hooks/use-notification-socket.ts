// ---------------------------------------------------------------------------
// Notification WebSocket Hook — Socket.io client for real-time notifications
// E9-2 Task 3.2
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuthStore } from '@/stores/auth-store';

// ─── Notification payload type (matches server notification:new event) ───────

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  status: 'DELIVERED';
  createdAt: string;
}

export interface UnreadCountPayload {
  count: number;
}

// ─── Hook options ────────────────────────────────────────────────────────────

export interface UseNotificationSocketOptions {
  onNotification: (notification: NotificationPayload) => void;
  onUnreadCount: (count: number) => void;
  /** Called on reconnect so the caller can re-sync state via REST */
  onReconnect?: () => void;
}

// ─── Hook return ─────────────────────────────────────────────────────────────

export interface UseNotificationSocketReturn {
  isConnected: boolean;
}

// ─── Connection URL ──────────────────────────────────────────────────────────

function getSocketUrl(): string {
  return (
    import.meta.env.VITE_API_WS_URL ?? import.meta.env.VITE_API_BASE_URL ?? window.location.origin
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Connects to the notification Socket.io namespace and dispatches events
 * to the provided callbacks.
 *
 * - Authenticates via `auth.token` handshake (JWT from auth store)
 * - Listens for `notification:new` and `notification:unread-count` events
 * - Handles reconnection: invokes `onReconnect` so the caller can fetch
 *   the latest unread count via REST to sync state
 * - Disconnects on unmount
 * - Reconnects when the access token changes
 */
export function useNotificationSocket({
  onNotification,
  onUnreadCount,
  onReconnect,
}: UseNotificationSocketOptions): UseNotificationSocketReturn {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Use refs for callbacks to avoid reconnecting when callbacks change
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;
  const onUnreadCountRef = useRef(onUnreadCount);
  onUnreadCountRef.current = onUnreadCount;
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  const connect = useCallback(
    (token: string) => {
      // Disconnect existing socket if any
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const url = getSocketUrl();

      const socket = io(`${url}/notifications`, {
        path: '/api/v1/notifications/ws',
        transports: ['websocket', 'polling'],
        auth: { token },
        autoConnect: true,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      // On reconnect, call onReconnect so the caller can re-sync via REST
      socket.io.on('reconnect', () => {
        onReconnectRef.current?.();
      });

      socket.on('notification:new', (payload: NotificationPayload) => {
        onNotificationRef.current(payload);
      });

      socket.on('notification:unread-count', (payload: UnreadCountPayload) => {
        onUnreadCountRef.current(payload.count);
      });
    },
    [], // No dependencies — callbacks are accessed via refs
  );

  useEffect(() => {
    if (!accessToken) {
      // No token — disconnect if connected
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    connect(accessToken);

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [accessToken, connect]);

  return { isConnected };
}
