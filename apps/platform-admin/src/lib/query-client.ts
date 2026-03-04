import { QueryClient } from '@tanstack/react-query';

import { usePlatformAuthStore } from '@/stores/auth-store';

/**
 * Global QueryClient for Platform Admin.
 *
 * Defaults tuned for intelligence dashboard workloads:
 * - staleTime 30s (data changes infrequently)
 * - gcTime 5min (keep cache warm)
 * - single retry on failure
 * - refetch on window focus for freshness
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
      onError: handleGlobalError,
    },
  },
});

/** On 401, trigger logout via auth store. */
function handleGlobalError(error: Error): void {
  if (
    error instanceof Error &&
    'statusCode' in error &&
    (error as { statusCode: number }).statusCode === 401
  ) {
    usePlatformAuthStore.getState().logout();
  }
}
