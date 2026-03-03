/**
 * React Query hooks for the Record Link API.
 *
 * - useRecordLinks: bidirectional list query
 * - useRecordLinkCount: lightweight count-only query
 * - useCreateRecordLink: create mutation
 * - useDeleteRecordLink: delete mutation with cache invalidation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import { listRecordLinks, createRecordLink, deleteRecordLink } from '../api/record-link-api';
import type { RecordLink, CreateRecordLinkInput, ListResponse } from '../types';

// ---------------------------------------------------------------------------
// useRecordLinks — bidirectional list query
// ---------------------------------------------------------------------------

export function useRecordLinks(entityType: string, entityId: string) {
  const query = useQuery<ListResponse<RecordLink>>({
    queryKey: queryKeys.recordLinks.list(entityType, entityId),
    queryFn: () => listRecordLinks(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });

  return {
    links: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ---------------------------------------------------------------------------
// useRecordLinkCount — lightweight count-only query (limit=0)
// ---------------------------------------------------------------------------

export function useRecordLinkCount(entityType: string, entityId: string) {
  const query = useQuery<ListResponse<RecordLink>, Error, number>({
    queryKey: queryKeys.recordLinks.count(entityType, entityId),
    queryFn: () => listRecordLinks(entityType, entityId, undefined, undefined, 0),
    enabled: !!entityType && !!entityId,
    select: (data) => data.total,
  });

  return query.data ?? 0;
}

// ---------------------------------------------------------------------------
// useCreateRecordLink — create mutation
// ---------------------------------------------------------------------------

export function useCreateRecordLink(entityType: string, entityId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRecordLinkInput) => createRecordLink(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recordLinks.list(entityType, entityId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recordLinks.count(entityType, entityId),
      });
    },
    onError: () => {
      toast({ title: t('crossCutting.recordLinks.createFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteRecordLink — delete with cache invalidation
// ---------------------------------------------------------------------------

export function useDeleteRecordLink(entityType: string, entityId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => deleteRecordLink(linkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recordLinks.list(entityType, entityId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recordLinks.count(entityType, entityId),
      });
    },
    onError: () => {
      toast({ title: t('crossCutting.recordLinks.deleteFailed'), variant: 'destructive' });
    },
  });
}
