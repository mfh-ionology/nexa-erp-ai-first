import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import { fetchViewInit } from '../api';
import type { ViewInitResponse } from '../types';

/**
 * Fetches the bundled view initialisation payload for a given viewKey.
 *
 * Returns DataView metadata, fields, date presets, saved views, and
 * user column preferences in a single request (`GET /views/init`).
 *
 * staleTime matches the global query client default (30s).
 */
export function useViewInit(viewKey: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<ViewInitResponse>({
    queryKey: queryKeys.views.init(viewKey),
    queryFn: () => fetchViewInit(viewKey),
    enabled: isAuthenticated && !!viewKey,
    staleTime: 30_000,
  });
}
