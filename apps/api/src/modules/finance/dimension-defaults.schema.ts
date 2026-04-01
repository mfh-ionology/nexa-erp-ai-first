import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ENTITY_TYPES = ['ACCOUNT', 'CUSTOMER', 'SUPPLIER', 'ITEM', 'COMPANY'] as const;

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createDimensionDefaultSchema = z
  .object({
    dimensionTypeId: z.uuid(),
    dimensionValueId: z.uuid(),
    entityType: z.enum(ENTITY_TYPES),
    entityId: z.uuid().optional(),
  })
  .refine(
    (data) => {
      if (data.entityType === 'COMPANY') return true; // entityId is optional for COMPANY
      return data.entityId !== undefined;
    },
    {
      message: 'entityId is required for non-COMPANY entity types',
      path: ['entityId'],
    },
  );

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const dimensionDefaultParamsSchema = z.object({ id: z.uuid() });

export const listDimensionDefaultsQuerySchema = z.object({
  entityType: z.enum(ENTITY_TYPES).optional(),
  entityId: z.uuid().optional(),
  dimensionTypeId: z.uuid().optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const dimensionDefaultItemSchema = z.object({
  id: z.uuid(),
  dimensionTypeId: z.uuid(),
  dimensionValueId: z.uuid(),
  entityType: z.string(),
  entityId: z.uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  dimensionType: z
    .object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
    })
    .optional(),
  dimensionValue: z
    .object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateDimensionDefaultInput = z.infer<typeof createDimensionDefaultSchema>;
export type ListDimensionDefaultsQuery = z.infer<typeof listDimensionDefaultsQuerySchema>;
