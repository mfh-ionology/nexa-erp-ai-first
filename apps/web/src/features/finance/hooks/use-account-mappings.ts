/**
 * TanStack Query hooks for Account Mappings (FE5).
 *
 * - useAccountMappings: fetch all account mapping types
 * - useUpdateAccountMappings: batch update mappings
 * - useResetAccountMappings: reset to defaults
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import {
  getAccountMappings,
  updateAccountMappings,
  resetAccountMappings,
} from '../api/account-mappings-api';
import type { UpdateAccountMappingInput } from '../types';

/**
 * Fetch all account mappings.
 */
export function useAccountMappings() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.accountMappings(),
    queryFn: getAccountMappings,
    enabled: isAuthenticated,
  });
}

/**
 * Batch update account mappings.
 */
export function useUpdateAccountMappings() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: (input: UpdateAccountMappingInput) => updateAccountMappings(input),
    onSuccess: () => {
      toast.success(t('finance.accountMappings.toast.saved'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.accountMappings(),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

/**
 * Reset account mappings to defaults.
 */
export function useResetAccountMappings() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: resetAccountMappings,
    onSuccess: () => {
      toast.success(t('finance.accountMappings.toast.reset'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.accountMappings(),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}
