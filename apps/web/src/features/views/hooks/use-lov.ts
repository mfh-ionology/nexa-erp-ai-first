import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';

import { batchFetchLov, fetchLov } from '../api';
import type { DataViewFieldDto, LovStaticValue } from '../types';

// ---------------------------------------------------------------------------
// useBatchLov — fetches all VIEW_SPECIFIC and GLOBAL LOVs in one batch call
// ---------------------------------------------------------------------------

/**
 * Fetches all VIEW_SPECIFIC and GLOBAL LOVs for a view in a single batch call
 * when the filter modal opens.
 *
 * - Fetches fields with `lovType === 'VIEW_SPECIFIC'` or `lovType === 'GLOBAL'`
 * - Combines STATIC LOV inline values from field metadata
 * - staleTime: 60s (LOVs don't change often)
 * - enabled: only when filter modal is open
 */
export function useBatchLov(
  viewKey: string,
  fields: DataViewFieldDto[],
  enabled: boolean,
): {
  lovData: Record<string, LovStaticValue[]>;
  isLoading: boolean;
} {
  const batchableFields = useMemo(
    () =>
      fields.filter((f) => (f.lovType === 'VIEW_SPECIFIC' || f.lovType === 'GLOBAL') && f.lovScope),
    [fields],
  );

  const batchItems = useMemo(
    () =>
      batchableFields.map((f) => ({
        fieldId: f.id,
        lovScope: f.lovScope!,
      })),
    [batchableFields],
  );

  const { data: batchResults, isLoading } = useQuery({
    queryKey: queryKeys.views.lovBatch(viewKey),
    queryFn: () => batchFetchLov(batchItems),
    enabled: enabled && batchItems.length > 0,
    staleTime: 60_000,
  });

  // Merge batch results with STATIC LOV values from field metadata
  const lovData = useMemo(() => {
    const result: Record<string, LovStaticValue[]> = {};

    for (const field of fields) {
      if (field.lovType === 'STATIC' && field.lovStaticValues) {
        result[field.id] = field.lovStaticValues;
      } else if (field.lovType === 'VIEW_SPECIFIC' || field.lovType === 'GLOBAL') {
        const items = batchResults?.[field.id];
        if (items) {
          result[field.id] = items;
        }
      }
    }

    return result;
  }, [fields, batchResults]);

  return { lovData, isLoading };
}

// ---------------------------------------------------------------------------
// useLovSearch — server-side search for large LOV sets
// ---------------------------------------------------------------------------

/**
 * Server-side search for LOVs with many items (>50). Uses debounced search.
 *
 * - Returns search results as LovStaticValue[]
 * - Only triggers API call when `search.length >= lovSearchMin`
 * - Debounce: 300ms on search input
 */
export function useLovSearch(
  fieldId: string,
  lovScope: string,
  lovSearchMin: number,
): {
  searchResults: LovStaticValue[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isSearching: boolean;
} {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSetSearchTerm = useCallback((term: string) => {
    setSearchTerm(term);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedTerm(term);
    }, 300);
  }, []);

  const shouldFetch = debouncedTerm.length >= lovSearchMin;

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.views.lov(fieldId), debouncedTerm],
    queryFn: () => fetchLov(lovScope, debouncedTerm),
    enabled: shouldFetch && lovScope.length > 0,
    staleTime: 60_000,
  });

  return {
    searchResults: data ?? [],
    searchTerm,
    setSearchTerm: handleSetSearchTerm,
    isSearching: isLoading && shouldFetch,
  };
}
