/**
 * TanStack Query hooks for Document Template Management (E12-2).
 *
 * - useDocumentTemplates: list with filters (GET /system/document-templates)
 * - useDocumentTemplate: single detail with versions (GET /system/document-templates/:id)
 * - useCreateDocumentTemplate: create mutation (POST /system/document-templates)
 * - useUpdateDocumentTemplate: update mutation (PATCH /system/document-templates/:id)
 * - useDeleteDocumentTemplate: soft-delete mutation (DELETE /system/document-templates/:id)
 * - useCreateTemplateVersion: create version (POST /system/document-templates/:id/versions)
 * - useUpdateTemplateVersion: update version (PATCH /system/document-templates/:id/versions/:versionId)
 * - useDeleteTemplateVersion: delete version (DELETE /system/document-templates/:id/versions/:versionId)
 * - usePreviewTemplate: preview PDF (POST /system/document-templates/:id/preview → Blob)
 */

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError } from '@nexa/api-client';
import { useI18n } from '@nexa/i18n';

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// DocumentType enum (matches Prisma DocumentType — single source of truth)
// ---------------------------------------------------------------------------

export const DOCUMENT_TYPES = [
  'SALES_INVOICE',
  'CREDIT_NOTE',
  'CASH_RECEIPT',
  'PROFORMA_INVOICE',
  'CUSTOMER_STATEMENT',
  'SALES_ORDER',
  'SALES_QUOTE',
  'DELIVERY_NOTE',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT_NOTE',
  'SUPPLIER_REMITTANCE',
  'PAYSLIP',
  'P45',
  'P60',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface DocumentTemplateVersion {
  id: string;
  templateId: string;
  languageCode: string | null;
  branchCode: string | null;
  numberSeriesId: string | null;
  accessGroup: string | null;
  customerGroupId: string | null;
  htmlOverride: string | null;
  cssOverride: string | null;
  headerOverride: string | null;
  footerOverride: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  replyToEmail: string | null;
  ccEmails: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTemplateListItem {
  id: string;
  companyId: string;
  documentType: DocumentType;
  name: string;
  description: string | null;
  pageSize: string;
  orientation: string;
  isDefault: boolean;
  isActive: boolean;
  showLogo: boolean;
  showBankDetails: boolean;
  showVatNumber: boolean;
  showCompanyReg: boolean;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTemplateDetail extends Omit<DocumentTemplateListItem, 'versionCount'> {
  htmlTemplate: string;
  headerHtml: string | null;
  footerHtml: string | null;
  cssStyles: string | null;
  logoPosition: string;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  createdBy: string;
  versions: DocumentTemplateVersion[];
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface CreateDocumentTemplateRequest {
  documentType: DocumentType;
  name: string;
  description?: string;
  htmlTemplate: string;
  headerHtml?: string;
  footerHtml?: string;
  cssStyles?: string;
  pageSize?: 'A4' | 'A5' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  showLogo?: boolean;
  logoPosition?: 'top-left' | 'top-center' | 'top-right';
  showBankDetails?: boolean;
  showVatNumber?: boolean;
  showCompanyReg?: boolean;
  isDefault?: boolean;
}

export interface UpdateDocumentTemplateRequest {
  name?: string;
  description?: string;
  htmlTemplate?: string;
  headerHtml?: string;
  footerHtml?: string;
  cssStyles?: string;
  pageSize?: 'A4' | 'A5' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  showLogo?: boolean;
  logoPosition?: 'top-left' | 'top-center' | 'top-right';
  showBankDetails?: boolean;
  showVatNumber?: boolean;
  showCompanyReg?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface CreateTemplateVersionRequest {
  languageCode?: string | null;
  branchCode?: string | null;
  numberSeriesId?: string | null;
  accessGroup?: string | null;
  customerGroupId?: string | null;
  htmlOverride?: string | null;
  cssOverride?: string | null;
  headerOverride?: string | null;
  footerOverride?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  replyToEmail?: string | null;
  ccEmails?: string | null;
  priority?: number;
  isActive?: boolean;
}

export type UpdateTemplateVersionRequest = CreateTemplateVersionRequest;

// ---------------------------------------------------------------------------
// List params
// ---------------------------------------------------------------------------

export interface DocumentTemplateListParams {
  documentType?: DocumentType;
  isActive?: boolean;
  search?: string;
  cursor?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Infinite query for the document template list page.
 * Supports cursor-based pagination and filtering.
 */
export function useDocumentTemplates(params: Omit<DocumentTemplateListParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.documentTemplates.listInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: DocumentTemplateListParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam;
      }
      const qs = buildQueryString(fullParams as Record<string, unknown>);
      const result = await apiGet<DocumentTemplateListItem[]>(`/system/document-templates${qs}`);
      // apiGet unwraps the envelope: result.data = array, result.meta = pagination
      return {
        items: result.data,
        meta: (result.meta ?? { cursor: null, hasMore: false, total: 0 }) as {
          cursor: string | null;
          hasMore: boolean;
          total: number;
        },
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    enabled: isAuthenticated,
    select: (queryData) => ({
      data: queryData.pages.flatMap((page) => page.items),
      pages: queryData.pages,
      pageParams: queryData.pageParams,
    }),
  });
}

/**
 * Single document template detail query (includes versions).
 */
export function useDocumentTemplate(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.documentTemplates.detail(id ?? ''),
    queryFn: async () => {
      const result = await apiGet<DocumentTemplateDetail>(`/system/document-templates/${id!}`);
      return result.data;
    },
    enabled: isAuthenticated && !!id,
  });
}

// ---------------------------------------------------------------------------
// Template Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new document template.
 */
export function useCreateDocumentTemplate() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (data: CreateDocumentTemplateRequest) => {
      const result = await apiPost<DocumentTemplateDetail>('/system/document-templates', data);
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('documentTemplates.toast.created'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentTemplates.all,
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error(t('documentTemplates.error.duplicateName'));
      } else {
        toast.error(t('errors:unexpected'));
      }
    },
  });
}

