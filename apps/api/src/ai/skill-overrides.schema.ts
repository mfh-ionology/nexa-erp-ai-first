// ---------------------------------------------------------------------------
// Zod schemas for Skill Override CRUD endpoints
// E5b-2 Task 12.3
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ─── Request schemas ──────────────────────────────────────────────────────

export const skillOverrideParamsSchema = z.object({
  skillId: z.string().uuid(),
});

export const upsertOverrideBodySchema = z.object({
  isActive: z.boolean().nullable().optional(),
  triggerPhrasesOverride: z.array(z.string().min(1).max(500)).optional(),
  priorityOverride: z.number().int().min(0).max(10_000).nullable().optional(),
});

// ─── Response schemas ─────────────────────────────────────────────────────

export const skillOverrideResponseSchema = z.object({
  id: z.string(),
  skillId: z.string(),
  companyId: z.string(),
  isActive: z.boolean().nullable(),
  triggerPhrasesOverride: z.array(z.string()),
  priorityOverride: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const skillOverrideListResponseSchema = z.array(skillOverrideResponseSchema);
