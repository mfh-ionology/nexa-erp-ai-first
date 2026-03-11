/**
 * TanStack Query mutation hook for updating user print preferences.
 *
 * Uses `useMutation` against `PUT /system/print-preferences`.
 * Invalidates the preferences cache on success.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';
import { apiPut } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

import type { DocumentType, PrintAction, PrintPreferenceItem } from './use-print-preferences';

// -- Types --------------------------------------------------------------------

export interface UpdatePreferenceItem {
  documentType: DocumentType;
  action: PrintAction;
}

export interface UpdateUserPreferencesInput {
  preferences: UpdatePreferenceItem[];
}

// -- Hook ---------------------------------------------------------------------

/**
 * Mutation to upsert user print preferences.
 *
 * On success: invalidates preferences cache, shows success toast.
 * On error: shows error toast.
 */
export function useUpdatePrintPreferences() {
  const queryClient = useQueryClient();
  const { t } = useI18n('print');

  return useMutation({
    mutationFn: async (input: UpdateUserPreferencesInput) => {
      const result = await apiPut<PrintPreferenceItem[]>('/system/print-preferences', input);
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('preferences.saveSuccess'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.printPreferences.user(),
      });
    },
    onError: () => {
      toast.error(t('preferences.saveError'));
    },
  });
}
