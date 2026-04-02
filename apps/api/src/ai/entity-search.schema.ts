// ---------------------------------------------------------------------------
// Zod schemas for Entity Search proxy endpoint
// E5b-7 Task 1.1
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ─── Request schema ──────────────────────────────────────────────────────

export const entitySearchQuerySchema = z
  .object({
    type: z.string().min(1).max(255).optional(),
    q: z.string().min(2).max(100),
    scopeBy: z.string().max(255).optional(),
    scopeValue: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      // ISSUE #7 fix: require both scopeBy and scopeValue if either is present
      const hasScopeBy = data.scopeBy !== undefined && data.scopeBy !== '';
      const hasScopeValue = data.scopeValue !== undefined;
      return hasScopeBy === hasScopeValue;
    },
    { message: 'scopeBy and scopeValue must both be provided or both omitted' },
  );

// ─── Response schemas ────────────────────────────────────────────────────

export const entitySearchResultSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  subtitle: z.string().nullable(),
  entityType: z.string(),
});

export const entitySearchResponseSchema = z.array(entitySearchResultSchema).max(8);
