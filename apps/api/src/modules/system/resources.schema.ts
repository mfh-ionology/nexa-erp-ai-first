import { z } from 'zod';
import { ResourceType } from '@nexa/db';

// ---------------------------------------------------------------------------
// Query Schemas
// ---------------------------------------------------------------------------

export const listResourcesQuerySchema = z.object({
  module: z.string().optional(),
  type: z.enum(ResourceType).optional(),
  search: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const resourceResponseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  module: z.string(),
  type: z.enum(ResourceType),
  parentCode: z.string().nullable(),
  sortOrder: z.number(),
  icon: z.string().nullable(),
  description: z.string().nullable(),
  isActive: z.boolean(),
});

export const resourceListResponseSchema = z.object({
  data: z.array(resourceResponseSchema),
  meta: z.object({
    total: z.number(),
  }),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type ListResourcesQuery = z.infer<typeof listResourcesQuerySchema>;
export type ResourceResponse = z.infer<typeof resourceResponseSchema>;
