/**
 * Simulation API client functions + TanStack Query hooks.
 *
 * Endpoints:
 *   GET    /finance/simulations           — list simulations
 *   POST   /finance/simulations           — create simulation
 *   GET    /finance/simulations/:id       — get simulation detail
 *   PATCH  /finance/simulations/:id       — update simulation
 *   DELETE /finance/simulations/:id       — delete simulation
 *   POST   /finance/simulations/:id/convert    — convert to journal
 *   POST   /finance/simulations/:id/invalidate — invalidate simulation
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError } from '@nexa/api-client';
import { useI18n } from '@nexa/i18n';

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';
import type { ApiResult } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const SIMULATION_STATUSES = ['ACTIVE', 'TRANSFERRED', 'INVALID'] as const;
export type SimulationStatus = (typeof SIMULATION_STATUSES)[number];

export interface SimulationLine {
  id: string;
  lineNumber: number;
  accountCode: string;
  accountName?: string;
  description: string | null;
  debit: number;
  credit: number;
  vatCode: string | null;
}

export interface SimulationListItem {
  id: string;
  entryNumber: string;
  transactionDate: string;
  description: string;
  reference: string | null;
  status: SimulationStatus;
  periodId: string;
  totalDebit: number;
  totalCredit: number;
  transferredToId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationDetail extends SimulationListItem {
  createdBy: string;
  updatedBy: string;
  lines: SimulationLine[];
}

export interface SimulationLineInput {
  accountCode: string;
  description?: string;
  debit: number;
  credit: number;
  vatCode?: string;
}

export interface CreateSimulationInput {
  transactionDate: string;
  description: string;
  reference?: string;
  periodId: string;
  lines: SimulationLineInput[];
}

export interface UpdateSimulationInput {
  transactionDate?: string;
  description?: string;
  reference?: string | null;
  periodId?: string;
  lines?: SimulationLineInput[];
}

export interface ListSimulationsParams {
  status?: SimulationStatus;
  periodId?: string;
  cursor?: string;
  limit?: number;
}

export interface ConvertResult {
  simulationId: string;
  journalId: string;
  journalEntryNumber: string;
}

// ---------------------------------------------------------------------------
// API client functions
// ---------------------------------------------------------------------------

export async function listSimulations(
  params: ListSimulationsParams = {},
): Promise<ApiResult<SimulationListItem[]>> {
  const qs = buildQueryString(params as Record<string, unknown>);
  return apiGet<SimulationListItem[]>(`/finance/simulations${qs}`);
}

export async function getSimulation(id: string): Promise<SimulationDetail> {
  const result = await apiGet<SimulationDetail>(`/finance/simulations/${encodeURIComponent(id)}`);
  return result.data;
}

export async function createSimulation(input: CreateSimulationInput): Promise<SimulationDetail> {
  const result = await apiPost<SimulationDetail>('/finance/simulations', input);
  return result.data;
}

export async function updateSimulation(
  id: string,
  input: UpdateSimulationInput,
): Promise<SimulationDetail> {
  const result = await apiPatch<SimulationDetail>(
    `/finance/simulations/${encodeURIComponent(id)}`,
    input,
  );
  return result.data;
}

export async function deleteSimulation(id: string): Promise<void> {
  await apiDelete(`/finance/simulations/${encodeURIComponent(id)}`);
}

export async function convertSimulation(id: string): Promise<ConvertResult> {
  const result = await apiPost<ConvertResult>(
    `/finance/simulations/${encodeURIComponent(id)}/convert`,
  );
  return result.data;
}

export async function invalidateSimulation(id: string): Promise<SimulationDetail> {
  const result = await apiPost<SimulationDetail>(
    `/finance/simulations/${encodeURIComponent(id)}/invalidate`,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// TanStack Query Hooks
// ---------------------------------------------------------------------------

export function useSimulations(params: Omit<ListSimulationsParams, 'cursor'> = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: queryKeys.finance.simulationsInfinite(params as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const fullParams: ListSimulationsParams = { ...params };
      if (pageParam) {
        fullParams.cursor = pageParam as string;
      }
      const result = await listSimulations(fullParams);
      return {
        data: result.data,
        meta: result.meta ?? { hasMore: false },
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasMore ? (lastPage.meta.cursor as string | undefined) : undefined,
    enabled: isAuthenticated,
    select: (queryData) => ({
      data: queryData.pages.flatMap((page) => page.data),
      pages: queryData.pages,
      pageParams: queryData.pageParams,
    }),
  });
}

export function useSimulation(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.simulation(id ?? ''),
    queryFn: () => getSimulation(id!),
    enabled: isAuthenticated && !!id,
  });
}

export function useCreateSimulation() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (data: CreateSimulationInput) => createSimulation(data),
    onSuccess: () => {
      toast.success(t('simulations.toast.created'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.simulations(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error(t('simulations.toast.createFailed'));
      }
    },
  });
}

export function useUpdateSimulation(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (data: UpdateSimulationInput) => updateSimulation(id, data),
    onSuccess: () => {
      toast.success(t('simulations.toast.updated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.simulation(id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.simulations(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error(t('simulations.error.immutable'));
      } else if (error instanceof ApiError && error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error(t('simulations.toast.updateFailed'));
      }
    },
  });
}

export function useDeleteSimulation() {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: (id: string) => deleteSimulation(id),
    onSuccess: () => {
      toast.success(t('simulations.toast.deleted'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.simulations(),
      });
    },
    onError: () => {
      toast.error(t('simulations.toast.deleteFailed'));
    },
  });
}

export function useConvertSimulation(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: () => convertSimulation(id),
    onSuccess: () => {
      toast.success(t('simulations.toast.converted'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.simulation(id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.simulations(),
      });
      // Also invalidate journals since a new one was created
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.journals(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error(error.message);
      } else {
        toast.error(t('simulations.toast.convertFailed'));
      }
    },
  });
}

export function useInvalidateSimulation(id: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n('finance');

  return useMutation({
    mutationFn: () => invalidateSimulation(id),
    onSuccess: () => {
      toast.success(t('simulations.toast.invalidated'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.simulation(id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.simulations(),
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error(error.message);
      } else {
        toast.error(t('simulations.toast.invalidateFailed'));
      }
    },
  });
}
