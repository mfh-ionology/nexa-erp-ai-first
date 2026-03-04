// ---------------------------------------------------------------------------
// Zod schemas for Training Example CRUD endpoints
// E5d-2 Task 4.2 (AC #4)
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { VALID_TRAINING_CATEGORIES, VALID_TRAINING_SOURCES } from './training-example.service.js';

// ─── Request schemas ────────────────────────────────────────────────────────

export const listExamplesQuerySchema = z.object({
  category: z.union([z.string().max(50), z.array(z.string().max(50))]).optional(),
  skillKey: z.string().max(100).optional(),
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

export const exampleIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createExampleBodySchema = z.object({
  inputText: z.string().min(1).max(10_000),
  outputText: z.string().min(1).max(10_000),
  category: z.enum(VALID_TRAINING_CATEGORIES),
  skillKey: z.string().max(100).optional(),
  source: z.enum(VALID_TRAINING_SOURCES).optional(),
});

export const updateExampleBodySchema = z
  .object({
    inputText: z.string().min(1).max(10_000).optional(),
    outputText: z.string().min(1).max(10_000).optional(),
    category: z.enum(VALID_TRAINING_CATEGORIES).optional(),
    skillKey: z.string().max(100).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

// ─── Response schemas ───────────────────────────────────────────────────────

export const exampleResponseSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  skillKey: z.string().nullable(),
  inputText: z.string(),
  outputText: z.string(),
  category: z.string(),
  source: z.string(),
  isActive: z.boolean(),
  createdById: z.string(),
  createdAt: z.union([z.date(), z.string()]).transform(String),
  updatedAt: z.union([z.date(), z.string()]).transform(String),
});

export const exampleListResponseSchema = z.array(exampleResponseSchema);
