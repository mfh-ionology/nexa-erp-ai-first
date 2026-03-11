// ---------------------------------------------------------------------------
// AI Provider Management Hooks — Platform Admin
// Story E13b-4 Task 7.2
// ---------------------------------------------------------------------------

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPatch, apiPut } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { usePlatformAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types (mirrored from backend ai.schema.ts)
// ---------------------------------------------------------------------------

export interface VendorProvider {
  providerId: string;
  displayName: string;
  isActive: boolean;
  hasApiKey: boolean;
  lastUsedAt: string | null;
}

export interface UpdateProviderKeyResult {
  success: true;
  providerId: string;
  updatedAt: string;
}

export interface ToggleProviderResult {
  providerId: string;
  isActive: boolean;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** GET /admin/ai/providers — list vendor-level AI providers */
export function useAiProviders() {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiUsage.providers(),
    queryFn: async () => {
      const result = await apiGet<VendorProvider[]>('/admin/ai/providers');
      return result.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: isAuthenticated,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** PUT /admin/ai/providers/:providerId/key — update vendor API key */
export function useUpdateProviderKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ai-usage', 'updateProviderKey'],
    mutationFn: async ({ providerId, apiKey }: { providerId: string; apiKey: string }) => {
      const result = await apiPut<UpdateProviderKeyResult>(
        `/admin/ai/providers/${providerId}/key`,
        { apiKey },
      );
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiUsage.providers() });
    },
  });
}

/** PATCH /admin/ai/providers/:providerId — toggle provider active/inactive */
export function useToggleProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ai-usage', 'toggleProvider'],
    mutationFn: async ({ providerId, isActive }: { providerId: string; isActive: boolean }) => {
      const result = await apiPatch<ToggleProviderResult>(`/admin/ai/providers/${providerId}`, {
        isActive,
      });
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiUsage.providers() });
    },
  });
}
