/**
 * TanStack Query mutation hooks for Access Group CRUD operations.
 *
 * - useCreateAccessGroup: POST /system/access-groups
 * - useUpdateAccessGroup: PATCH /system/access-groups/:id
 * - useSetPermissions: PUT /system/access-groups/:id/permissions
 * - useSetFieldOverrides: PUT /system/access-groups/:id/field-overrides
 * - useDeactivateAccessGroup: DELETE /system/access-groups/:id
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError } from '@nexa/api-client';
import { useI18n } from '@nexa/i18n';

import { apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

import type {
  AccessGroupDetail,
  CreateAccessGroupRequest,
  UpdateAccessGroupRequest,
  SetPermissionsRequest,
  SetFieldOverridesRequest,
  SetFieldOverridesResponse,
} from './types';

/**
 * Create a new access group.
 *
 * On success: invalidates the access groups list query.
 * On 409 CONFLICT: the calling component should catch the error and
 * map it to a form field error on the `code` field.
 */
export function useCreateAccessGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAccessGroupRequest) => {
      const result = await apiPost<AccessGroupDetail>(
        '/system/access-groups',
        data,
      );
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.system.accessGroups(),
      });
    },
  });
}

/**
 * Update access group metadata (name, description).
 *
 * On success: invalidates both the list and detail queries, shows success toast.
 */
export function useUpdateAccessGroup(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (data: UpdateAccessGroupRequest) => {
      const result = await apiPatch<AccessGroupDetail>(
        `/system/access-groups/${id}`,
        data,
      );
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('accessGroups.toast.updated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.system.accessGroup(id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.system.accessGroups(),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

/**
 * Set the full permission matrix for an access group (replace-all semantics).
 *
 * On success: invalidates the detail query, shows success toast.
 * On 400 VALIDATION_ERROR: shows toast with invalid resource codes.
 */
export function useSetPermissions(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (data: SetPermissionsRequest) => {
      const result = await apiPut<AccessGroupDetail>(
        `/system/access-groups/${id}/permissions`,
        data,
      );
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('accessGroups.toast.permissionsSaved'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.system.accessGroup(id),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        const details = 'details' in error
          ? (error as ApiError & { details?: Record<string, string[]> }).details
          : undefined;
        const invalidCodes = details?.resourceCodes?.join(', ') ?? '';
        toast.error(
          t('accessGroups.error.invalidResources', { codes: invalidCodes }),
        );
      } else {
        toast.error(t('errors:unexpected'));
      }
    },
  });
}

/**
 * Set the full field override set for an access group (replace-all semantics).
 *
 * On success: invalidates the detail query, shows success toast.
 * On 400 VALIDATION_ERROR: shows toast with invalid resource codes.
 * On 404 NOT_FOUND: shows generic error toast.
 */
export function useSetFieldOverrides(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (data: SetFieldOverridesRequest) => {
      const result = await apiPut<SetFieldOverridesResponse>(
        `/system/access-groups/${id}/field-overrides`,
        data,
      );
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('accessGroups.toast.fieldOverridesSaved'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.system.accessGroup(id),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        const details = 'details' in error
          ? (error as ApiError & { details?: Record<string, string[]> }).details
          : undefined;
        const invalidCodes = details?.resourceCodes?.join(', ') ?? '';
        toast.error(
          t('accessGroups.error.invalidResources', { codes: invalidCodes }),
        );
      } else if (error instanceof ApiError && error.statusCode === 404) {
        toast.error(t('accessGroups.error.fieldOverridesSaveFailed'));
      } else {
        toast.error(t('errors:unexpected'));
      }
    },
  });
}

/**
 * Deactivate (soft-delete) an access group.
 *
 * On success: invalidates the list query, shows success toast.
 * On 409 CONFLICT (active users assigned): shows error toast.
 */
export function useDeactivateAccessGroup() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/system/access-groups/${id}`);
    },
    onSuccess: () => {
      toast.success(t('accessGroups.toast.deactivated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.system.accessGroups(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error(t('accessGroups.error.hasActiveUsers'));
      } else {
        toast.error(t('errors:unexpected'));
      }
    },
  });
}
