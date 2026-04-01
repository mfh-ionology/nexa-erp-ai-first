import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

/** Body for PUT /accounts/:id/mandatory-dimensions — replace all mandatory dimension types for an account */
export const setMandatoryDimensionsSchema = z.object({
  dimensionTypeIds: z.array(z.uuid()),
});

/** Body for POST /mandatory-dimensions/bulk-assign */
export const bulkAssignMandatoryDimensionsSchema = z
  .object({
    dimensionTypeIds: z.array(z.uuid()).min(1),
    accountIds: z.array(z.uuid()).optional(),
    accountRange: z
      .object({
        from: z.string().min(1).max(20),
        to: z.string().min(1).max(20),
      })
      .optional(),
  })
  .refine((data) => data.accountIds !== undefined || data.accountRange !== undefined, {
    message: 'Either accountIds or accountRange must be provided',
  });

// ---------------------------------------------------------------------------
// Params Schemas
// ---------------------------------------------------------------------------

export const accountIdParamsSchema = z.object({ id: z.uuid() });

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const mandatoryDimensionItemSchema = z.object({
  id: z.string(),
  dimensionTypeId: z.string(),
  dimensionType: z
    .object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
    })
    .optional(),
  createdAt: z.coerce.date(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type SetMandatoryDimensionsInput = z.infer<typeof setMandatoryDimensionsSchema>;
export type BulkAssignMandatoryDimensionsInput = z.infer<
  typeof bulkAssignMandatoryDimensionsSchema
>;
