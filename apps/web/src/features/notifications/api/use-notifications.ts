/**
 * TanStack Query hook for fetching notifications with cursor-based pagination.
 *
 * Uses `useInfiniteQuery` against `GET /notifications`.
 * Supports status filtering (PENDING, DELIVERED, READ, etc.).
 */

import { useInfiniteQuery } from '@tanstack/react-query';

import { apiGet, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';
import type { Notification } from '@/stores/notification-store';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NotificationListParams {
  status?: string;
  limit?: number;
  cursor?: string;
}

interface NotificationListData {
  items: Notification[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Infinite query for user notifications with cursor-based pagination.
 *
 * @param params - Optional status filter and limit (cursor managed internally)
 */
export function useNotifications(params: Omit<NotificationListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.notifications.list(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: NotificationListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/notifications${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<NotificationListData>(path);
      return result.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    enabled: isAuthenticated,
    select: (queryData) => ({
      data: queryData.pages.flatMap((page) => page.items),
      pages: queryData.pages,
      pageParams: queryData.pageParams,
    }),
  });
}
