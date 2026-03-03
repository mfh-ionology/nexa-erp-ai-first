/**
 * TanStack Query mutation hook for resetting notification preferences to defaults.
 *
 * Sends `DELETE /notifications/preferences/reset` to remove all user-customised
 * preference records, falling back to role/template defaults.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';
import { apiDelete } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

// ── Types ────────────────────────────────────────────────────────────────────

interface ResetPreferencesResponse {
  deleted: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Mutation to reset all notification preferences to defaults.
 *
 * Deletes all user-customised NotificationPreference records so that
 * getPreferences falls back to role defaults / template defaults.
 *
 * On success: invalidates preferences cache, shows success toast.
 * On error: shows error toast.
 */
export function useResetNotificationPreferences() {
  const queryClient = useQueryClient();
  const { t } = useI18n('notifications');

  return useMutation({
    mutationFn: async () => {
      const result = await apiDelete<ResetPreferencesResponse>('/notifications/preferences/reset');
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('preferences.resetSuccess'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.preferences(),
      });
    },
    onError: () => {
      toast.error(t('preferences.resetError'));
    },
  });
}
