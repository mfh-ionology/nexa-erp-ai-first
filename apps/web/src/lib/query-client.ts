import { QueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';

import { ApiError } from './api-errors';

/**
 * Global QueryClient singleton for TanStack Query.
 *
 * Defaults tuned for ERP workloads:
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

/**
 * Global error handler.
 * On 401 (unauthorised) responses, trigger logout via auth store.
 */
function handleGlobalError(error: Error): void {
  if (error instanceof ApiError && error.statusCode === 401) {
    useAuthStore.getState().logout();
  }
}
