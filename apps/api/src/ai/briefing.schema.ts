import { z } from 'zod';

// ─── Request Schemas ───────────────────────────────────────────────────────

/** GET /ai/briefing — query parameters */
export const briefingQuerySchema = z.object({
  forceRefresh: z.union([
    z.boolean(),
    z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1'),
  ]).default(false),
});

/** POST /ai/suggestions — request body */
export const suggestionsBodySchema = z.object({
  entityType: z.string().max(100).optional(),
  entityId: z.string().max(100).optional(),
  pageRoute: z.string().max(500).optional(),
});

// ─── Response Sub-Schemas ──────────────────────────────────────────────────

const briefingMetricSchema = z.object({
  value: z.string(),
  delta: z.string().optional(),
  trend: z.enum(['up', 'down', 'flat']).optional(),
  comparisonPeriod: z.string().optional(),
});

const briefingActionSchema = z.object({
  label: z.string(),
  actionType: z.enum(['navigate', 'approve', 'chase', 'dismiss']),
  route: z.string().optional(),
  entityType: z.string().optional(),
  entityIds: z.array(z.string()).optional(),
});

const entityLinkSchema = z.object({
  entityType: z.string(),
  entityId: z.string().optional(),
  route: z.string(),
});

export const briefingItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  metric: briefingMetricSchema.optional(),
  actions: z.array(briefingActionSchema),
  entityLink: entityLinkSchema.optional(),
});

// ─── Briefing Response ─────────────────────────────────────────────────────

export const briefingResponseSchema = z.object({
  generatedAt: z.string(),
  userId: z.string(),
  role: z.enum(['OWNER', 'FINANCE', 'SALES', 'HR', 'WAREHOUSE', 'ADMIN']),
  greeting: z.string(),
  summary: z.string(),
  items: z.array(briefingItemSchema),
  cachedAt: z.string().optional(),
  isStale: z.boolean().optional(),
});

// ─── Suggestion Response ───────────────────────────────────────────────────

export const suggestionChipSchema = z.object({
  id: z.string(),
  label: z.string(),
  prompt: z.string(),
  category: z.enum(['action', 'query', 'navigation']),
  icon: z.string().optional(),
  priority: z.number(),
});

export const suggestionsResponseSchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  pageRoute: z.string().optional(),
  suggestions: z.array(suggestionChipSchema),
});
