/**
 * React Query hooks for VAT Returns.
 *
 * - useVatReturns: list VAT returns
 * - useVatReturn: single VAT return detail
 * - useCreateVatReturn: create mutation
 * - useCalculateVatReturn: calculate mutation
 * - useSubmitVatReturn: submit mutation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import {
  listVatReturns,
  getVatReturn,
  createVatReturn,
  calculateVatReturn,
  submitVatReturn,
} from '../api/vat-returns-api';
import type {
  VatReturn,
  VatReturnListResponse,
  VatReturnListParams,
  CreateVatReturnInput,
} from '../types';

export function useVatReturns(params: VatReturnListParams = {}) {
  const query = useQuery<VatReturnListResponse>({
    queryKey: queryKeys.finance.vatReturns(params as Record<string, unknown>),
    queryFn: () => listVatReturns(params),
  });

  return {
    vatReturns: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useVatReturn(id: string | null | undefined) {
  const query = useQuery<VatReturn>({
    queryKey: queryKeys.finance.vatReturn(id ?? ''),
    queryFn: () => getVatReturn(id!),
    enabled: !!id,
  });

  return {
    vatReturn: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateVatReturn() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateVatReturnInput) => createVatReturn(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.vatReturns() });
      toast({ title: t('vatReturn.toast.created') });
    },
    onError: () => {
      toast({ title: t('vatReturn.toast.createFailed'), variant: 'destructive' });
    },
  });
}

export function useCalculateVatReturn() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => calculateVatReturn(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.vatReturn(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.vatReturns() });
      toast({ title: t('vatReturn.toast.calculated') });
    },
    onError: () => {
      toast({ title: t('vatReturn.toast.calculateFailed'), variant: 'destructive' });
    },
  });
}

export function useSubmitVatReturn() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => submitVatReturn(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.vatReturn(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.vatReturns() });
      toast({ title: t('vatReturn.toast.submitted') });
    },
    onError: () => {
      toast({ title: t('vatReturn.toast.submitFailed'), variant: 'destructive' });
    },
  });
}
