/**
 * TanStack Query hook for AI prompt variables.
 *
 * - useAiVariables: Query for all available prompt variables (grouped by source type).
 *   Used by the variable autocomplete in the automation step goal editor.
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type { AiVariablesGroupedResponse } from './types';

/**
 * Query for all available prompt variables, grouped by source type.
 * Fetches from GET /ai/variables.
 * Used by the variable autocomplete dropdown in step goal textareas (AC-6).
 */
export function useAiVariables() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.automationVariables(),
    queryFn: async () => {
      const result = await apiGet<AiVariablesGroupedResponse>('/ai/variables');
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // Variables change infrequently — cache for 5 minutes
  });
}
