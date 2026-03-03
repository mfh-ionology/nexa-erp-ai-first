/**
 * TanStack Query hook for fetching the unread notification count.
 *
 * Uses `useQuery` against `GET /notifications/unread-count`.
 * Polls every 60s as a fallback when WebSocket is disconnected.
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

// ── Types ────────────────────────────────────────────────────────────────────

interface UnreadCountData {
  count: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Query for the current user's unread notification count.
 *
 * Refetches every 60s as fallback polling in case WebSocket is disconnected.
 */
export function useUnreadCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async () => {
      const result = await apiGet<UnreadCountData>('/notifications/unread-count');
      return result.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });
}
