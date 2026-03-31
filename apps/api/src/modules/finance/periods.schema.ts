import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum constants (matching Prisma PeriodStatus)
// ---------------------------------------------------------------------------

export const PERIOD_STATUSES = ['OPEN', 'CLOSED', 'LOCKED'] as const;

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

/**
 * POST /periods/year — Create fiscal year periods (AC-1)
 * fiscalYear: the fiscal year number (e.g. 2026)
 * includeP13: whether to include a Period 13 year-end adjustment period
 */
export const createFiscalYearSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  includeP13: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const periodParamsSchema = z.object({
  id: z.uuid(),
});

export const listPeriodsQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100).optional(),
  status: z.enum(PERIOD_STATUSES).optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const periodSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  periodNumber: z.number().int(),
  fiscalYear: z.number().int(),
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  status: z.enum(PERIOD_STATUSES),
  closedAt: z.string().nullable(),
  closedBy: z.string().nullable(),
  lockedAt: z.string().nullable(),
  lockedBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const fiscalYearGroupSchema = z.object({
  fiscalYear: z.number().int(),
  periods: z.array(periodSchema),
  summary: z.object({
    total: z.number().int(),
    open: z.number().int(),
    closed: z.number().int(),
    locked: z.number().int(),
  }),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateFiscalYearInput = z.infer<typeof createFiscalYearSchema>;
export type ListPeriodsQuery = z.infer<typeof listPeriodsQuerySchema>;
export type PeriodResponse = z.infer<typeof periodSchema>;
export type FiscalYearGroup = z.infer<typeof fiscalYearGroupSchema>;
