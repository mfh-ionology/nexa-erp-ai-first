import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum constants
// ---------------------------------------------------------------------------

export const RECONCILIATION_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'] as const;
export const MATCH_TYPES = ['MANUAL', 'AUTO', 'AI_SUGGESTED'] as const;

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createReconciliationSchema = z.object({
  statementDate: z.coerce.date({ error: 'Statement date is required' }),
  statementBalance: z.number({ error: 'Statement balance is required' }),
});

export const createMatchSchema = z.object({
  bankTransactionId: z.uuid('Bank transaction ID is required'),
  journalLineId: z.uuid('Journal line ID is required'),
});

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const bankAccountParamsSchema = z.object({
  bankAccountId: z.uuid(),
});

export const reconciliationParamsSchema = z.object({
  bankAccountId: z.uuid(),
  id: z.uuid(),
});

export const bankTransactionParamsSchema = z.object({
  id: z.uuid(),
});

/** Match endpoint uses bank account :id param (not :bankAccountId) */
export const matchBankAccountParamsSchema = z.object({
  id: z.uuid(),
});

export const listReconciliationsQuerySchema = z.object({
  status: z.enum(RECONCILIATION_STATUSES).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const reconciliationListItemSchema = z.object({
  id: z.uuid(),
  bankAccountId: z.uuid(),
  statementDate: z.coerce.date(),
  statementBalance: z.number(),
  glBalance: z.number().nullable(),
  difference: z.number().nullable(),
  status: z.enum(RECONCILIATION_STATUSES),
  completedAt: z.coerce.date().nullable(),
  completedBy: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string(),
});

const matchedTransactionSchema = z.object({
  matchId: z.uuid(),
  bankTransactionId: z.uuid(),
  journalLineId: z.string().nullable(),
  matchType: z.string(),
  confidence: z.number().nullable(),
  matchedAt: z.coerce.date(),
  matchedBy: z.string().nullable(),
  bankTransaction: z.object({
    id: z.uuid(),
    transactionDate: z.coerce.date(),
    description: z.string(),
    amount: z.number(),
    reference: z.string().nullable(),
    type: z.string().nullable(),
  }),
});

const unmatchedTransactionSchema = z.object({
  id: z.uuid(),
  transactionDate: z.coerce.date(),
  description: z.string(),
  amount: z.number(),
  reference: z.string().nullable(),
  type: z.string().nullable(),
  isMatched: z.boolean(),
});

export const reconciliationDetailSchema = reconciliationListItemSchema.extend({
  matchedTransactions: z.array(matchedTransactionSchema),
  unmatchedTransactions: z.array(unmatchedTransactionSchema),
});

export const matchResponseSchema = z.object({
  id: z.uuid(),
  bankTransactionId: z.uuid(),
  journalLineId: z.string().nullable(),
  matchType: z.string(),
  confidence: z.number().nullable(),
  matchedAt: z.coerce.date(),
  matchedBy: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateReconciliationInput = z.infer<typeof createReconciliationSchema>;
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type ListReconciliationsQuery = z.infer<typeof listReconciliationsQuerySchema>;
