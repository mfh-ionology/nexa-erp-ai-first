/**
 * TanStack Query hooks for Email Template Management (E10-4).
 *
 * - useEmailTemplates: infinite query for list page (GET /email/templates)
 * - useEmailTemplate: single template detail (GET /email/templates/:id)
 * - useCreateEmailTemplate: create mutation (POST /email/templates)
 * - useUpdateEmailTemplate: update mutation (PATCH /email/templates/:id)
 * - useDeleteEmailTemplate: soft-delete mutation (DELETE /email/templates/:id)
 * - usePreviewEmailTemplate: preview mutation (POST /email/templates/:id/preview)
 */

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError } from '@nexa/api-client';
import { useI18n } from '@nexa/i18n';

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type {
  EmailTemplateListItem,
  EmailTemplateListParams,
  EmailTemplateListResponse,
  EmailTemplateDetail,
  EmailTemplatePreview,
  CreateEmailTemplateRequest,
  UpdateEmailTemplateRequest,
} from './types';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Infinite query for the email template list page.
 * Supports cursor-based pagination and filtering.
 */
export function useEmailTemplates(params: Omit<EmailTemplateListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.email.templateAdmin.listInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: EmailTemplateListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam;
      }
      const qs = buildQueryString(fullParams as Record<string, unknown>);
      const result = await apiGet<{
        items: EmailTemplateListItem[];
        meta: { cursor: string | null; hasMore: boolean };
      }>(`/email/templates${qs}`);
      const body = result.data;
      return {
        data: body.items,
        meta: body.meta,
      } as EmailTemplateListResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    enabled: isAuthenticated,
    select: (queryData) => ({
      data: queryData.pages.flatMap((page) => page.data),
      pages: queryData.pages,
      pageParams: queryData.pageParams,
    }),
  });
}

/**
 * Single email template detail query.
 */
export function useEmailTemplate(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.email.templateAdmin.detail(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<EmailTemplateDetail>(`/email/templates/${id!}`);
      return result.data;
    },
    enabled: isAuthenticated && !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new email template.
 */
export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (data: CreateEmailTemplateRequest) => {
      const result = await apiPost<EmailTemplateDetail>('/email/templates', data);
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('emailTemplates.toast.created'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.email.templateAdmin.all(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error(t('emailTemplates.error.duplicateCode'));
      } else {
        toast.error(t('errors:unexpected'));
      }
    },
  });
}

/**
 * Update an existing email template.
 */
export function useUpdateEmailTemplate(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (data: UpdateEmailTemplateRequest) => {
      const result = await apiPatch<EmailTemplateDetail>(`/email/templates/${id}`, data);
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('emailTemplates.toast.updated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.email.templateAdmin.detail(id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.email.templateAdmin.all(),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

/**
 * Soft-delete an email template.
 */
export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/email/templates/${id}`);
    },
    onSuccess: () => {
      toast.success(t('emailTemplates.toast.deleted'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.email.templateAdmin.all(),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

/**
 * Preview an email template with sample data.
 * Uses useMutation (NOT useQuery) because it's a POST endpoint.
 */
export function usePreviewEmailTemplate() {
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiPost<EmailTemplatePreview>(`/email/templates/${id}/preview`);
      return result.data;
    },
  });
}
