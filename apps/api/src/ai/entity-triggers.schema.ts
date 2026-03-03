// ---------------------------------------------------------------------------
// Zod schemas for Entity Trigger CRUD endpoints
// E5b-2 Task 11.7
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ─── Request schemas ──────────────────────────────────────────────────────

export const listEntityTriggersQuerySchema = z.object({
  moduleKey: z.string().max(100).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const entityTriggerIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createEntityTriggerBodySchema = z.object({
  moduleKey: z.string().min(1).max(100),
  triggerWord: z.string().min(1).max(255),
  entityType: z.string().min(1).max(255),
  searchEndpoint: z.string().min(1).max(500),
  displayField: z.string().min(1).max(255),
  subtitleField: z.string().max(255).nullable().optional(),
  scopeBy: z.string().max(255).nullable().optional(),
  icon: z.string().max(255).nullable().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

export const updateEntityTriggerBodySchema = z.object({
  moduleKey: z.string().min(1).max(100).optional(),
  triggerWord: z.string().min(1).max(255).optional(),
  entityType: z.string().min(1).max(255).optional(),
  searchEndpoint: z.string().min(1).max(500).optional(),
  displayField: z.string().min(1).max(255).optional(),
  subtitleField: z.string().max(255).nullable().optional(),
  scopeBy: z.string().max(255).nullable().optional(),
  icon: z.string().max(255).nullable().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

// ─── Response schemas ─────────────────────────────────────────────────────

export const entityTriggerResponseSchema = z.object({
  id: z.string(),
  moduleKey: z.string(),
  triggerWord: z.string(),
  entityType: z.string(),
  searchEndpoint: z.string(),
  displayField: z.string(),
  subtitleField: z.string().nullable(),
  scopeBy: z.string().nullable(),
  icon: z.string().nullable(),
  priority: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const entityTriggerListResponseSchema = z.array(entityTriggerResponseSchema);
