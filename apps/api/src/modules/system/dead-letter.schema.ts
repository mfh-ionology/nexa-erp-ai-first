import { z } from 'zod';

// ---------------------------------------------------------------------------
// Params Schemas
// ---------------------------------------------------------------------------

export const deadLetterParamsSchema = z.object({
  id: z.string(),
});

// ---------------------------------------------------------------------------
// Query Schemas
// ---------------------------------------------------------------------------

export const deadLetterQuerySchema = z.object({
  eventName: z.string().optional(),
  reprocessed: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const deadLetterResponseSchema = z.object({
  id: z.string(),
  eventName: z.string(),
  payload: z.unknown(),
  error: z.string(),
  stack: z.string().optional(),
  retryCount: z.number(),
  originalTimestamp: z.string(),
  createdAt: z.string(),
  reprocessed: z.boolean(),
  reprocessedAt: z.string().optional(),
});

export const deadLetterListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(deadLetterResponseSchema),
  meta: z
    .object({
      cursor: z.string().nullable(),
      hasMore: z.boolean(),
    })
    .optional(),
});

export const reprocessResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    reprocessed: z.literal(true),
  }),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type DeadLetterQuery = z.infer<typeof deadLetterQuerySchema>;
export type DeadLetterResponse = z.infer<typeof deadLetterResponseSchema>;
export type DeadLetterListResponse = z.infer<typeof deadLetterListResponseSchema>;
export type ReprocessResponse = z.infer<typeof reprocessResponseSchema>;
