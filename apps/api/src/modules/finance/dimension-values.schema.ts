import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createDimensionValueSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20, 'Code must not exceed 20 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with underscores/hyphens'),
  name: z.string().min(1, 'Name is required').max(200),
  parentId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateDimensionValueSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    parentId: z.uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const dimensionValueParamsSchema = z.object({
  typeId: z.uuid(),
  id: z.uuid(),
});

export const typeIdParamsSchema = z.object({
  typeId: z.uuid(),
});

export const listDimensionValuesQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  parentId: z.uuid().optional(),
  search: z.string().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const dimensionValueItemSchema = z.object({
  id: z.uuid(),
  dimensionTypeId: z.uuid(),
  code: z.string(),
  name: z.string(),
  parentId: z.uuid().nullable(),
  isActive: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const dimensionValueDetailSchema = dimensionValueItemSchema.extend({
  parent: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable().optional(),
  children: z.array(dimensionValueItemSchema).optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateDimensionValueInput = z.infer<typeof createDimensionValueSchema>;
export type UpdateDimensionValueInput = z.infer<typeof updateDimensionValueSchema>;
export type ListDimensionValuesQuery = z.infer<typeof listDimensionValuesQuerySchema>;
