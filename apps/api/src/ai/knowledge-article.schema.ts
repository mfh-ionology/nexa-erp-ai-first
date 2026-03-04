// ---------------------------------------------------------------------------
// Zod schemas for Knowledge Article CRUD endpoints (tenant knowledge)
// E5d-1 Task 7.1 — distinct from knowledge.schema.ts (E5b module knowledge)
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { VALID_CATEGORIES, VALID_SOURCES } from './knowledge-article.service.js';

// ─── Request schemas ────────────────────────────────────────────────────────

export const listArticlesQuerySchema = z.object({
  category: z.union([z.enum(VALID_CATEGORIES), z.array(z.enum(VALID_CATEGORIES))]).optional(),
  source: z.enum(VALID_SOURCES).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(200))
    .optional(),
});

export const articleIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Create body — REST endpoint always creates ADMIN_UPLOADED.
 * Internal service callers (correction-pattern, etc.) bypass this schema
 * and pass source directly to KnowledgeArticleService.createArticle().
 */
export const createArticleBodySchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100_000),
  category: z.enum(VALID_CATEGORIES),
});

/**
 * Update body — source is immutable (rejected at route level).
 * confidenceScore and isConfirmed are explicitly validated.
 * .strict() rejects any unknown fields.
 */
export const updateArticleBodySchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    content: z.string().min(1).max(100_000).optional(),
    category: z.enum(VALID_CATEGORIES).optional(),
    isActive: z.boolean().optional(),
    confidenceScore: z.number().min(0).max(1).optional(),
    isConfirmed: z.boolean().optional(),
  })
  .strict();

// ─── Response schemas ───────────────────────────────────────────────────────

export const articleResponseSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string(),
  source: z.string(),
  sourceRef: z.string().nullable(),
  confidenceScore: z.number(),
  isConfirmed: z.boolean(),
  usageCount: z.number(),
  lastUsedAt: z.string().nullable(),
  isActive: z.boolean(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  chunkCount: z.number(),
});

export const articleListResponseSchema = z.array(articleResponseSchema);
