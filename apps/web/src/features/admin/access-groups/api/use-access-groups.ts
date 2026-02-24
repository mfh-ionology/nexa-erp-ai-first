/**
 * TanStack Query hooks for Access Group queries.
 *
 * - useAccessGroups: infinite query for the list page (cursor-based pagination)
 * - useAccessGroup: single detail query with permissions and field overrides
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import { apiGet, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  AccessGroup,
  AccessGroupDetail,
  AccessGroupListParams,
  AccessGroupListResponse,
} from './types';

// --- Hooks ---

/**
 * Infinite query for the access group list page.
 * Supports cursor-based pagination and search filtering.
 */
export function useAccessGroups(
  params: Omit<AccessGroupListParams, 'cursor'> = {},
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.system.accessGroupsInfinite(
      params as Record<string, unknown>,
    ),
    queryFn: async ({ pageParam }) => {
      const fullParams: AccessGroupListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/system/access-groups${buildQueryString(fullParams as Record<string, unknown>)}`;
      const result = await apiGet<AccessGroup[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      } as AccessGroupListResponse;
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

/**
 * Single access group detail query.
 * Returns the full AccessGroupDetail including permissions and field overrides.
 * Enabled only when `id` is truthy.
 */
export function useAccessGroup(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.system.accessGroup(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<AccessGroupDetail>(
        `/system/access-groups/${id}`,
      );
      return result.data;
    },
    enabled: isAuthenticated && !!id,
  });
}
