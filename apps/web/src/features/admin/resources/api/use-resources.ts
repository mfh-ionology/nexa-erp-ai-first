/**
 * TanStack Query hooks for the Resource Registry.
 *
 * Fetches resources from GET /system/resources with optional
 * filtering by module, type, and search text.
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

// --- Types ---

export interface Resource {
  id: string;
  code: string;
  name: string;
  module: string;
  type: 'PAGE' | 'REPORT' | 'SETTING' | 'MAINTENANCE';
  parentCode: string | null;
  sortOrder: number;
  icon: string | null;
  description: string | null;
  isActive: boolean;
}

export interface ResourceListParams {
  cursor?: string;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  module?: string;
  type?: string;
}

interface ResourceListMeta {
  cursor?: string;
  hasMore: boolean;
}

interface ResourceListResponse {
  data: Resource[];
  meta: ResourceListMeta;
}

// --- Helpers ---

/** Build query string from params, omitting empty/undefined values. */
function buildQueryString(params: ResourceListParams): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  const qs = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
  return `?${qs}`;
}

// --- Hooks ---

/**
 * Fetch a single page of resources.
 * Use `useResourcesInfinite` for cursor-based pagination in the UI.
 */
export function useResources(params: ResourceListParams = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.system.resources(params as Record<string, unknown>),
    queryFn: async () => {
      const path = `/system/resources${buildQueryString(params)}`;
      const result = await apiGet<Resource[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      } as ResourceListResponse;
    },
    enabled: isAuthenticated,
  });
}

/**
 * Infinite query for cursor-based pagination of resources.
 * Used by the Resource Registry page to support "Load More".
 */
export function useResourcesInfinite(
  params: Omit<ResourceListParams, 'cursor'> = {},
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.system.resourcesInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: ResourceListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const path = `/system/resources${buildQueryString(fullParams)}`;
      const result = await apiGet<Resource[]>(path);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      } as ResourceListResponse;
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
