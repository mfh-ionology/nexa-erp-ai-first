/**
 * TanStack Query hook for a single User detail.
 *
 * Follows the same pattern as access-groups/api/use-access-groups.ts → useAccessGroup.
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type { UserDetail } from './types';

/**
 * Single user detail query.
 * Enabled only when `id` is truthy.
 */
export function useUser(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.system.user(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<UserDetail>(
        `/system/users/${id}`,
      );
      return result.data;
    },
    enabled: isAuthenticated && !!id,
  });
}
