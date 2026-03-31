import { z } from 'zod';

// ---------------------------------------------------------------------------
// Query Schema
// ---------------------------------------------------------------------------

export const dashboardQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100).optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const bankAccountBalanceSchema = z.object({
  name: z.string(),
  balance: z.number(),
});

const cashPositionSchema = z.object({
  totalBankBalance: z.number(),
  bankAccounts: z.array(bankAccountBalanceSchema),
});

const profitAndLossSchema = z.object({
  totalRevenue: z.number(),
  totalExpenses: z.number(),
  netProfit: z.number(),
});

const activitySchema = z.object({
  draftJournals: z.number(),
  unmatchedBankTransactions: z.number(),
  openPeriods: z.number(),
  closedPeriods: z.number(),
});

const alertSchema = z.object({
  type: z.string(),
  message: z.string(),
  severity: z.enum(['info', 'warning', 'error']),
});

export const dashboardResponseSchema = z.object({
  fiscalYear: z.number(),
  cashPosition: cashPositionSchema,
  profitAndLoss: profitAndLossSchema,
  activity: activitySchema,
  alerts: z.array(alertSchema),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type DashboardAlert = z.infer<typeof alertSchema>;
