/**
 * useFavourites — fetches all favourite views for the current user
 * across ALL data_views. Groups by groupName for display in the
 * header favourites dropdown (AC #7).
 *
 * Cached via TanStack Query; invalidated when any view's favourite
 * status changes (via queryKeys.views.favourites()).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import { fetchFavourites } from '../api';
import type { FavouriteViewDto } from '../types';

export interface FavouritesReturn {
  favourites: FavouriteViewDto[];
  groupedFavourites: Record<string, FavouriteViewDto[]>;
  isLoading: boolean;
}

export function useFavourites(): FavouritesReturn {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.views.favourites(),
    queryFn: fetchFavourites,
    enabled: isAuthenticated,
    staleTime: 60_000, // 1 min — favourites don't change often
  });

  const favourites = data ?? [];

  const groupedFavourites = useMemo(() => {
    const groups: Record<string, FavouriteViewDto[]> = {};

    for (const fav of favourites) {
      const group = fav.groupName || 'Other';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(fav);
    }

    // Sort within each group by favouriteOrder
    for (const [, items] of Object.entries(groups)) {
      items.sort((a, b) => a.favouriteOrder - b.favouriteOrder);
    }

    return groups;
  }, [favourites]);

  return { favourites, groupedFavourites, isLoading };
}
