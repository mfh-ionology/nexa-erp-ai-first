/**
 * React Query hooks for Year-End Close and Opening Balances.
 *
 * - useYearEndStatus: year-end validation status
 * - useCloseYearEnd: close year mutation
 * - useOpeningBalances: get opening balances
 * - useImportOpeningBalances: CSV import mutation
 * - useManualOpeningBalances: manual entry mutation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import {
  getYearEndStatus,
  closeYearEnd,
  getOpeningBalances,
  importOpeningBalances,
  submitManualOpeningBalances,
} from '../api/year-end-api';
import type {
  YearEndCloseResult,
  YearEndCloseInput,
  OpeningBalanceLine,
  ManualOpeningBalanceInput,
} from '../types';

export function useYearEndStatus(fiscalYear: number) {
  const query = useQuery<YearEndCloseResult>({
    queryKey: queryKeys.finance.yearEndStatus(fiscalYear),
    queryFn: () => getYearEndStatus(fiscalYear),
    enabled: fiscalYear > 0,
  });

  return {
    yearEnd: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCloseYearEnd() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: YearEndCloseInput) => closeYearEnd(input),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.yearEndStatus(input.fiscalYear),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast({ title: t('yearEnd.toast.closed') });
    },
    onError: () => {
      toast({ title: t('yearEnd.toast.closeFailed'), variant: 'destructive' });
    },
  });
}

export function useOpeningBalances() {
  const query = useQuery<OpeningBalanceLine[]>({
    queryKey: queryKeys.finance.openingBalances(),
    queryFn: getOpeningBalances,
  });

  return {
    balances: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useImportOpeningBalances() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => importOpeningBalances(file),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.openingBalances() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast({
        title: t('openingBalances.toast.imported', { count: data.imported }),
      });
    },
    onError: () => {
      toast({
        title: t('openingBalances.toast.importFailed'),
        variant: 'destructive',
      });
    },
  });
}

export function useManualOpeningBalances() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ManualOpeningBalanceInput) => submitManualOpeningBalances(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.openingBalances() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast({ title: t('openingBalances.toast.saved') });
    },
    onError: () => {
      toast({
        title: t('openingBalances.toast.saveFailed'),
        variant: 'destructive',
      });
    },
  });
}
