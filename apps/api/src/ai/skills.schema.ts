// ---------------------------------------------------------------------------
// Zod schemas for Skills CRUD endpoints
// E5b-2 Task 10.2
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ─── Request schemas ──────────────────────────────────────────────────────

export const listSkillsQuerySchema = z.object({
  moduleKey: z.string().max(100).optional(),
});

export const skillIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createSkillBodySchema = z.object({
  name: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(100),
  skillContent: z.string().min(1).max(50_000),
  triggerPhrases: z.array(z.string().min(1).max(500)).min(1),
  inputSchema: z.record(z.string(), z.unknown()),
  outputType: z.string().min(1).max(100),
  requiredTools: z.array(z.string().min(1).max(255)).default([]),
  isActive: z.boolean().optional(),
  moduleKey: z.string().max(100).optional(),
  packKey: z.string().max(100).optional(),
  negativeTriggers: z.array(z.string().min(1).max(500)).optional(),
  contextRequired: z.array(z.string().min(1).max(255)).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  examples: z
    .array(
      z.object({
        input: z.string(),
        output: z.string(),
      }),
    )
    .optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  orchestrationPattern: z.string().max(100).optional(),
  version: z.number().int().min(1).optional(),
});

export const updateSkillBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  displayName: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().min(1).max(100).optional(),
  skillContent: z.string().min(1).max(50_000).optional(),
  triggerPhrases: z.array(z.string().min(1).max(500)).min(1).optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  outputType: z.string().min(1).max(100).optional(),
  requiredTools: z.array(z.string().min(1).max(255)).optional(),
  isActive: z.boolean().optional(),
  moduleKey: z.string().max(100).nullable().optional(),
  packKey: z.string().max(100).nullable().optional(),
  negativeTriggers: z.array(z.string().min(1).max(500)).optional(),
  contextRequired: z.array(z.string().min(1).max(255)).optional(),
  parameters: z.record(z.string(), z.unknown()).nullable().optional(),
  examples: z
    .array(
      z.object({
        input: z.string(),
        output: z.string(),
      }),
    )
    .nullable()
    .optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  orchestrationPattern: z.string().max(100).nullable().optional(),
  version: z.number().int().min(1).optional(),
});

// ─── Response schemas ─────────────────────────────────────────────────────

export const skillResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  skillContent: z.string(),
  triggerPhrases: z.array(z.string()),
  inputSchema: z.unknown(),
  outputType: z.string(),
  requiredTools: z.array(z.string()),
  isActive: z.boolean(),
  moduleKey: z.string().nullable(),
  packKey: z.string().nullable(),
  negativeTriggers: z.array(z.string()),
  contextRequired: z.array(z.string()),
  parameters: z.unknown().nullable(),
  examples: z.unknown().nullable(),
  priority: z.number(),
  orchestrationPattern: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const skillListResponseSchema = z.array(skillResponseSchema);
