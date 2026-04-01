import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createDimensionTypeSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(10, 'Code must not exceed 10 characters')
    .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores'),
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  isSingleSelect: z.boolean().default(true),
  allowManualEntry: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999),
});

export const updateDimensionTypeSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    isSingleSelect: z.boolean().optional(),
    allowManualEntry: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const dimensionTypeParamsSchema = z.object({ id: z.uuid() });

export const listDimensionTypesQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const dimensionTypeItemSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSingleSelect: z.boolean(),
  allowManualEntry: z.boolean(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const dimensionTypeDetailSchema = dimensionTypeItemSchema.extend({
  _count: z.object({ values: z.number() }).optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateDimensionTypeInput = z.infer<typeof createDimensionTypeSchema>;
export type UpdateDimensionTypeInput = z.infer<typeof updateDimensionTypeSchema>;
export type ListDimensionTypesQuery = z.infer<typeof listDimensionTypesQuerySchema>;
