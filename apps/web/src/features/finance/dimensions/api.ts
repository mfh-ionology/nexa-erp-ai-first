/**
 * Dimension API client functions + TanStack Query hooks.
 *
 * Endpoints:
 *   GET    /finance/dimensions/types           — list dimension types
 *   POST   /finance/dimensions/types           — create dimension type
 *   GET    /finance/dimensions/types/:id       — get dimension type
 *   PATCH  /finance/dimensions/types/:id       — update dimension type
 *   GET    /finance/dimensions/types/:typeId/values — list values for type
 *   POST   /finance/dimensions/types/:typeId/values — create value
 *   PATCH  /finance/dimensions/types/:typeId/values/:id — update value
 *   GET    /finance/dimensions/requirements    — list requirements
 *   POST   /finance/dimensions/requirements    — create requirement
 *   PATCH  /finance/dimensions/requirements/:id — update requirement
 *   DELETE /finance/dimensions/requirements/:id — delete requirement
 *   GET    /finance/dimensions/defaults        — list defaults
 *   POST   /finance/dimensions/defaults        — create default
 *   DELETE /finance/dimensions/defaults/:id    — delete default
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError } from '@nexa/api-client';
import { useI18n } from '@nexa/i18n';

import { apiGet, apiPost, apiPatch, apiPut, apiDelete, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DimensionType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  singleSelect: boolean;
  allowManualEntry: boolean;
  sortOrder: number;
  isActive: boolean;
  valuesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDimensionTypeInput {
  code: string;
  name: string;
  description?: string;
  singleSelect?: boolean;
  allowManualEntry?: boolean;
  sortOrder?: number;
}

export interface UpdateDimensionTypeInput {
  name?: string;
  description?: string | null;
  singleSelect?: boolean;
  allowManualEntry?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface DimensionValue {
  id: string;
  dimensionTypeId: string;
  code: string;
  name: string;
  parentId: string | null;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDimensionValueInput {
  code: string;
  name: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDimensionValueInput {
  name?: string;
  parentId?: string | null;
  metadata?: Record<string, unknown> | null;
  isActive?: boolean;
}

export interface DimensionRequirement {
  id: string;
  dimensionTypeId: string;
  dimensionType?: { id: string; code: string; name: string };
  accountCodeFrom: string;
  accountCodeTo: string;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDimensionRequirementInput {
  dimensionTypeId: string;
  accountCodeFrom: string;
  accountCodeTo: string;
  isRequired?: boolean;
}

export interface UpdateDimensionRequirementInput {
  dimensionTypeId?: string;
  accountCodeFrom?: string;
  accountCodeTo?: string;
  isRequired?: boolean;
  isActive?: boolean;
}

export interface MandatoryDimensionItem {
  id: string;
  dimensionTypeId: string;
  dimensionType?: { id: string; code: string; name: string };
  createdAt: string;
}

export type DimensionDefaultEntityType = 'ACCOUNT' | 'CUSTOMER' | 'SUPPLIER' | 'ITEM' | 'COMPANY';

export interface DimensionDefault {
  id: string;
  dimensionTypeId: string;
  dimensionType?: { id: string; code: string; name: string };
  dimensionValueId: string;
  dimensionValue?: { id: string; code: string; name: string };
  entityType: DimensionDefaultEntityType;
  entityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDimensionDefaultInput {
  dimensionTypeId: string;
  dimensionValueId: string;
  entityType: DimensionDefaultEntityType;
  entityId?: string;
}

// ---------------------------------------------------------------------------
// API client functions — Dimension Types
// ---------------------------------------------------------------------------

export async function listDimensionTypes(
  params: { isActive?: boolean } = {},
): Promise<DimensionType[]> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<DimensionType[]>(`/finance/dimensions/types${qs}`);
  return result.data;
}

export async function getDimensionType(id: string): Promise<DimensionType> {
  const result = await apiGet<DimensionType>(`/finance/dimensions/types/${encodeURIComponent(id)}`);
  return result.data;
}

export async function createDimensionType(input: CreateDimensionTypeInput): Promise<DimensionType> {
  const result = await apiPost<DimensionType>('/finance/dimensions/types', input);
  return result.data;
}

export async function updateDimensionType(
  id: string,
  input: UpdateDimensionTypeInput,
): Promise<DimensionType> {
  const result = await apiPatch<DimensionType>(
    `/finance/dimensions/types/${encodeURIComponent(id)}`,
    input,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// API client functions — Dimension Values
// ---------------------------------------------------------------------------

export async function listDimensionValues(
  typeId: string,
  params: { isActive?: boolean } = {},
): Promise<DimensionValue[]> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<DimensionValue[]>(
    `/finance/dimensions/types/${encodeURIComponent(typeId)}/values${qs}`,
  );
  return result.data;
}

export async function createDimensionValue(
  typeId: string,
  input: CreateDimensionValueInput,
): Promise<DimensionValue> {
  const result = await apiPost<DimensionValue>(
    `/finance/dimensions/types/${encodeURIComponent(typeId)}/values`,
    input,
  );
  return result.data;
}

export async function updateDimensionValue(
  typeId: string,
  id: string,
  input: UpdateDimensionValueInput,
): Promise<DimensionValue> {
  const result = await apiPatch<DimensionValue>(
    `/finance/dimensions/types/${encodeURIComponent(typeId)}/values/${encodeURIComponent(id)}`,
    input,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// API client functions — Dimension Requirements
// ---------------------------------------------------------------------------

export async function listDimensionRequirements(): Promise<DimensionRequirement[]> {
  const result = await apiGet<DimensionRequirement[]>('/finance/dimensions/requirements');
  return result.data;
}

export async function createDimensionRequirement(
  input: CreateDimensionRequirementInput,
): Promise<DimensionRequirement> {
  const result = await apiPost<DimensionRequirement>('/finance/dimensions/requirements', input);
  return result.data;
}

export async function updateDimensionRequirement(
  id: string,
  input: UpdateDimensionRequirementInput,
): Promise<DimensionRequirement> {
  const result = await apiPatch<DimensionRequirement>(
    `/finance/dimensions/requirements/${encodeURIComponent(id)}`,
    input,
  );
  return result.data;
}

export async function deleteDimensionRequirement(id: string): Promise<void> {
  await apiDelete(`/finance/dimensions/requirements/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// API client functions — Dimension Defaults
// ---------------------------------------------------------------------------

export async function listDimensionDefaults(
  params: { entityType?: string; dimensionTypeId?: string } = {},
): Promise<DimensionDefault[]> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<DimensionDefault[]>(`/finance/dimensions/defaults${qs}`);
  return result.data;
}

export async function createDimensionDefault(
  input: CreateDimensionDefaultInput,
): Promise<DimensionDefault> {
  const result = await apiPost<DimensionDefault>('/finance/dimensions/defaults', input);
  return result.data;
}

export async function deleteDimensionDefault(id: string): Promise<void> {
  await apiDelete(`/finance/dimensions/defaults/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// TanStack Query Hooks — Dimension Types
// ---------------------------------------------------------------------------

export function useDimensionTypes(params?: { isActive?: boolean }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.dimensionTypes(params as Record<string, unknown> | undefined),
    queryFn: () => listDimensionTypes(params),
    enabled: isAuthenticated,
  });
}

export function useDimensionType(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.dimensionType(id ?? ''),
    queryFn: () => getDimensionType(id!),
    enabled: isAuthenticated && !!id,
  });
}

export function useCreateDimensionType() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (data: CreateDimensionTypeInput) => createDimensionType(data),
    onSuccess: () => {
      toast.success(t('dimensions.toast.typeCreated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.dimensionTypes(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error(t('dimensions.toast.typeCreateFailed'));
      }
    },
  });
}

export function useUpdateDimensionType() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDimensionTypeInput }) =>
      updateDimensionType(id, data),
    onSuccess: () => {
      toast.success(t('dimensions.toast.typeUpdated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.dimensionTypes(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error(t('dimensions.toast.typeUpdateFailed'));
      }
    },
  });
}

// ---------------------------------------------------------------------------
// TanStack Query Hooks — Dimension Values
// ---------------------------------------------------------------------------

export function useDimensionValues(typeId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.dimensionValues(typeId ?? ''),
    queryFn: () => listDimensionValues(typeId!),
    enabled: isAuthenticated && !!typeId,
  });
}

export function useCreateDimensionValue(typeId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (data: CreateDimensionValueInput) => createDimensionValue(typeId, data),
    onSuccess: () => {
      toast.success(t('dimensions.toast.valueCreated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.dimensionValues(typeId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.dimensionTypes(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error(t('dimensions.toast.valueCreateFailed'));
      }
    },
  });
}

export function useUpdateDimensionValue(typeId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDimensionValueInput }) =>
      updateDimensionValue(typeId, id, data),
    onSuccess: () => {
      toast.success(t('dimensions.toast.valueUpdated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.dimensionValues(typeId),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error(t('dimensions.toast.valueUpdateFailed'));
      }
    },
  });
}

// ---------------------------------------------------------------------------
// TanStack Query Hooks — Dimension Requirements
// ---------------------------------------------------------------------------

export function useDimensionRequirements() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.dimensionRequirements(),
    queryFn: () => listDimensionRequirements(),
    enabled: isAuthenticated,
  });
}

export function useCreateDimensionRequirement() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (data: CreateDimensionRequirementInput) => createDimensionRequirement(data),
    onSuccess: () => {
      toast.success(t('dimensions.toast.requirementCreated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.dimensionRequirements(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error(t('dimensions.toast.requirementCreateFailed'));
      }
    },
  });
}

export function useUpdateDimensionRequirement() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDimensionRequirementInput }) =>
      updateDimensionRequirement(id, data),
    onSuccess: () => {
      toast.success(t('dimensions.toast.requirementUpdated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.dimensionRequirements(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error(t('dimensions.toast.requirementUpdateFailed'));
      }
    },
  });
}

export function useDeleteDimensionRequirement() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (id: string) => deleteDimensionRequirement(id),
    onSuccess: () => {
      toast.success(t('dimensions.toast.requirementDeleted'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.dimensionRequirements(),
      });
    },
    onError: () => {
      toast.error(t('dimensions.toast.requirementDeleteFailed'));
    },
  });
}

// ---------------------------------------------------------------------------
// TanStack Query Hooks — Dimension Defaults
// ---------------------------------------------------------------------------

export function useDimensionDefaults(params?: { entityType?: string; dimensionTypeId?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.dimensionDefaults(params as Record<string, unknown> | undefined),
    queryFn: () => listDimensionDefaults(params),
    enabled: isAuthenticated,
  });
}

export function useCreateDimensionDefault() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (data: CreateDimensionDefaultInput) => createDimensionDefault(data),
    onSuccess: () => {
      toast.success(t('dimensions.toast.defaultCreated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.dimensionDefaults(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error(t('dimensions.toast.defaultCreateFailed'));
      }
    },
  });
}

export function useDeleteDimensionDefault() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (id: string) => deleteDimensionDefault(id),
    onSuccess: () => {
      toast.success(t('dimensions.toast.defaultDeleted'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.dimensionDefaults(),
      });
    },
    onError: () => {
      toast.error(t('dimensions.toast.defaultDeleteFailed'));
    },
  });
}

// ---------------------------------------------------------------------------
// API client functions — Account Mandatory Dimensions
// ---------------------------------------------------------------------------

export async function listMandatoryDimensions(
  accountId: string,
): Promise<MandatoryDimensionItem[]> {
  const result = await apiGet<MandatoryDimensionItem[]>(
    `/finance/accounts/${encodeURIComponent(accountId)}/mandatory-dimensions`,
  );
  return result.data;
}

export async function setMandatoryDimensions(
  accountId: string,
  dimensionTypeIds: string[],
): Promise<MandatoryDimensionItem[]> {
  const result = await apiPut<MandatoryDimensionItem[]>(
    `/finance/accounts/${encodeURIComponent(accountId)}/mandatory-dimensions`,
    { dimensionTypeIds },
  );
  return result.data;
}

export async function bulkAssignMandatoryDimensions(input: {
  dimensionTypeIds: string[];
  accountIds?: string[];
  accountRange?: { from: string; to: string };
}): Promise<{ accountsAffected: number; dimensionTypesApplied: number }> {
  const result = await apiPost<{ accountsAffected: number; dimensionTypesApplied: number }>(
    '/finance/mandatory-dimensions/bulk-assign',
    input,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// TanStack Query Hooks — Account Mandatory Dimensions
// ---------------------------------------------------------------------------

export function useMandatoryDimensions(accountId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.accountMandatoryDimensions(accountId ?? ''),
    queryFn: () => listMandatoryDimensions(accountId!),
    enabled: isAuthenticated && !!accountId,
  });
}

export function useSetMandatoryDimensions() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: ({
      accountId,
      dimensionTypeIds,
    }: {
      accountId: string;
      dimensionTypeIds: string[];
    }) => setMandatoryDimensions(accountId, dimensionTypeIds),
    onSuccess: (_data, variables) => {
      toast.success(t('mandatoryDimensions.toast.updated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.accountMandatoryDimensions(variables.accountId),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error('Failed to update mandatory dimensions');
      }
    },
  });
}

export function useBulkAssignMandatoryDimensions() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (input: {
      dimensionTypeIds: string[];
      accountIds?: string[];
      accountRange?: { from: string; to: string };
    }) => bulkAssignMandatoryDimensions(input),
    onSuccess: () => {
      toast.success(t('mandatoryDimensions.toast.bulkAssigned'));
      // Invalidate all account mandatory dimensions queries
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey as readonly unknown[];
          return (
            key.length >= 3 && key[1] === 'finance' && key[2] === 'account-mandatory-dimensions'
          );
        },
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error('Failed to bulk assign mandatory dimensions');
      }
    },
  });
}
