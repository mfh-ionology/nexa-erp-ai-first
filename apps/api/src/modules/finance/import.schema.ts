import { z } from 'zod';

// ---------------------------------------------------------------------------
// Import Result Schema (shared by all import endpoints)
// ---------------------------------------------------------------------------

export const importErrorSchema = z.object({
  row: z.number(),
  message: z.string(),
});

export const importResultSchema = z.object({
  imported: z.number(),
  skipped: z.number(),
  errors: z.array(importErrorSchema),
});

export type ImportResult = z.infer<typeof importResultSchema>;

// ---------------------------------------------------------------------------
// Account Import Row Schema
// ---------------------------------------------------------------------------

export const accountImportRowSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  parentCode: z.string().max(20).optional().default(''),
  classificationCode: z.string().max(10).optional().default(''),
  taxCode: z.string().max(20).optional().default(''),
  isPostable: z.preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean()),
});

export type AccountImportRow = z.infer<typeof accountImportRowSchema>;

// ---------------------------------------------------------------------------
// Journal Import Row Schema
// ---------------------------------------------------------------------------

export const journalImportRowSchema = z.object({
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional().default(''),
  accountCode: z.string().min(1).max(20),
  debit: z.preprocess(Number, z.number().min(0)),
  credit: z.preprocess(Number, z.number().min(0)),
  vatCode: z.string().max(20).optional().default(''),
});

export type JournalImportRow = z.infer<typeof journalImportRowSchema>;

// ---------------------------------------------------------------------------
// Budget Import Row Schema
// ---------------------------------------------------------------------------

export const budgetImportRowSchema = z.object({
  accountCode: z.string().min(1).max(20),
  period1: z.preprocess(Number, z.number()),
  period2: z.preprocess(Number, z.number()),
  period3: z.preprocess(Number, z.number()),
  period4: z.preprocess(Number, z.number()),
  period5: z.preprocess(Number, z.number()),
  period6: z.preprocess(Number, z.number()),
  period7: z.preprocess(Number, z.number()),
  period8: z.preprocess(Number, z.number()),
  period9: z.preprocess(Number, z.number()),
  period10: z.preprocess(Number, z.number()),
  period11: z.preprocess(Number, z.number()),
  period12: z.preprocess(Number, z.number()),
});

export type BudgetImportRow = z.infer<typeof budgetImportRowSchema>;

// ---------------------------------------------------------------------------
// Exchange Rate Import Row Schema
// ---------------------------------------------------------------------------

export const exchangeRateImportRowSchema = z.object({
  currencyCode: z.string().min(3).max(3),
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  buyRate: z.preprocess(Number, z.number().positive()),
  sellRate: z.preprocess(Number, z.number().positive()),
  midRate: z.preprocess(Number, z.number().positive()),
  source: z.string().max(20).optional().default('MANUAL'),
});

export type ExchangeRateImportRow = z.infer<typeof exchangeRateImportRowSchema>;
