import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const periodAmount = z.number().default(0);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

const splitLineSchema = z.object({
  dimensionValueId: z.string().uuid(),
  period1: periodAmount,
  period2: periodAmount,
  period3: periodAmount,
  period4: periodAmount,
  period5: periodAmount,
  period6: periodAmount,
  period7: periodAmount,
  period8: periodAmount,
  period9: periodAmount,
  period10: periodAmount,
  period11: periodAmount,
  period12: periodAmount,
});

export const putDimensionSplitsSchema = z.object({
  dimensionTypeId: z.string().uuid(),
  splits: z.array(splitLineSchema).min(1, 'At least one split is required'),
});

// ---------------------------------------------------------------------------
// Params Schemas
// ---------------------------------------------------------------------------

export const budgetLineSplitParamsSchema = z.object({
  budgetId: z.uuid(),
  lineId: z.uuid(),
});

export const deleteSplitParamsSchema = z.object({
  budgetId: z.uuid(),
  lineId: z.uuid(),
  dimensionTypeId: z.uuid(),
});

export const listSplitsQuerySchema = z.object({
  dimensionTypeId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const budgetLineDimensionSchema = z.object({
  id: z.string(),
  budgetLineId: z.string(),
  dimensionTypeId: z.string(),
  dimensionValueId: z.string(),
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
  totalAmount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type PutDimensionSplitsInput = z.infer<typeof putDimensionSplitsSchema>;
export type BudgetLineSplitParams = z.infer<typeof budgetLineSplitParamsSchema>;
export type DeleteSplitParams = z.infer<typeof deleteSplitParamsSchema>;
export type ListSplitsQuery = z.infer<typeof listSplitsQuerySchema>;
