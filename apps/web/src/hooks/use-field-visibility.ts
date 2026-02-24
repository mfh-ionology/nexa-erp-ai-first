import { useMemo } from 'react';

import { useAuthStore } from '@/stores/auth-store';
import type { FieldVisibilityMap } from '@/hooks/use-permissions';

export type { FieldVisibilityMap };

const EMPTY_FIELD_MAP: FieldVisibilityMap = {};

/**
 * Returns field visibility map for a resource, merging Zustand-cached
 * fieldOverrides with _fieldMeta from API responses.
 *
 * - SUPER_ADMIN → empty map (all fields fully visible)
 * - Permissions null (loading) → empty map (default visible)
 * - Unknown resource code → empty map (default visible)
 * - Fields not present in the returned map default to 'VISIBLE'
 *
 * When `fieldMeta` is provided (from API response `_fieldMeta`), it is
 * merged with the store overrides. The API response is authoritative —
 * if a field has no existing override (or is 'VISIBLE'), the API value wins.
 *
 * **Important:** `fieldMeta` is used as a `useMemo` dependency. Callers must
 * memoize the object (e.g., via `useMemo`) to avoid re-computation on every
 * render. Passing an inline object literal will defeat memoization.
 */
export function useFieldVisibility(
  resourceCode: string,
  fieldMeta?: Record<string, string>,
): FieldVisibilityMap {
  const permissions = useAuthStore((s) => s.permissions);

  return useMemo(() => {
    if (permissions?.isSuperAdmin) return EMPTY_FIELD_MAP;
    if (!permissions) return EMPTY_FIELD_MAP;

    const overrides = permissions.fieldOverrides[resourceCode] ?? {};
    if (!fieldMeta) return overrides;

    // Merge: API _fieldMeta is authoritative for READ_ONLY markers
    const merged: FieldVisibilityMap = { ...overrides };
    for (const [field, vis] of Object.entries(fieldMeta)) {
      if (!merged[field] || merged[field] === 'VISIBLE') {
        merged[field] = vis as 'VISIBLE' | 'READ_ONLY' | 'HIDDEN';
      }
    }
    return merged;
  }, [permissions, resourceCode, fieldMeta]);
}
