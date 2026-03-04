// ---------------------------------------------------------------------------
// Zod schemas for Correction Review endpoints
// E5d-2 Task 7.1 (AC #8)
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { VALID_CORRECTION_TYPES } from './correction-capture.service.js';

// ─── Request schemas ────────────────────────────────────────────────────────

export const listCorrectionsQuerySchema = z.object({
  correctionType: z.enum(VALID_CORRECTION_TYPES).optional(),
  skillKey: z.string().max(100).optional(),
  wasAutoResolved: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  from: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid ISO date' })
    .optional(),
  to: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid ISO date' })
    .optional(),
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(200))
    .optional(),
});

export const correctionStatsQuerySchema = z.object({
  from: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid ISO date' })
    .optional(),
  to: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid ISO date' })
    .optional(),
});

export const createArticleFromCorrectionParamsSchema = z.object({
  correctionId: z.string().uuid(),
});

// ─── Response schemas ───────────────────────────────────────────────────────

export const correctionResponseSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  userId: z.string(),
  conversationId: z.string().nullable(),
  messageId: z.string().nullable(),
  skillKey: z.string().nullable(),
  originalResponse: z.string(),
  correctedResponse: z.string(),
  correctionType: z.string(),
  wasAutoResolved: z.boolean(),
  createdAt: z.union([z.date(), z.string()]).transform(String),
});

export const correctionListResponseSchema = z.object({
  items: z.array(correctionResponseSchema),
  stats: z.object({
    total: z.number(),
    byType: z.record(z.string(), z.number()),
    bySkill: z.record(z.string(), z.number()),
  }),
});

export const correctionStatsResponseSchema = z.object({
  total: z.number(),
  totalLast30Days: z.number(),
  byType: z.record(z.string(), z.number()),
  bySkill: z.record(z.string(), z.number()),
  autoResolvedCount: z.number(),
  trend: z.array(
    z.object({
      date: z.string(),
      count: z.number(),
    }),
  ),
});
