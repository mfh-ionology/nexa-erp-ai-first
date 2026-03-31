import { z } from 'zod';

import { journalDetailSchema } from './journals.schema.js';

// ---------------------------------------------------------------------------
// Shared line schema
// ---------------------------------------------------------------------------

const openingBalanceLineSchema = z.object({
  accountCode: z.string().min(2).max(20),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

/** AC-1: CSV import — raw CSV string with AccountCode,Debit,Credit columns */
export const importCsvBodySchema = z.object({
  /** Raw CSV content (header row + data rows) */
  csv: z.string().min(1, 'CSV content is required'),
  /** Transaction date for the opening balance journal (defaults to fiscal year start) */
  transactionDate: z.coerce.date().optional(),
  /** Optional description override */
  description: z.string().max(500).optional(),
});

/** AC-2: Manual entry — array of lines */
export const importManualBodySchema = z.object({
  lines: z.array(openingBalanceLineSchema).min(1, 'At least one line is required'),
  /** Transaction date for the opening balance journal */
  transactionDate: z.coerce.date().optional(),
  /** Optional description override */
  description: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const openingBalanceResultSchema = z.object({
  journalEntry: journalDetailSchema,
  /** Number of lines in the posted journal (excluding auto-generated suspense) */
  lineCount: z.number(),
  /** Whether a suspense line was added to balance the entry */
  suspenseAdded: z.boolean(),
  /** Amount posted to suspense (0 if balanced) */
  suspenseAmount: z.number(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type ImportCsvBody = z.infer<typeof importCsvBodySchema>;
export type ImportManualBody = z.infer<typeof importManualBodySchema>;
export type OpeningBalanceLine = z.infer<typeof openingBalanceLineSchema>;
export type OpeningBalanceResult = z.infer<typeof openingBalanceResultSchema>;
