/**
 * React Query hooks for Journal Templates.
 *
 * - useJournalTemplates: list templates
 * - useJournalTemplate: single template detail
 * - useCreateJournalTemplate: create mutation
 * - useUpdateJournalTemplate: update mutation
 * - useDeleteJournalTemplate: delete mutation
 * - useExecuteJournalTemplate: execute mutation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import {
  listJournalTemplates,
  getJournalTemplate,
  createJournalTemplate,
  updateJournalTemplate,
  deleteJournalTemplate,
  executeJournalTemplate,
} from '../api/journal-templates-api';
import type {
  JournalTemplate,
  JournalTemplateListResponse,
  JournalTemplateListParams,
  CreateJournalTemplateInput,
  UpdateJournalTemplateInput,
} from '../types';

export function useJournalTemplates(params: JournalTemplateListParams = {}) {
  const query = useQuery<JournalTemplateListResponse>({
    queryKey: queryKeys.finance.journalTemplates(params as Record<string, unknown>),
    queryFn: () => listJournalTemplates(params),
  });

  return {
    templates: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useJournalTemplate(id: string | null | undefined) {
  const query = useQuery<JournalTemplate>({
    queryKey: queryKeys.finance.journalTemplate(id ?? ''),
    queryFn: () => getJournalTemplate(id!),
    enabled: !!id,
  });

  return {
    template: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateJournalTemplate() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateJournalTemplateInput) => createJournalTemplate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.journalTemplates() });
      toast({ title: t('template.toast.created') });
    },
    onError: () => {
      toast({ title: t('template.toast.createFailed'), variant: 'destructive' });
    },
  });
}

export function useUpdateJournalTemplate() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateJournalTemplateInput }) =>
      updateJournalTemplate(id, input),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.journalTemplate(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.journalTemplates() });
      toast({ title: t('template.toast.updated') });
    },
    onError: () => {
      toast({ title: t('template.toast.updateFailed'), variant: 'destructive' });
    },
  });
}

export function useDeleteJournalTemplate() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteJournalTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.journalTemplates() });
      toast({ title: t('template.toast.deleted') });
    },
    onError: () => {
      toast({ title: t('template.toast.deleteFailed'), variant: 'destructive' });
    },
  });
}

export function useExecuteJournalTemplate() {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => executeJournalTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.journalTemplates() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast({ title: t('template.toast.executed') });
    },
    onError: () => {
      toast({ title: t('template.toast.executeFailed'), variant: 'destructive' });
    },
  });
}
