import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum constants
// ---------------------------------------------------------------------------

export const RULE_MATCH_TYPES = ['EXACT', 'STARTS_WITH', 'CONTAINS', 'REGEX'] as const;

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  matchType: z.enum(RULE_MATCH_TYPES, { error: 'Invalid match type' }),
  matchPattern: z.string().min(1, 'Match pattern is required').max(500),
  targetAccountCode: z.string().min(1, 'Target account code is required').max(20),
  description: z.string().max(500).optional(),
  vatCode: z.string().max(20).optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  matchType: z.enum(RULE_MATCH_TYPES).optional(),
  matchPattern: z.string().min(1).max(500).optional(),
  targetAccountCode: z.string().min(1).max(20).optional(),
  description: z.string().max(500).nullable().optional(),
  vatCode: z.string().max(20).nullable().optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const ruleParamsSchema = z.object({
  id: z.uuid(),
});

export const listRulesQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const ruleResponseSchema = z.object({
  id: z.uuid(),
  companyId: z.string(),
  name: z.string(),
  matchType: z.enum(RULE_MATCH_TYPES),
  matchPattern: z.string(),
  targetAccountCode: z.string(),
  description: z.string().nullable(),
  vatCode: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string(),
});

// ---------------------------------------------------------------------------
// Apply rules schemas
// ---------------------------------------------------------------------------

export const applyRulesParamsSchema = z.object({
  id: z.uuid(), // bank account ID
});

export const ruleSuggestionSchema = z.object({
  bankTransactionId: z.uuid(),
  ruleId: z.uuid(),
  ruleName: z.string(),
  suggestedAccountCode: z.string(),
  suggestedDescription: z.string().nullable(),
});

export const createJournalFromRuleSchema = z.object({
  bankTransactionId: z.uuid('Bank transaction ID is required'),
  ruleId: z.uuid('Rule ID is required'),
  accountCode: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
});

export const createJournalFromRuleParamsSchema = z.object({
  id: z.uuid(), // bank account ID
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
export type ListRulesQuery = z.infer<typeof listRulesQuerySchema>;
export type RuleSuggestion = z.infer<typeof ruleSuggestionSchema>;
export type CreateJournalFromRuleInput = z.infer<typeof createJournalFromRuleSchema>;
