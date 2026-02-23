import { z } from 'zod';

// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------

export const tenantIdParams = z.object({
  tenantId: z.uuid(),
});

// ---------------------------------------------------------------------------
// POST /platform/tenants/:tenantId/ai/check
// ---------------------------------------------------------------------------

export const aiCheckRequestSchema = z.object({
  estimatedTokens: z.number().int().positive(),
  featureKey: z.string().min(1).max(100),
});

export const aiCheckResponseSchema = z.object({
  allowed: z.boolean(),
  remainingTokens: z.number(),
  quotaPct: z.number(),
  warning: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /platform/tenants/:tenantId/ai/record
// ---------------------------------------------------------------------------

export const aiRecordRequestSchema = z.object({
  // ISSUE #30 FIX: Validate userId as UUID (all ERP user IDs are UUIDs)
  userId: z.uuid(),
  featureKey: z.string().min(1).max(100),
  provider: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  totalTokens: z.number().int().positive(),
  costEstimate: z.number().min(0),
  requestId: z.string().min(1).max(100),
  isByok: z.boolean().default(false),
  latencyMs: z.number().int().min(0).optional(),
  fallbackUsed: z.boolean().default(false),
  fallbackFrom: z.string().max(100).optional(),
});

export const aiRecordResponseSchema = z.object({
  recorded: z.literal(true),
  quotaPct: z.number(),
});

// ---------------------------------------------------------------------------
// GET /platform/tenants/:tenantId/ai/usage
// ---------------------------------------------------------------------------

export const aiUsageResponseSchema = z.object({
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  summary: z.object({
    tokensUsed: z.number(),
    tokenAllowance: z.number(),
    quotaPct: z.number(),
    totalRequests: z.number(),
    totalCost: z.number(),
  }),
  byFeature: z.array(
    z.object({
      featureKey: z.string(),
      totalTokens: z.number(),
      requestCount: z.number(),
      totalCost: z.number(),
    }),
  ),
  byProvider: z.array(
    z.object({
      provider: z.string(),
      totalTokens: z.number(),
      requestCount: z.number(),
      totalCost: z.number(),
    }),
  ),
  warnings: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type AiCheckRequest = z.infer<typeof aiCheckRequestSchema>;
export type AiCheckResponse = z.infer<typeof aiCheckResponseSchema>;
export type AiRecordRequest = z.infer<typeof aiRecordRequestSchema>;
export type AiRecordResponse = z.infer<typeof aiRecordResponseSchema>;
export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>;
