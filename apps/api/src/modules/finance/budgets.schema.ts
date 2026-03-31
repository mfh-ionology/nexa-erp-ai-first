import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum constants (matching Prisma-generated BudgetStatus + budgetType)
// ---------------------------------------------------------------------------

export const BUDGET_STATUSES = ['DRAFT', 'APPROVED', 'LOCKED', 'ARCHIVED'] as const;
export const BUDGET_TYPES = ['ANNUAL', 'REVISED'] as const;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** A single period amount — Decimal(19,4) represented as number. */
const periodAmount = z.number().default(0);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

const budgetLineInputSchema = z.object({
  accountCode: z.string().min(1, 'Account code is required').max(20),
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

export const createBudgetSchema = z.object({
  name: z.string().min(1, 'Budget name is required').max(255),
  fiscalYear: z.number().int().min(2000).max(2100),
  budgetType: z.enum(BUDGET_TYPES).default('ANNUAL'),
  description: z.string().max(1000).optional(),
  lines: z.array(budgetLineInputSchema).min(1, 'At least one budget line is required'),
});

const updateBudgetLineSchema = z.object({
  accountCode: z.string().min(1).max(20),
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

export const updateBudgetSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).nullable().optional(),
    lines: z.array(updateBudgetLineSchema).min(1).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const budgetParamsSchema = z.object({
  id: z.uuid(),
});

export const listBudgetsQuerySchema = z.object({
  status: z.enum(BUDGET_STATUSES).optional(),
  fiscalYear: z.coerce.number().int().optional(),
  budgetType: z.enum(BUDGET_TYPES).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const searchBudgetsQuerySchema = z.object({
  search: z.string().min(1, 'Search term is required'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const budgetLineSchema = z.object({
  id: z.string(),
  accountCode: z.string(),
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

export const budgetListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  fiscalYear: z.number(),
  budgetType: z.string(),
  status: z.enum(BUDGET_STATUSES),
  description: z.string().nullable(),
  approvedAt: z.date().nullable(),
  approvedBy: z.string().nullable(),
  originalBudgetId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  updatedBy: z.string(),
  _count: z
    .object({
      lines: z.number(),
    })
    .optional(),
});

export const budgetDetailSchema = budgetListItemSchema.extend({
  lines: z.array(budgetLineSchema),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>;
export type SearchBudgetsQuery = z.infer<typeof searchBudgetsQuerySchema>;
export type BudgetListItem = z.infer<typeof budgetListItemSchema>;
export type BudgetDetail = z.infer<typeof budgetDetailSchema>;
