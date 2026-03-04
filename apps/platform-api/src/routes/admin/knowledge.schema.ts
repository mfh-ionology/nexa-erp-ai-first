// ---------------------------------------------------------------------------
// Platform Knowledge Article Schemas — Zod schemas for knowledge CRUD
// Source: API Contracts §21, Story E5d-4 Task 2
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
// Enums
// ---------------------------------------------------------------------------

const knowledgeStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const knowledgeCategoryEnum = z.enum(['BEST_PRACTICE', 'HELP', 'DEFAULT_CONFIG', 'SKILL_UPDATE']);

// ---------------------------------------------------------------------------
// Request Schemas — Query
// ---------------------------------------------------------------------------

export const listKnowledgeQuerySchema = cursorPaginationSchema.extend({
  status: knowledgeStatusEnum.optional(),
  category: knowledgeCategoryEnum.optional(),
});

// ---------------------------------------------------------------------------
// Request Schemas — Params
// ---------------------------------------------------------------------------

export const knowledgeIdParamsSchema = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Request Schemas — Body
// ---------------------------------------------------------------------------

export const createKnowledgeBodySchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100000),
  category: knowledgeCategoryEnum,
  targetIndustries: z.array(z.string()).default([]),
  targetPlanTiers: z.array(z.string()).default([]),
});

export const updateKnowledgeBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(100000).optional(),
  category: knowledgeCategoryEnum.optional(),
  targetIndustries: z.array(z.string()).optional(),
  targetPlanTiers: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const distributionSummarySchema = z.object({
  accepted: z.number(),
  rejected: z.number(),
  pending: z.number(),
});

const distributionStatsSchema = distributionSummarySchema.extend({
  totalEligibleTenants: z.number(),
});

export const knowledgeResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string(),
  targetIndustries: z.array(z.string()),
  targetPlanTiers: z.array(z.string()),
  version: z.number(),
  status: z.string(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdById: z.string(),
  distributionStats: distributionStatsSchema.optional(),
  distributionSummary: distributionSummarySchema.optional(),
});

export const knowledgeListResponseSchema = z.array(knowledgeResponseSchema);

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------

export type ListKnowledgeQuery = z.infer<typeof listKnowledgeQuerySchema>;
export type KnowledgeIdParams = z.infer<typeof knowledgeIdParamsSchema>;
export type CreateKnowledgeBody = z.infer<typeof createKnowledgeBodySchema>;
export type UpdateKnowledgeBody = z.infer<typeof updateKnowledgeBodySchema>;
