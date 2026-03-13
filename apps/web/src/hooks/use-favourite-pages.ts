/**
 * React hook for favourite pages (pinned navigation items).
 *
 * Provides:
 * - Cached list of favourite pages via TanStack Query
 * - Mutations for pin, unpin, unpin-by-path, and reorder
 * - Helper utilities: isPinned, togglePin
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  fetchFavouritePages,
  pinPage,
  unpinPage,
  unpinPageByPath,
  reorderPages,
} from '@/features/favourite-pages/api';
import type { CreateFavouritePageInput } from '@/features/favourite-pages/types';

const QUERY_KEY = ['favourite-pages'] as const;

export function useFavouritePages() {
  const queryClient = useQueryClient();

  const { data: pages = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFavouritePages,
    staleTime: 60_000,
  });

  const pinMutation = useMutation({
    mutationFn: (input: CreateFavouritePageInput) => pinPage(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const unpinMutation = useMutation({
    mutationFn: (id: string) => unpinPage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const unpinByPathMutation = useMutation({
    mutationFn: (path: string) => unpinPageByPath(path),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderPages(orderedIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const isPinned = (path: string) => pages.some((p) => p.path === path);

  const togglePin = (path: string, label: string, iconKey: string) => {
    const existing = pages.find((p) => p.path === path);
    if (existing) {
      unpinMutation.mutate(existing.id);
    } else {
      pinMutation.mutate({ path, label, iconKey });
    }
  };

  return {
    pages,
    isLoading,
    isPinned,
    togglePin,
    pin: pinMutation.mutate,
    unpin: unpinMutation.mutate,
    unpinByPath: unpinByPathMutation.mutate,
    reorder: reorderMutation.mutate,
  };
}
