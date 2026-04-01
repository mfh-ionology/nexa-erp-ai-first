import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Percentage field: Decimal(7,4) represented as number, 0-100 range */
const pctField = z.number().min(0).max(100);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createBudgetKeySchema = z
  .object({
    name: z.string().min(1, 'Budget key name is required').max(100),
    pct1: pctField,
    pct2: pctField,
    pct3: pctField,
    pct4: pctField,
    pct5: pctField,
    pct6: pctField,
    pct7: pctField,
    pct8: pctField,
    pct9: pctField,
    pct10: pctField,
    pct11: pctField,
    pct12: pctField,
  })
  .refine(
    (data) => {
      const sum =
        data.pct1 +
        data.pct2 +
        data.pct3 +
        data.pct4 +
        data.pct5 +
        data.pct6 +
        data.pct7 +
        data.pct8 +
        data.pct9 +
        data.pct10 +
        data.pct11 +
        data.pct12;
      return Math.abs(sum - 100) < 0.01; // tolerance for floating point
    },
    { message: 'Percentages must sum to 100' },
  );

export const updateBudgetKeySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    pct1: pctField.optional(),
    pct2: pctField.optional(),
    pct3: pctField.optional(),
    pct4: pctField.optional(),
    pct5: pctField.optional(),
    pct6: pctField.optional(),
    pct7: pctField.optional(),
    pct8: pctField.optional(),
    pct9: pctField.optional(),
    pct10: pctField.optional(),
    pct11: pctField.optional(),
    pct12: pctField.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

export const applyBudgetKeySchema = z.object({
  annualAmount: z.number().min(0, 'Annual amount must be non-negative'),
});

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const budgetKeyParamsSchema = z.object({
  id: z.uuid(),
});

export const listBudgetKeysQuerySchema = z.object({
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

export const budgetKeyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  pct1: z.number(),
  pct2: z.number(),
  pct3: z.number(),
  pct4: z.number(),
  pct5: z.number(),
  pct6: z.number(),
  pct7: z.number(),
  pct8: z.number(),
  pct9: z.number(),
  pct10: z.number(),
  pct11: z.number(),
  pct12: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
});

export const applyBudgetKeyResultSchema = z.object({
  period1: z.number(),
  period2: z.number(),
  period3: z.number(),
  period4: z.number(),
  period5: z.number(),
  period6: z.number(),
  period7: z.number(),
  period8: z.number(),
  period9: z.number(),
  period10: z.number(),
  period11: z.number(),
  period12: z.number(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateBudgetKeyInput = z.infer<typeof createBudgetKeySchema>;
export type UpdateBudgetKeyInput = z.infer<typeof updateBudgetKeySchema>;
export type ApplyBudgetKeyInput = z.infer<typeof applyBudgetKeySchema>;
export type ListBudgetKeysQuery = z.infer<typeof listBudgetKeysQuerySchema>;
export type BudgetKeyItem = z.infer<typeof budgetKeyItemSchema>;
