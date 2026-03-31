/**
 * TanStack Query hook for GL account search (used in account pickers).
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import { searchGlAccounts } from '../api/gl-accounts-api';
import type { GlAccountLookupParams } from '../api/gl-accounts-api';

/**
 * Search GL accounts for picker/dropdown.
 * Re-fetches when search changes.
 */
export function useGlAccountSearch(params: GlAccountLookupParams = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.glAccounts(params as Record<string, unknown>),
    queryFn: () => searchGlAccounts(params),
    enabled: isAuthenticated,
  });
}
