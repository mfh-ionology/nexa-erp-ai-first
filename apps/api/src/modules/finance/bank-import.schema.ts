import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const bankImportParamsSchema = z.object({
  id: z.uuid(),
});

export const bankImportBodySchema = z.object({
  /** Raw file content as a string (CSV or OFX/QIF) */
  content: z.string().min(1, 'File content is required'),
  /** Format of the uploaded file */
  format: z.enum(['csv', 'ofx', 'qif']),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const importedTransactionSchema = z.object({
  id: z.string(),
  externalId: z.string().nullable(),
  transactionDate: z.string(),
  description: z.string(),
  amount: z.number(),
  reference: z.string().nullable(),
  type: z.string().nullable(),
});

export const bankImportResultSchema = z.object({
  importBatchId: z.string(),
  total: z.number(),
  imported: z.number(),
  duplicatesSkipped: z.number(),
  transactions: z.array(importedTransactionSchema),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type BankImportParams = z.infer<typeof bankImportParamsSchema>;
export type BankImportBody = z.infer<typeof bankImportBodySchema>;
export type BankImportResult = z.infer<typeof bankImportResultSchema>;
