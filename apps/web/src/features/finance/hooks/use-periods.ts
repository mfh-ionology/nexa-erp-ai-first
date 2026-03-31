/**
 * React Query hooks for the Financial Periods API.
 *
 * - usePeriods: list periods grouped by fiscal year
 * - useCreateFiscalYear: create a new fiscal year of periods
 * - useClosePeriod: close an OPEN period
 * - useReopenPeriod: reopen a CLOSED period
 * - useLockPeriod: lock a CLOSED period (irreversible)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import {
  listPeriods,
  createFiscalYear,
  closePeriod,
  reopenPeriod,
  lockPeriod,
} from '../api/periods-api';
import type { FiscalYearGroup, CreateFiscalYearInput, ListPeriodsParams } from '../api/periods-api';

// ---------------------------------------------------------------------------
// usePeriods — list periods grouped by fiscal year
// ---------------------------------------------------------------------------

export function usePeriods(params: ListPeriodsParams = {}) {
  const query = useQuery<FiscalYearGroup[]>({
    queryKey: queryKeys.finance.periods(params as Record<string, unknown>),
    queryFn: () => listPeriods(params),
  });

  return {
    fiscalYears: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ---------------------------------------------------------------------------
// useCreateFiscalYear — create a new fiscal year of periods
// ---------------------------------------------------------------------------

export function useCreateFiscalYear() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFiscalYearInput) => createFiscalYear(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast({ title: t('finance.periods.toast.yearCreated', 'Fiscal year created successfully') });
    },
    onError: () => {
      toast({
        title: t('finance.periods.toast.yearCreateFailed', 'Failed to create fiscal year'),
        variant: 'destructive',
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useClosePeriod — close an OPEN period
// ---------------------------------------------------------------------------

export function useClosePeriod() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => closePeriod(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast({ title: t('finance.periods.toast.closed', 'Period closed') });
    },
    onError: () => {
      toast({
        title: t('finance.periods.toast.closeFailed', 'Failed to close period'),
        variant: 'destructive',
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useReopenPeriod — reopen a CLOSED period
// ---------------------------------------------------------------------------

export function useReopenPeriod() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reopenPeriod(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast({ title: t('finance.periods.toast.reopened', 'Period reopened') });
    },
    onError: () => {
      toast({
        title: t('finance.periods.toast.reopenFailed', 'Failed to reopen period'),
        variant: 'destructive',
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useLockPeriod — lock a CLOSED period (irreversible)
// ---------------------------------------------------------------------------

export function useLockPeriod() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => lockPeriod(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast({ title: t('finance.periods.toast.locked', 'Period locked') });
    },
    onError: () => {
      toast({
        title: t('finance.periods.toast.lockFailed', 'Failed to lock period'),
        variant: 'destructive',
      });
    },
  });
}
