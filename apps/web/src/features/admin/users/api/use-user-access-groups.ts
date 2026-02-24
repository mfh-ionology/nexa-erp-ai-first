/**
 * TanStack Query hooks for a user's access group assignments.
 *
 * - useUserAccessGroups: query the assigned groups for a user
 * - useAssignAccessGroups: mutation to replace-all group assignments (PUT)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError } from '@nexa/api-client';
import { useI18n } from '@nexa/i18n';

import { apiGet, apiPut } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  UserAccessGroupAssignment,
  AssignAccessGroupsRequest,
  AssignAccessGroupsResponse,
} from './types';

/**
 * Query a user's assigned access groups for the current company.
 * Enabled only when `userId` is truthy.
 */
export function useUserAccessGroups(userId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.system.userAccessGroups(userId ?? ''),
    queryFn: async () => {
      const result = await apiGet<UserAccessGroupAssignment[]>(
        `/system/users/${userId}/access-groups`,
      );
      return result.data;
    },
    enabled: isAuthenticated && !!userId,
  });
}

/**
 * Mutation to replace-all access group assignments for a user.
 *
 * On success: shows success toast, invalidates userAccessGroups, user, and usersInfinite queries.
 * On 422: shows "at least one access group required" error toast.
 * On other errors: shows generic error toast.
 */
export function useAssignAccessGroups(userId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (data: AssignAccessGroupsRequest) => {
      const result = await apiPut<AssignAccessGroupsResponse>(
        `/system/users/${userId}/access-groups`,
        data,
      );
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('users.accessGroups.saveSuccess'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.system.userAccessGroups(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.system.user(userId),
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.system.usersInfinite(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 422) {
        toast.error(t('users.accessGroups.minOneRequired'));
      } else if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message || t('errors:VALIDATION_ERROR'));
      } else {
        toast.error(t('errors:unexpected'));
      }
    },
  });
}
