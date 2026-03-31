import { z } from 'zod';

// ---------------------------------------------------------------------------
// Year-End Close Request Schema
// ---------------------------------------------------------------------------

/**
 * POST /year-end/close — Trigger year-end close for a fiscal year (AC-1)
 */
export const yearEndCloseSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
});

export type YearEndCloseInput = z.infer<typeof yearEndCloseSchema>;

// ---------------------------------------------------------------------------
// Year-End Close Response Schema
// ---------------------------------------------------------------------------

export const yearEndAccountLineSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  debit: z.number(),
  credit: z.number(),
});

export const yearEndResultSchema = z.object({
  fiscalYear: z.number().int(),
  journalEntryId: z.string(),
  journalEntryNumber: z.string(),
  p13PeriodId: z.string(),
  retainedEarningsAccountCode: z.string(),
  netProfitLoss: z.number(),
  lineCount: z.number(),
  periodsLocked: z.number(),
  closedAt: z.string(),
  closedBy: z.string(),
});

export type YearEndResult = z.infer<typeof yearEndResultSchema>;
