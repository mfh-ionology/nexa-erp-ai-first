import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createBudgetVersionSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  versionName: z.string().min(1, 'Version name is required').max(100),
  copyFromVersionId: z.string().uuid().optional(),
});

export const updateBudgetVersionSchema = z
  .object({
    versionName: z.string().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const budgetVersionParamsSchema = z.object({
  id: z.uuid(),
});

export const listBudgetVersionsQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const budgetVersionListItemSchema = z.object({
  id: z.string(),
  fiscalYear: z.number(),
  versionNumber: z.number(),
  versionName: z.string(),
  copiedFromVersionId: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  _count: z
    .object({
      budgets: z.number(),
    })
    .optional(),
});

export const budgetVersionDetailSchema = budgetVersionListItemSchema.extend({
  copiedFromVersion: z
    .object({
      id: z.string(),
      versionName: z.string(),
      versionNumber: z.number(),
    })
    .nullable()
    .optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateBudgetVersionInput = z.infer<typeof createBudgetVersionSchema>;
export type UpdateBudgetVersionInput = z.infer<typeof updateBudgetVersionSchema>;
export type ListBudgetVersionsQuery = z.infer<typeof listBudgetVersionsQuerySchema>;
export type BudgetVersionListItem = z.infer<typeof budgetVersionListItemSchema>;
export type BudgetVersionDetail = z.infer<typeof budgetVersionDetailSchema>;
