// ---------------------------------------------------------------------------
// Intelligence Pipeline Schemas — Zod schemas for cross-tenant intelligence
// Source: API Contracts §21, Story E5d-3 Task 8
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared pagination
// ---------------------------------------------------------------------------

const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Request Schemas — Query
// ---------------------------------------------------------------------------

export const listPatternsQuerySchema = cursorPaginationSchema.extend({
  industry: z.string().optional(),
  planTier: z.string().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  tenantId: z.string().uuid().optional(),
});

export const listCorrectionsQuerySchema = cursorPaginationSchema.extend({
  correctionType: z.string().optional(),
  skillKey: z.string().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

export const listSkillEffectivenessQuerySchema = cursorPaginationSchema.extend({
  skillKey: z.string().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  trend: z.enum(['IMPROVING', 'STABLE', 'DECLINING']).optional(),
});

export const listInsightsQuerySchema = cursorPaginationSchema.extend({
  insightType: z
    .enum(['FEATURE_GAP', 'WORKFLOW_OPPORTUNITY', 'DEFAULT_CANDIDATE', 'SKILL_IMPROVEMENT'])
    .optional(),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  status: z.enum(['NEW', 'REVIEWED', 'ACTIONED', 'DISMISSED']).optional(),
});

// ---------------------------------------------------------------------------
// Request Schemas — Body / Params
// ---------------------------------------------------------------------------

export const updateInsightBodySchema = z.object({
  status: z.enum(['NEW', 'REVIEWED', 'ACTIONED', 'DISMISSED']),
  reviewedById: z.string().uuid().optional(),
});

export const insightIdParamsSchema = z.object({
  id: z.uuid(),
});

export const aggregateBodySchema = z.object({
  date: z.string().date().optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const patternResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  patternDate: z.string(),
  industry: z.string().nullable(),
  planTier: z.string().nullable(),
  queryCategories: z.unknown(),
  skillUsage: z.unknown(),
  viewPatterns: z.unknown(),
  automationUsage: z.unknown(),
  createdAt: z.string(),
});

export const correctionResponseSchema = z.object({
  id: z.string(),
  patternDate: z.string(),
  industry: z.string().nullable(),
  correctionType: z.string(),
  skillKey: z.string().nullable(),
  occurrenceCount: z.number(),
  tenantCount: z.number(),
  commonCorrection: z.string().nullable(),
  createdAt: z.string(),
});

export const skillEffectivenessResponseSchema = z.object({
  id: z.string(),
  skillKey: z.string(),
  measureDate: z.string(),
  tenantCount: z.number(),
  totalQueries: z.number(),
  avgSuccessRate: z.string(),
  avgCorrectionRate: z.string(),
  avgConfidence: z.string(),
  trend: z.string().nullable(),
  createdAt: z.string(),
});

export const insightResponseSchema = z.object({
  id: z.string(),
  insightType: z.string(),
  title: z.string(),
  description: z.string(),
  evidence: z.unknown(),
  severity: z.string(),
  status: z.string(),
  reviewedById: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const summaryResponseSchema = z.object({
  totalContributingTenants: z.number(),
  totalPatterns: z.number(),
  totalCorrections: z.number(),
  overallAiSuccessRate: z.number().nullable(),
  topSkillsByUsage: z.array(
    z.object({
      skillKey: z.string(),
      totalQueries: z.number(),
      avgSuccessRate: z.string(),
      trend: z.string().nullable(),
    }),
  ),
  topInsightsBySeverity: z.array(insightResponseSchema),
});

export const aggregationResultResponseSchema = z.object({
  processedTenants: z.number(),
  skippedTenants: z.number(),
  patternsCreated: z.number(),
  correctionsCreated: z.number(),
});

export const insightsResultResponseSchema = z.object({
  insightsGenerated: z.number(),
  byType: z.object({
    featureGap: z.number(),
    workflowOpportunity: z.number(),
    defaultCandidate: z.number(),
    skillImprovement: z.number(),
  }),
});

// ---------------------------------------------------------------------------
// List response schemas
// ---------------------------------------------------------------------------

export const patternListResponseSchema = z.array(patternResponseSchema);
export const correctionListResponseSchema = z.array(correctionResponseSchema);
export const skillEffectivenessListResponseSchema = z.array(skillEffectivenessResponseSchema);
export const insightListResponseSchema = z.array(insightResponseSchema);

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------

export type ListPatternsQuery = z.infer<typeof listPatternsQuerySchema>;
export type ListCorrectionsQuery = z.infer<typeof listCorrectionsQuerySchema>;
export type ListSkillEffectivenessQuery = z.infer<typeof listSkillEffectivenessQuerySchema>;
export type ListInsightsQuery = z.infer<typeof listInsightsQuerySchema>;
export type UpdateInsightBody = z.infer<typeof updateInsightBodySchema>;
export type InsightIdParams = z.infer<typeof insightIdParamsSchema>;
export type AggregateBody = z.infer<typeof aggregateBodySchema>;
