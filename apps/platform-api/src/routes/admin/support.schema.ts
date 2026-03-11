// ---------------------------------------------------------------------------
// Support Console Schemas — Request/response validation for support routes
// Source: API Contracts §21.8, FR217, AC#5
// Story: E13b.5 Task 3.1
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const supportSearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  type: z.enum(['domain', 'name', 'email', 'id']).optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const supportSearchResultSchema = z.object({
  id: z.string(),
  code: z.string(),
  displayName: z.string(),
  status: z.string(),
  planCode: z.string(),
  billingStatus: z.string(),
  lastActivityAt: z.string().nullable(),
  matchField: z.string(),
  matchValue: z.string(),
});

export const supportSearchResponseSchema = z.object({
  items: z.array(supportSearchResultSchema),
  total: z.number(),
});

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------

export type SupportSearchQuery = z.infer<typeof supportSearchQuerySchema>;
export type SupportSearchResult = z.infer<typeof supportSearchResultSchema>;
