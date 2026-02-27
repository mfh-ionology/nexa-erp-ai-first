/**
 * TanStack Query mutation hooks for Saved View CRUD operations.
 *
 * All mutations implement optimistic updates with rollback (AC10),
 * error toast notifications, and specific 403/409 error handling.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@nexa/api-client';

import {
  createSavedView,
  updateSavedView,
  deleteSavedView,
  toggleFavourite,
  setDefault,
} from '../api';
import type {
  CreateSavedViewRequest,
  UpdateSavedViewRequest,
  SavedViewDto,
  ViewInitResponse,
} from '../types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type OptimisticContext = { prev?: ViewInitResponse };

/**
 * Show a translated error toast. Handles 409 (duplicate name) and
 * 403 (forbidden) specifically per AC10 / Task 2.9.
 */
function handleMutationError(
  err: Error,
  t: (key: string) => string,
  context?: OptimisticContext,
  rollback?: (prev: ViewInitResponse) => void,
) {
  // Rollback optimistic cache if available
  if (context?.prev && rollback) {
    rollback(context.prev);
  }

  // Specific error codes
  if (err instanceof ApiError) {
    if (err.statusCode === 409) {
      toast({ title: t('views.error.duplicateName'), variant: 'destructive' });
      return;
    }
    if (err.statusCode === 403) {
      toast({ title: t('views.error.forbidden'), variant: 'destructive' });
      return;
    }
  }

  // Generic error toast
  toast({ title: t('error'), variant: 'destructive' });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useViewMutations(viewKey: string, t: (key: string) => string) {
  const queryClient = useQueryClient();
  const qk = queryKeys.views.init(viewKey);

  const invalidateViews = () => queryClient.invalidateQueries({ queryKey: qk });

  const snapshot = () => queryClient.getQueryData<ViewInitResponse>(qk);

  const rollbackToSnapshot = (prev: ViewInitResponse) => queryClient.setQueryData(qk, prev);

  const cancelAndSnapshot = async (): Promise<OptimisticContext> => {
    await queryClient.cancelQueries({ queryKey: qk });
    return { prev: snapshot() };
  };

  // -- createView: optimistic insert + rollback --
  const createView = useMutation({
    mutationFn: (data: CreateSavedViewRequest) => createSavedView(data),
    onMutate: async (data) => {
      const ctx = await cancelAndSnapshot();
      if (ctx.prev) {
        // Insert a temporary optimistic view
        const tempView: SavedViewDto = {
          id: `temp-${String(Date.now())}`,
          name: data.name,
          groupName: data.groupName,
          scope: data.scope,
          createdBy: '',
          dataViewId: '',
          isFavourite: data.isFavourite ?? false,
          favouriteOrder: 0,
          isDefault: data.isDefault ?? false,
          filterLogic: data.filterLogic,
          sortConfig: data.sortConfig,
          columnConfig: data.columnConfig,
          conditions: [],
        };
        queryClient.setQueryData<ViewInitResponse>(qk, {
          ...ctx.prev,
          savedViews: [...ctx.prev.savedViews, tempView],
        });
      }
      return ctx;
    },
    onError: (err: Error, _vars, context) => {
      handleMutationError(err, t, context, rollbackToSnapshot);
    },
    onSettled: invalidateViews,
  });

  // -- updateView: optimistic name/config update + rollback --
  const updateView = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSavedViewRequest }) =>
      updateSavedView(id, data),
    onMutate: async ({ id, data }) => {
      const ctx = await cancelAndSnapshot();
      if (ctx.prev) {
        queryClient.setQueryData<ViewInitResponse>(qk, {
          ...ctx.prev,
          savedViews: ctx.prev.savedViews.map((v: SavedViewDto) =>
            v.id === id ? ({ ...v, ...data } as SavedViewDto) : v,
          ),
        });
      }
      return ctx;
    },
    onError: (err: Error, _vars, context) => {
      handleMutationError(err, t, context, rollbackToSnapshot);
    },
    onSettled: invalidateViews,
  });

  // -- replaceView: optimistic config overwrite + rollback --
  const replaceView = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSavedViewRequest }) =>
      updateSavedView(id, data),
    onMutate: async ({ id, data }) => {
      const ctx = await cancelAndSnapshot();
      if (ctx.prev) {
        queryClient.setQueryData<ViewInitResponse>(qk, {
          ...ctx.prev,
          savedViews: ctx.prev.savedViews.map((v: SavedViewDto) =>
            v.id === id ? ({ ...v, ...data } as SavedViewDto) : v,
          ),
        });
      }
      return ctx;
    },
    onError: (err: Error, _vars, context) => {
      handleMutationError(err, t, context, rollbackToSnapshot);
    },
    onSettled: invalidateViews,
  });

  // -- removeView: optimistic removal + rollback --
  const removeView = useMutation({
    mutationFn: (id: string) => deleteSavedView(id),
    onMutate: async (id: string) => {
      const ctx = await cancelAndSnapshot();
      if (ctx.prev) {
        queryClient.setQueryData<ViewInitResponse>(qk, {
          ...ctx.prev,
          savedViews: ctx.prev.savedViews.filter((v: SavedViewDto) => v.id !== id),
        });
      }
      return ctx;
    },
    onError: (err: Error, _id, context) => {
      handleMutationError(err, t, context, rollbackToSnapshot);
    },
    onSettled: invalidateViews,
  });

  // -- toggleFav: optimistic toggle + rollback --
  const toggleFav = useMutation({
    mutationFn: (id: string) => toggleFavourite(id),
    onMutate: async (id: string) => {
      const ctx = await cancelAndSnapshot();
      if (ctx.prev) {
        queryClient.setQueryData<ViewInitResponse>(qk, {
          ...ctx.prev,
          savedViews: ctx.prev.savedViews.map((v: SavedViewDto) =>
            v.id === id ? { ...v, isFavourite: !v.isFavourite } : v,
          ),
        });
      }
      return ctx;
    },
    onError: (err: Error, _id, context) => {
      handleMutationError(err, t, context, rollbackToSnapshot);
    },
    onSettled: () => {
      void invalidateViews();
      void queryClient.invalidateQueries({ queryKey: queryKeys.views.favourites() });
    },
  });

  // -- setDef: optimistic default update + rollback --
  // Backend unsets defaults where createdBy === userId AND scope === target scope.
  // The optimistic update mirrors this exactly.
  const setDef = useMutation({
    mutationFn: (id: string) => setDefault(id),
    onMutate: async (id: string) => {
      const ctx = await cancelAndSnapshot();
      if (ctx.prev) {
        const targetView = ctx.prev.savedViews.find((v) => v.id === id);
        const ownerId = targetView?.createdBy;
        const targetScope = targetView?.scope;
        queryClient.setQueryData<ViewInitResponse>(qk, {
          ...ctx.prev,
          savedViews: ctx.prev.savedViews.map((v: SavedViewDto) => ({
            ...v,
            isDefault:
              v.id === id
                ? true
                : v.createdBy === ownerId && v.scope === targetScope
                  ? false
                  : v.isDefault,
          })),
        });
      }
      return ctx;
    },
    onError: (err: Error, _id, context) => {
      handleMutationError(err, t, context, rollbackToSnapshot);
    },
    onSettled: invalidateViews,
  });

  return { createView, updateView, replaceView, removeView, toggleFav, setDef };
}
