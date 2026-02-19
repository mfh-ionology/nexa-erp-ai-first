import { z } from 'zod';

// ---------------------------------------------------------------------------
// Query Schemas
// ---------------------------------------------------------------------------

export const resourceListQuerySchema = z.object({
  module: z.string().optional(),
  type: z.enum(['PAGE', 'REPORT', 'SETTING', 'MAINTENANCE']).optional(),
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const resourceResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  module: z.string(),
  type: z.string(),
  parentCode: z.string().nullable(),
  sortOrder: z.number(),
  icon: z.string().nullable(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type ResourceListQuery = z.infer<typeof resourceListQuerySchema>;
export type ResourceResponse = z.infer<typeof resourceResponseSchema>;
