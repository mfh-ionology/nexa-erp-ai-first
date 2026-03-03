import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import { getEntityTriggers } from '../api';

import type { EntityTrigger } from './types';

/**
 * Fetches active entity triggers and builds a Map indexed by lowercase
 * trigger word for O(1) lookup during keystroke-level mention detection.
 *
 * Triggers are cached for 1 hour (they rarely change at runtime).
 */
export function useEntityTriggers() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: triggers = [], isLoading } = useQuery({
    queryKey: queryKeys.ai.entityTriggers(),
    queryFn: getEntityTriggers,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    enabled: isAuthenticated,
  });

  const triggerMap = useMemo(() => {
    const map = new Map<string, EntityTrigger>();
    // Triggers arrive sorted by priority DESC from the backend,
    // so the first occurrence of a trigger word wins (highest priority).
    for (const trigger of triggers) {
      const key = trigger.triggerWord.toLowerCase();
      if (!map.has(key)) {
        map.set(key, trigger);
      }
    }
    return map;
  }, [triggers]);

  return { triggers, triggerMap, isLoading };
}
