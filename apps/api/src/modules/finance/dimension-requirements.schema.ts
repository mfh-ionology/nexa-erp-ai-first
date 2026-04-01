import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createDimensionRequirementSchema = z.object({
  dimensionTypeId: z.uuid(),
  accountCodeFrom: z.string().min(1).max(20),
  accountCodeTo: z.string().min(1).max(20),
  isRequired: z.boolean().default(true),
});

export const updateDimensionRequirementSchema = z
  .object({
    accountCodeFrom: z.string().min(1).max(20).optional(),
    accountCodeTo: z.string().min(1).max(20).optional(),
    isRequired: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const dimensionRequirementParamsSchema = z.object({ id: z.uuid() });

export const listDimensionRequirementsQuerySchema = z.object({
  dimensionTypeId: z.uuid().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const dimensionRequirementItemSchema = z.object({
  id: z.uuid(),
  dimensionTypeId: z.uuid(),
  accountCodeFrom: z.string(),
  accountCodeTo: z.string(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  dimensionType: z
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

export type CreateDimensionRequirementInput = z.infer<typeof createDimensionRequirementSchema>;
export type UpdateDimensionRequirementInput = z.infer<typeof updateDimensionRequirementSchema>;
export type ListDimensionRequirementsQuery = z.infer<typeof listDimensionRequirementsQuerySchema>;