/**
 * Update an existing document template.
 */
export function useUpdateDocumentTemplate(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (data: UpdateDocumentTemplateRequest) => {
      const result = await apiPatch<DocumentTemplateDetail>(
        `/system/document-templates/${id}`,
        data,
      );
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('documentTemplates.toast.updated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentTemplates.detail(id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentTemplates.all,
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error(t('documentTemplates.error.duplicateName'));
      } else {
        toast.error(t('errors:unexpected'));
      }
    },
  });
}

/**
 * Soft-delete a document template (sets isActive=false).
 */
export function useDeleteDocumentTemplate() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/system/document-templates/${id}`);
    },
    onSuccess: () => {
      toast.success(t('documentTemplates.toast.deleted'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentTemplates.all,
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

// ---------------------------------------------------------------------------
// Version Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new version for a document template.
 */
export function useCreateTemplateVersion(templateId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (data: CreateTemplateVersionRequest) => {
      const result = await apiPost<DocumentTemplateVersion>(
        `/system/document-templates/${templateId}/versions`,
        data,
      );
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('documentTemplates.toast.versionCreated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentTemplates.detail(templateId),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

/**
 * Update an existing version.
 */
export function useUpdateTemplateVersion(templateId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async ({
      versionId,
      data,
    }: {
      versionId: string;
      data: UpdateTemplateVersionRequest;
    }) => {
      const result = await apiPatch<DocumentTemplateVersion>(
        `/system/document-templates/${templateId}/versions/${versionId}`,
        data,
      );
      return result.data;
    },
    onSuccess: () => {
      toast.success(t('documentTemplates.toast.versionUpdated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentTemplates.detail(templateId),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

/**
 * Hard-delete a version.
 */
export function useDeleteTemplateVersion(templateId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (versionId: string) => {
      await apiDelete(`/system/document-templates/${templateId}/versions/${versionId}`);
    },
    onSuccess: () => {
      toast.success(t('documentTemplates.toast.versionDeleted'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentTemplates.detail(templateId),
      });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });
}

// ---------------------------------------------------------------------------
// Preview Mutation (returns Blob — uses raw fetch since ApiClient parses JSON)
// ---------------------------------------------------------------------------

/**
 * Generate a preview PDF for a document template.
 * Returns a Blob suitable for URL.createObjectURL().
 *
 * Uses apiClient for base URL and auth headers, but calls fetch directly
 * because the shared ApiClient always JSON-parses and we need a raw Blob.
 */
export function usePreviewTemplate() {
  const { t } = useI18n();

  return useMutation({
    mutationFn: async ({
      templateId,
      versionId,
    }: {
      templateId: string;
      versionId?: string;
    }): Promise<Blob> => {
      // Build headers using the same auth pattern as apiClient
      const { accessToken, activeCompanyId } = useAuthStore.getState();

      const headers: Record<string, string> = {
        Accept: 'application/pdf',
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      if (activeCompanyId) {
        headers['X-Company-Id'] = activeCompanyId;
      }

      // Use the same base URL the apiClient uses (already includes /api/v1 path)
      const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
      const url = `${baseUrl}/api/v1/system/document-templates/${encodeURIComponent(templateId)}/preview`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(versionId ? { versionId } : {}),
      });

      if (!response.ok) {
        const text = await response.text();
        let message = `Preview failed (HTTP ${String(response.status)})`;
        try {
          const json = JSON.parse(text) as { error?: { message?: string } };
          if (json.error?.message) {
            message = json.error.message;
          }
        } catch {
          // Non-JSON error response — use default message
        }
        throw new Error(message);
      }

      return response.blob();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('errors:unexpected'));
    },
  });
}
