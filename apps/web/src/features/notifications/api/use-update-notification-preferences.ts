/**
 * TanStack Query mutation hook for updating notification preferences.
 *
 * Uses `useMutation` against `PUT /notifications/preferences`.
 * Invalidates the preferences cache on success.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';
import { apiPut } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UpdatePreferenceItem {
  notificationTemplateId: string;
  enableInApp?: boolean;
  enableEmail?: boolean;
  enablePush?: boolean;
  priorityOverride?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | null;
  isMuted?: boolean;
  muteUntil?: string | null;
}

export interface UpdatePreferencesInput {
  preferences: UpdatePreferenceItem[];
}

interface UpdatePreferencesResponse {
  updated: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Mutation to bulk-upsert notification preferences.
 *
 * On success: invalidates preferences cache, shows success toast.
 * On error: shows error toast.
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const { t } = useI18n('notifications');

  return useMutation({
    mutationFn: async (input: UpdatePreferencesInput) => {
      const result = await apiPut<UpdatePreferencesResponse>('/notifications/preferences', input);
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('preferences.saveSuccess'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.preferences(),
      });
    },
    onError: () => {
      toast.error(t('preferences.saveError'));
    },
  });
}
