import { z } from 'zod';

import { ACCOUNT_TYPES, NORMAL_BALANCES } from './accounts.schema.js';
import { JOURNAL_SOURCES } from './journals.schema.js';

// ---------------------------------------------------------------------------
// Query Schemas
// ---------------------------------------------------------------------------

export const trialBalanceQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
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
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
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
// Transaction Journal — Query Schema
// ---------------------------------------------------------------------------

export const transactionJournalQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  accountCode: z.string().optional(),
  source: z.enum(JOURNAL_SOURCES).optional(),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Transaction Journal — Response Schemas
// ---------------------------------------------------------------------------

const transactionJournalLineSchema = z.object({
  lineNumber: z.number(),
  accountCode: z.string(),
  accountName: z.string(),
  description: z.string().nullable(),
  debit: z.number(),
  credit: z.number(),
});

const transactionJournalEntrySchema = z.object({
  id: z.string(),
  entryNumber: z.string(),
  transactionDate: z.string(),
  description: z.string(),
  reference: z.string().nullable(),
  source: z.enum(JOURNAL_SOURCES),
  status: z.string(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  lines: z.array(transactionJournalLineSchema),
});

export const transactionJournalResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  totalEntries: z.number(),
  entries: z.array(transactionJournalEntrySchema),
});

// ---------------------------------------------------------------------------
// Budget Variance — Query Schema
// ---------------------------------------------------------------------------

export const budgetVarianceQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  budgetId: z.string().uuid().optional(),
  budgetVersionId: z.string().uuid().optional(),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Budget Variance — Response Schemas
// ---------------------------------------------------------------------------

const budgetVarianceLineSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  budgetAmount: z.number(),
  actualAmount: z.number(),
  variance: z.number(),
  variancePercentage: z.number().nullable(),
});

const budgetVarianceSummarySchema = z.object({
  totalBudget: z.number(),
  totalActual: z.number(),
  totalVariance: z.number(),
});

export const budgetVarianceResponseSchema = z.object({
  fiscalYear: z.number(),
  budgetId: z.string(),
  budgetName: z.string(),
  accounts: z.array(budgetVarianceLineSchema),
  summary: budgetVarianceSummarySchema,
});

// ---------------------------------------------------------------------------
// GL Detail / Account Activity -- Query Schema
// ---------------------------------------------------------------------------

export const glDetailQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  accountCode: z.string().min(1).max(20),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GL Detail / Account Activity -- Response Schemas
// ---------------------------------------------------------------------------

const glDetailDimensionSchema = z.object({
  dimensionTypeName: z.string(),
  dimensionValueName: z.string(),
});

const glDetailEntrySchema = z.object({
  journalEntryId: z.string(),
  entryNumber: z.string(),
  transactionDate: z.string(),
  description: z.string(),
  reference: z.string().nullable(),
  source: z.string(),
  debit: z.number(),
  credit: z.number(),
  runningBalance: z.number(),
  isSimulation: z.boolean(),
  dimensions: z.array(glDetailDimensionSchema),
});

export const glDetailResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  accountCode: z.string(),
  accountName: z.string(),
  openingBalance: z.number(),
  entries: z.array(glDetailEntrySchema),
  closingBalance: z.number(),
  totalDebit: z.number(),
  totalCredit: z.number(),
});

// ---------------------------------------------------------------------------
// General Ledger -- Query Schema
// ---------------------------------------------------------------------------

export const generalLedgerQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  accountCodeFrom: z.string().max(20).optional(),
  accountCodeTo: z.string().max(20).optional(),
  dimensionTypeId: z.string().uuid().optional(),
  dimensionValueId: z.string().uuid().optional(),
  includeSimulations: z.coerce.boolean().optional(),
});

// ---------------------------------------------------------------------------
// General Ledger -- Response Schemas
// ---------------------------------------------------------------------------

const generalLedgerEntrySchema = z.object({
  entryNumber: z.string(),
  transactionDate: z.string(),
  description: z.string(),
  debit: z.number(),
  credit: z.number(),
  runningBalance: z.number(),
});

const generalLedgerAccountSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  openingBalance: z.number(),
  entries: z.array(generalLedgerEntrySchema),
  closingBalance: z.number(),
  totalDebit: z.number(),
  totalCredit: z.number(),
});

export const generalLedgerResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  accounts: z.array(generalLedgerAccountSchema),
  grandTotals: z.object({
    totalDebit: z.number(),
    totalCredit: z.number(),
  }),
});

// ---------------------------------------------------------------------------
// Departmental P&L -- Query Schema
// ---------------------------------------------------------------------------

export const departmentalPnlQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodFrom: z.coerce.number().int().min(1).max(13).default(1),
  periodTo: z.coerce.number().int().min(1).max(13).default(12),
  dimensionTypeId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Departmental P&L -- Response Schemas
// ---------------------------------------------------------------------------

const departmentalPnlColumnSchema = z.object({
  dimensionValueId: z.string(),
  dimensionValueName: z.string(),
  dimensionValueCode: z.string(),
});

const departmentalPnlAccountSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  values: z.array(z.number()),
  total: z.number(),
});

const departmentalPnlSectionSchema = z.object({
  classification: z.string(),
  name: z.string(),
  accounts: z.array(departmentalPnlAccountSchema),
  totals: z.array(z.number()),
  grandTotal: z.number(),
});

export const departmentalPnlResponseSchema = z.object({
  fiscalYear: z.number(),
  periodFrom: z.number(),
  periodTo: z.number(),
  dimensionTypeName: z.string(),
  columns: z.array(departmentalPnlColumnSchema),
  sections: z.array(departmentalPnlSectionSchema),
  summary: z.object({
    netProfitPerColumn: z.array(z.number()),
    totalNetProfit: z.number(),
  }),
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

export type TransactionJournalQuery = z.infer<typeof transactionJournalQuerySchema>;
export type TransactionJournalResponse = z.infer<typeof transactionJournalResponseSchema>;
export type BudgetVarianceQuery = z.infer<typeof budgetVarianceQuerySchema>;
export type BudgetVarianceResponse = z.infer<typeof budgetVarianceResponseSchema>;

export type GLDetailQuery = z.infer<typeof glDetailQuerySchema>;
export type GLDetailResponse = z.infer<typeof glDetailResponseSchema>;
export type GeneralLedgerQuery = z.infer<typeof generalLedgerQuerySchema>;
export type GeneralLedgerResponse = z.infer<typeof generalLedgerResponseSchema>;
export type DepartmentalPnlQuery = z.infer<typeof departmentalPnlQuerySchema>;
export type DepartmentalPnlResponse = z.infer<typeof departmentalPnlResponseSchema>;
