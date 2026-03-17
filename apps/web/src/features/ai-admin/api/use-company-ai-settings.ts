/**
 * TanStack Query mutation hook for updating company AI settings.
 *
 * - useUpdateCompanyAiSettings: Mutation to patch a single AI setting key/value
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPatch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

interface UpdateAiSettingRequest {
  key: string;
  value: unknown;
}

/**
 * Update a company AI setting.
 * On success: invalidates the setup status query so the wizard reflects the change.
 */
export function useUpdateCompanyAiSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateAiSettingRequest) => {
      const result = await apiPatch<void>('/system/company/ai-settings', data);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiAdmin.setupStatus(),
      });
    },
  });
}
