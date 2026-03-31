/**
 * React Query hooks for Month-End Close.
 *
 * - useMonthEndPeriods: list periods
 * - useMonthEndPeriod: single period detail with steps
 * - useCloseMonthEnd: close period mutation
 * - useCompleteMonthEndStep: complete a step mutation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import {
  listMonthEndPeriods,
  getMonthEndPeriod,
  closeMonthEnd,
  completeMonthEndStep,
} from '../api/month-end-api';
import type { MonthEndPeriod, MonthEndListResponse, MonthEndListParams } from '../types';

export function useMonthEndPeriods(params: MonthEndListParams = {}) {
  const query = useQuery<MonthEndListResponse>({
    queryKey: queryKeys.finance.monthEndPeriods(params as Record<string, unknown>),
    queryFn: () => listMonthEndPeriods(params),
  });

  return {
    periods: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useMonthEndPeriod(periodId: string | null | undefined) {
  const query = useQuery<MonthEndPeriod>({
    queryKey: queryKeys.finance.monthEndPeriod(periodId ?? ''),
    queryFn: () => getMonthEndPeriod(periodId!),
    enabled: !!periodId,
  });

  return {
    period: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCloseMonthEnd() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (periodId: string) => closeMonthEnd(periodId),
    onSuccess: (_data, periodId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.monthEndPeriod(periodId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.monthEndPeriods() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast({ title: t('finance.monthEnd.toast.closed') });
    },
    onError: () => {
      toast({ title: t('finance.monthEnd.toast.closeFailed'), variant: 'destructive' });
    },
  });
}

export function useCompleteMonthEndStep() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ periodId, stepId }: { periodId: string; stepId: string }) =>
      completeMonthEndStep(periodId, stepId),
    onSuccess: (_data, { periodId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.monthEndPeriod(periodId),
      });
      toast({ title: t('finance.monthEnd.toast.stepCompleted') });
    },
    onError: () => {
      toast({ title: t('finance.monthEnd.toast.stepFailed'), variant: 'destructive' });
    },
  });
}
