import { z } from 'zod';

import { ACCOUNT_TYPES, NORMAL_BALANCES } from './accounts.schema.js';

// ---------------------------------------------------------------------------
// Query Schemas
// ---------------------------------------------------------------------------

export const trialBalanceQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const trialBalanceAccountSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.enum(ACCOUNT_TYPES),
  normalBalance: z.enum(NORMAL_BALANCES),
  openingBalance: z.number(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  closingBalance: z.number(),
});

export const trialBalanceTotalsSchema = z.object({
  totalDebit: z.number(),
  totalCredit: z.number(),
  isBalanced: z.boolean(),
});

export const trialBalanceResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  accounts: z.array(trialBalanceAccountSchema),
  totals: trialBalanceTotalsSchema,
});

// ---------------------------------------------------------------------------
// Shared Report Query Schema (P&L + Balance Sheet use same filters)
// ---------------------------------------------------------------------------

export const reportQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
});

// ---------------------------------------------------------------------------
// P&L + Balance Sheet — Account line within a section
// ---------------------------------------------------------------------------

const reportAccountLineSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  normalBalance: z.enum(NORMAL_BALANCES),
  openingBalance: z.number(),
  debits: z.number(),
  credits: z.number(),
  balance: z.number(),
});

// ---------------------------------------------------------------------------
// P&L + Balance Sheet — Section (one per classification)
// ---------------------------------------------------------------------------

const reportSectionSchema = z.object({
  classification: z.string(),
  name: z.string(),
  accounts: z.array(reportAccountLineSchema),
  total: z.number(),
});

// ---------------------------------------------------------------------------
// Profit & Loss Response Schema
// ---------------------------------------------------------------------------

export const profitAndLossResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  sections: z.array(reportSectionSchema),
  grossProfit: z.number(),
  operatingExpenses: z.number(),
  operatingProfit: z.number(),
  otherIncome: z.number(),
  financeCosts: z.number(),
  profitBeforeTax: z.number(),
  taxation: z.number(),
  netProfit: z.number(),
});

// ---------------------------------------------------------------------------
// Balance Sheet Response Schema
// ---------------------------------------------------------------------------

export const balanceSheetResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  sections: z.array(reportSectionSchema),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  totalEquity: z.number(),
  isBalanced: z.boolean(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>;
export type TrialBalanceAccount = z.infer<typeof trialBalanceAccountSchema>;
export type TrialBalanceTotals = z.infer<typeof trialBalanceTotalsSchema>;
export type TrialBalanceResponse = z.infer<typeof trialBalanceResponseSchema>;

export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ReportAccountLine = z.infer<typeof reportAccountLineSchema>;
export type ReportSection = z.infer<typeof reportSectionSchema>;
export type ProfitAndLossResponse = z.infer<typeof profitAndLossResponseSchema>;
export type BalanceSheetResponse = z.infer<typeof balanceSheetResponseSchema>;
