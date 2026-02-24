/**
 * TanStack Query hook for the User list (infinite / cursor-based pagination).
 *
 * Follows the same pattern as access-groups/api/use-access-groups.ts.
 */

import { useInfiniteQuery } from '@tanstack/react-query';

import { apiGet, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  UserListItem,
  UserListParams,
  UserListResponse,
} from './types';

// --- Hooks ---

/**
 * Infinite query for the user list page.
 * Supports cursor-based pagination and search filtering.
 */
export function useUsers(
  params: Omit<UserListParams, 'cursor'> = {},
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.system.usersInfinite(
      params as Record<string, unknown>,
    ),
    queryFn: async ({ pageParam }) => {
      const fullParams: UserListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/system/users${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<UserListItem[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      } as UserListResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.cursor : undefined,
    enabled: isAuthenticated,
    select: (queryData) => ({
      data: queryData.pages.flatMap((page) => page.data),
      pages: queryData.pages,
      pageParams: queryData.pageParams,
    }),
  });
}
