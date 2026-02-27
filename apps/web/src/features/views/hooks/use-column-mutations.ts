/**
 * TanStack Query mutation hooks for column preference operations.
 *
 * - bulkUpdate: PUT /views/columns/:viewKey (full column preference replacement)
 * - debouncedUpdateWidth: PATCH /views/columns/:viewKey/:fieldId/width (debounced, fire-and-forget)
 */

import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';

import { bulkUpdateColumns, updateColumnWidth } from '../api';
import type { ColumnPrefInput } from '../types';

export function useColumnMutations(viewKey: string) {
  const queryClient = useQueryClient();

  const bulkUpdate = useMutation({
    mutationFn: (prefs: ColumnPrefInput[]) => bulkUpdateColumns(viewKey, prefs),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.views.init(viewKey),
      }),
  });

  // Debounced width update — called during/after column border drag-resize
  const widthUpdateRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const updateWidth = useMutation({
    mutationFn: ({ fieldId, width }: { fieldId: string; width: number }) =>
      updateColumnWidth(viewKey, fieldId, width),
  });

  // Use a stable ref for the mutate function to avoid dependency churn
  const mutateRef = useRef(updateWidth.mutate);
  useEffect(() => {
    mutateRef.current = updateWidth.mutate;
  }, [updateWidth.mutate]);

  const debouncedUpdateWidth = useCallback(
    (fieldId: string, width: number) => {
      if (widthUpdateRef.current) clearTimeout(widthUpdateRef.current);
      widthUpdateRef.current = setTimeout(() => {
        mutateRef.current({ fieldId, width });
      }, 300);
    },
    [], // stable — no dependencies, mutateRef.current is always fresh
  );

  return { bulkUpdate, debouncedUpdateWidth };
}
