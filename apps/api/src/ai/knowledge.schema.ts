// ---------------------------------------------------------------------------
// Zod schemas for Module Knowledge CRUD endpoints
// E5b-2 Task 11.7
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ─── Request schemas ──────────────────────────────────────────────────────

export const listKnowledgeQuerySchema = z.object({
  moduleKey: z.string().max(100).optional(),
  type: z.string().max(100).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const knowledgeIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createKnowledgeBodySchema = z.object({
  moduleKey: z.string().min(1).max(100),
  knowledgeType: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100_000),
  priority: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

export const updateKnowledgeBodySchema = z.object({
  moduleKey: z.string().min(1).max(100).optional(),
  knowledgeType: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(100_000).optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

// ─── Response schemas ─────────────────────────────────────────────────────

export const knowledgeResponseSchema = z.object({
  id: z.string(),
  moduleKey: z.string(),
  knowledgeType: z.string(),
  title: z.string(),
  content: z.string(),
  priority: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const knowledgeListResponseSchema = z.array(knowledgeResponseSchema);
