import { z } from 'zod';

// ---------------------------------------------------------------------------
// Month-End Close Step Codes
// ---------------------------------------------------------------------------

export const MONTH_END_STEP_CODES = [
  'RECONCILE_BANKS',
  'REVIEW_UNPOSTED',
  'REVIEW_ACCRUALS',
  'REVIEW_FIXED_ASSETS',
  'REVIEW_VAT',
  'CLOSE_PERIOD',
] as const;

export type MonthEndStepCode = (typeof MONTH_END_STEP_CODES)[number];

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

/**
 * POST /month-end/start — Initiate month-end close for a period (AC-1)
 */
export const startMonthEndSchema = z.object({
  periodId: z.uuid(),
});

/**
 * Params for period-scoped month-end routes (AC-2, AC-4, AC-5)
 */
export const monthEndPeriodParamsSchema = z.object({
  periodId: z.uuid(),
});

/**
 * POST /month-end/:periodId/complete-step — Mark a step as done (AC-4)
 */
export const completeStepSchema = z.object({
  stepCode: z.enum(MONTH_END_STEP_CODES),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const monthEndStepSchema = z.object({
  code: z.enum(MONTH_END_STEP_CODES),
  name: z.string(),
  autoCheck: z.boolean(),
  completed: z.boolean(),
  completedAt: z.string().nullable(),
  completedBy: z.string().nullable(),
});

export const monthEndChecklistSchema = z.object({
  periodId: z.uuid(),
  periodName: z.string(),
  fiscalYear: z.number().int(),
  periodNumber: z.number().int(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']),
  steps: z.array(monthEndStepSchema),
  startedAt: z.string().nullable(),
  startedBy: z.string().nullable(),
  completedAt: z.string().nullable(),
  completedBy: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type StartMonthEndInput = z.infer<typeof startMonthEndSchema>;
export type CompleteStepInput = z.infer<typeof completeStepSchema>;
export type MonthEndStep = z.infer<typeof monthEndStepSchema>;
export type MonthEndChecklist = z.infer<typeof monthEndChecklistSchema>;
