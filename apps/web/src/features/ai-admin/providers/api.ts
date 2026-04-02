import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiGet, apiPut, apiDelete } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

export interface ProviderStatus {
  id: string;
  name: string;
  description: string;
  hasKey: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
}

export function useProviderStatus() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.providers(),
    queryFn: async () => {
      const result = await apiGet<ProviderStatus[]>('/ai/admin/providers');
      return result.data;
    },
    enabled: isAuthenticated,
  });
}

export function useSetProviderKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ providerId, apiKey }: { providerId: string; apiKey: string }) => {
      const result = await apiPut<{ providerId: string; status: string }>(
        `/ai/admin/providers/${providerId}/key`,
        { apiKey },
      );
      return result.data;
    },
    onSuccess: (_data, variables) => {
      toast.success(`${variables.providerId} API key saved`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdmin.providers() });
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast.error(err.message ?? 'Failed to save API key');
    },
  });
}

export function useRemoveProviderKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (providerId: string) => {
      await apiDelete(`/ai/admin/providers/${providerId}/key`);
    },
    onSuccess: (_data, providerId) => {
      toast.success(`${providerId} API key removed`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdmin.providers() });
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast.error(err.message ?? 'Failed to remove API key');
    },
  });
}
