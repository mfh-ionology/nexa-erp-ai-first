/**
 * React Query hooks for Finance Settings.
 *
 * - useFinanceSettings: fetch settings (query)
 * - useUpdateFinanceSettings: save settings (mutation)
 * - useResetFinanceSettings: reset to defaults (mutation)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import {
  getFinanceSettings,
  updateFinanceSettings,
  resetFinanceSettings,
} from '../api/settings-api';
import type { FinanceSettings, UpdateFinanceSettingsInput } from '../types';

// ---------------------------------------------------------------------------
// useFinanceSettings — fetch settings query
// ---------------------------------------------------------------------------

export function useFinanceSettings() {
  const query = useQuery<FinanceSettings>({
    queryKey: queryKeys.finance.settings(),
    queryFn: getFinanceSettings,
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ---------------------------------------------------------------------------
// useUpdateFinanceSettings — save mutation
// ---------------------------------------------------------------------------

export function useUpdateFinanceSettings() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateFinanceSettingsInput) => updateFinanceSettings(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast({ title: t('settings.toast.saved') });
    },
    onError: () => {
      toast({ title: t('settings.toast.saveFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useResetFinanceSettings — reset to defaults mutation
// ---------------------------------------------------------------------------

export function useResetFinanceSettings() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => resetFinanceSettings(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast({ title: t('settings.toast.reset') });
    },
    onError: () => {
      toast({ title: t('settings.toast.resetFailed'), variant: 'destructive' });
    },
  });
}
