/**
 * TanStack Query hooks for managing role-based notification defaults (ADMIN only).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { apiGet, apiPut } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RoleDefaultItem {
  templateId: string;
  templateCode: string;
  templateName: string;
  eventName: string;
  defaultChannels: Array<'IN_APP' | 'EMAIL' | 'PUSH'>;
  enableInApp: boolean;
  enableEmail: boolean;
  enablePush: boolean;
  hasRoleDefault: boolean;
}

interface RoleDefaultsResponse {
  role: string;
  items: RoleDefaultItem[];
}

interface UpdateRoleDefaultsInput {
  role: string;
  preferences: Array<{
    notificationTemplateId: string;
    enableInApp: boolean;
    enableEmail: boolean;
    enablePush: boolean;
  }>;
}

// ── Query Hook ───────────────────────────────────────────────────────────────

export function useRoleDefaults(role: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.notifications.roleDefaults(role),
    queryFn: async () => {
      const result = await apiGet<RoleDefaultsResponse>(
        `/notifications/preferences/role-defaults?role=${encodeURIComponent(role)}`,
      );
      return result.data;
    },
    enabled: isAuthenticated && !!role,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Mutation Hook ────────────────────────────────────────────────────────────

export function useUpdateRoleDefaults() {
  const queryClient = useQueryClient();
  const { t } = useI18n('notifications');

  return useMutation({
    mutationFn: async (input: UpdateRoleDefaultsInput) => {
      const result = await apiPut<{ updated: number }>(
        '/notifications/preferences/role-defaults',
        input,
      );
      return result.data;
    },
    onSuccess: (_data, variables) => {
      toast.success(t('preferences.roleDefaults.saveSuccess'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.roleDefaults(variables.role),
      });
    },
    onError: () => {
      toast.error(t('preferences.roleDefaults.saveError'));
    },
  });
}
