/**
 * React Query hooks for the Note API.
 *
 * - useNotes: list query (pinned first, reverse chronological)
 * - useCreateNote: create mutation
 * - useUpdateNote: update mutation
 * - useDeleteNote: delete mutation
 * - usePinNote: pin toggle with optimistic update
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import { listNotes, createNote, updateNote, deleteNote, pinNote } from '../api/note-api';
import type { Note, CreateNoteInput, UpdateNoteInput, ListResponse } from '../types';

// ---------------------------------------------------------------------------
// useNotes — list query
// ---------------------------------------------------------------------------

export function useNotes(entityType: string, entityId: string) {
  const query = useQuery<ListResponse<Note>>({
    queryKey: queryKeys.notes.list(entityType, entityId),
    queryFn: () => listNotes(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });

  return {
    notes: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ---------------------------------------------------------------------------
// useCreateNote — create mutation
// ---------------------------------------------------------------------------

export function useCreateNote(entityType: string, entityId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<CreateNoteInput, 'entityType' | 'entityId'>) =>
      createNote({ ...input, entityType, entityId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notes.list(entityType, entityId),
      });
    },
    onError: () => {
      toast({ title: t('crossCutting.notes.createFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateNote — update mutation
// ---------------------------------------------------------------------------

export function useUpdateNote(entityType: string, entityId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, input }: { noteId: string; input: UpdateNoteInput }) =>
      updateNote(noteId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notes.list(entityType, entityId),
      });
    },
    onError: () => {
      toast({ title: t('crossCutting.notes.updateFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteNote — delete mutation
// ---------------------------------------------------------------------------

export function useDeleteNote(entityType: string, entityId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notes.list(entityType, entityId),
      });
    },
    onError: () => {
      toast({ title: t('crossCutting.notes.deleteFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// usePinNote — optimistic pin toggle
// ---------------------------------------------------------------------------

export function usePinNote(entityType: string, entityId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const listKey = queryKeys.notes.list(entityType, entityId);

  return useMutation({
    mutationFn: (noteId: string) => pinNote(noteId),
    onMutate: async (noteId: string) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const prev = queryClient.getQueryData<ListResponse<Note>>(listKey);

      if (prev) {
        queryClient.setQueryData<ListResponse<Note>>(listKey, {
          ...prev,
          items: prev.items.map((n) => (n.id === noteId ? { ...n, isPinned: !n.isPinned } : n)),
        });
      }

      return { prev };
    },
    onError: (_err, _noteId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(listKey, context.prev);
      }
      toast({ title: t('crossCutting.notes.pinFailed'), variant: 'destructive' });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}
