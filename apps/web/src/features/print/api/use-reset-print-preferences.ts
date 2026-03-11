/**
 * TanStack Query mutation hook for resetting print preferences to defaults.
 *
 * Sends `DELETE /system/print-preferences/reset` to remove all user-customised
 * preference records, falling back to company defaults / NONE.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';
import { apiDelete } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

import type { PrintPreferenceItem } from './use-print-preferences';

// -- Hook ---------------------------------------------------------------------

/**
 * Mutation to reset all user print preferences to defaults.
 *
 * Deletes all user PrintPreference records so that resolution
 * falls back to company defaults / NONE.
 *
 * On success: invalidates preferences cache, shows success toast.
 * On error: shows error toast.
 */
export function useResetPrintPreferences() {
  const queryClient = useQueryClient();
  const { t } = useI18n('print');

  return useMutation({
    mutationFn: async () => {
      const result = await apiDelete<PrintPreferenceItem[]>('/system/print-preferences/reset');
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('preferences.resetSuccess'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.printPreferences.user(),
      });
    },
    onError: () => {
      toast.error(t('preferences.resetError'));
    },
  });
}
