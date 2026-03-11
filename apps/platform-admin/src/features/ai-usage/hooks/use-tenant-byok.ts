// ---------------------------------------------------------------------------
// Tenant BYOK Key Management Hooks — Platform Admin
// Story E13b-4 Task 7.4
// ---------------------------------------------------------------------------

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiDelete, apiGet, apiPatch, apiPut } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { usePlatformAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types (mirrored from backend ai.schema.ts)
// ---------------------------------------------------------------------------

export interface ByokKey {
  providerId: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface AddByokKeyResult {
  tenantId: string;
  providerId: string;
  isActive: boolean;
  createdAt: string;
}

export interface DeleteByokKeyResult {
  tenantId: string;
  providerId: string;
  deleted: true;
}

export interface ToggleByokKeyResult {
  tenantId: string;
  providerId: string;
  isActive: boolean;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** GET /admin/tenants/:id/ai/byok — list tenant BYOK keys */
export function useTenantByokKeys(tenantId: string) {
  const isAuthenticated = usePlatformAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiUsage.tenantByok(tenantId),
    queryFn: async () => {
      const result = await apiGet<ByokKey[]>(`/admin/tenants/${tenantId}/ai/byok`);
      return result.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: isAuthenticated && !!tenantId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** PUT /admin/tenants/:id/ai/byok/:providerId — add or update BYOK key */
export function useAddByokKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ai-usage', 'addByokKey'],
    mutationFn: async ({
      tenantId,
      providerId,
      apiKey,
    }: {
      tenantId: string;
      providerId: string;
      apiKey: string;
    }) => {
      const result = await apiPut<AddByokKeyResult>(
        `/admin/tenants/${tenantId}/ai/byok/${providerId}`,
        { apiKey },
      );
      return result.data;
    },
    onSuccess: (_data, { tenantId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiUsage.tenantByok(tenantId) });
    },
  });
}

/** DELETE /admin/tenants/:id/ai/byok/:providerId — remove BYOK key */
export function useRemoveByokKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ai-usage', 'removeByokKey'],
    mutationFn: async ({ tenantId, providerId }: { tenantId: string; providerId: string }) => {
      const result = await apiDelete<DeleteByokKeyResult>(
        `/admin/tenants/${tenantId}/ai/byok/${providerId}`,
      );
      return result.data;
    },
    onSuccess: (_data, { tenantId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiUsage.tenantByok(tenantId) });
    },
  });
}

/** PATCH /admin/tenants/:id/ai/byok/:providerId — toggle BYOK key active/inactive */
export function useToggleByokKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ai-usage', 'toggleByokKey'],
    mutationFn: async ({
      tenantId,
      providerId,
      isActive,
    }: {
      tenantId: string;
      providerId: string;
      isActive: boolean;
    }) => {
      const result = await apiPatch<ToggleByokKeyResult>(
        `/admin/tenants/${tenantId}/ai/byok/${providerId}`,
        { isActive },
      );
      return result.data;
    },
    onSuccess: (_data, { tenantId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiUsage.tenantByok(tenantId) });
    },
  });
}
