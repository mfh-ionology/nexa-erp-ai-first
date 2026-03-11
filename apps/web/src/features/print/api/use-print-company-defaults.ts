/**
 * TanStack Query hooks for company-level print defaults.
 *
 * GET  /system/print-preferences/company-defaults — fetch company defaults
 * PUT  /system/print-preferences/company-defaults — update company defaults
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';
import { apiGet, apiPut } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type { DocumentType, PrintAction } from './use-print-preferences';

// -- Types --------------------------------------------------------------------

export interface CompanyDefaultItem {
  documentType: DocumentType;
  action: PrintAction;
}

export interface UpdateCompanyDefaultsInput {
  defaults: CompanyDefaultItem[];
}

// -- Query Hook ---------------------------------------------------------------

/**
 * Query for company-level print defaults (ADMIN only).
 *
 * The endpoint requires ADMIN role — pass `enabled: false` for non-admin
 * users to avoid 403 errors.
 *
 * Stale time: 5 minutes.
 */
export function usePrintCompanyDefaults(options?: { enabled?: boolean }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const optEnabled = options?.enabled ?? true;

  return useQuery({
    queryKey: queryKeys.printPreferences.companyDefaults(),
    queryFn: async () => {
      const result = await apiGet<CompanyDefaultItem[]>(
        '/system/print-preferences/company-defaults',
      );
      return result.data;
    },
    enabled: isAuthenticated && optEnabled,
    staleTime: 5 * 60 * 1000,
  });
}

// -- Mutation Hook ------------------------------------------------------------

/**
 * Mutation to update company-level print defaults.
 *
 * On success: invalidates both company defaults and user preferences caches.
 * On error: shows error toast.
 */
export function useUpdatePrintCompanyDefaults() {
  const queryClient = useQueryClient();
  const { t } = useI18n('print');

  return useMutation({
    mutationFn: async (input: UpdateCompanyDefaultsInput) => {
      const result = await apiPut<CompanyDefaultItem[]>(
        '/system/print-preferences/company-defaults',
        input,
      );
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('preferences.companyDefaults.saveSuccess'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.printPreferences.companyDefaults(),
      });
      // User preferences may resolve differently after company defaults change
      void queryClient.invalidateQueries({
        queryKey: queryKeys.printPreferences.user(),
      });
    },
    onError: () => {
      toast.error(t('preferences.companyDefaults.saveError'));
    },
  });
}
