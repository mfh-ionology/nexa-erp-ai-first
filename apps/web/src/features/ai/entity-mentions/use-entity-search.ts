import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { searchEntities } from '../api';

/**
 * Debounces a value by the specified delay (ms).
 * The returned value only updates after the caller stops changing it
 * for `delay` milliseconds.
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

interface UseEntitySearchParams {
  type: string | null;
  q: string;
  scopeBy?: string;
  scopeValue?: string;
}

/**
 * Searches for entities via the backend proxy, debounced at 300 ms.
 *
 * - Only fires when `type` is set and `q` has >= 2 characters
 * - Uses `keepPreviousData` so the dropdown shows stale results while
 *   new ones load (avoids empty→loading→results flicker)
 * - 30 s staleTime — entity data can change but short cache avoids
 *   hammering the backend
 */
export function useEntitySearch(params: UseEntitySearchParams) {
  const debouncedQ = useDebouncedValue(params.q, 300);

  // When type is '_universal' (no context word matched a known entity),
  // omit the type filter so the backend searches across all entity types.
  const searchType = params.type === '_universal' ? undefined : params.type;

  const enabled = !!params.type && debouncedQ.length >= 2;

  const { data: results = [], isLoading } = useQuery({
    queryKey: queryKeys.ai.entitySearch(params.type, debouncedQ, params.scopeBy, params.scopeValue),
    queryFn: () =>
      searchEntities({
        type: searchType ?? undefined,
        q: debouncedQ,
        scopeBy: params.scopeBy,
        scopeValue: params.scopeValue,
      }),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  return { results, isLoading: isLoading && enabled };
}
