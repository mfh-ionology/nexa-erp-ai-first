// ---------------------------------------------------------------------------
// Impersonation Schemas — Request/response validation for impersonation routes
// Source: API Contracts §21.3, FR199-FR200, BR-PLT-012, BR-PLT-013
// Story: E13b.5 Task 1.2
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export const tenantIdParamsSchema = z.object({
  id: z.uuid(),
});

export const sessionIdParamsSchema = z.object({
  sessionId: z.uuid(),
});

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const startImpersonationRequestSchema = z.object({
  reason: z.string().min(1, 'Impersonation reason is required'),
  durationMinutes: z.coerce.number().int().min(1).max(480).default(60),
});

export const listSessionsQuerySchema = z.object({
  tenantId: z.uuid().optional(),
  platformUserId: z.uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const startImpersonationResponseSchema = z.object({
  sessionId: z.string(),
  token: z.string(),
  expiresAt: z.string(),
});

export const endImpersonationResponseSchema = z.object({
  sessionId: z.string(),
  endedAt: z.string(),
  duration: z.number(),
});

const platformUserSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
});

const tenantSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  displayName: z.string(),
});

export const sessionDetailSchema = z.object({
  id: z.string(),
  platformUser: platformUserSummarySchema,
  tenant: tenantSummarySchema,
  reason: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  expiresAt: z.string(),
  actionsCount: z.number(),
});

export const sessionListResponseSchema = z.object({
  items: z.array(sessionDetailSchema),
  total: z.number(),
  hasMore: z.boolean(),
});

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------

export type TenantIdParams = z.infer<typeof tenantIdParamsSchema>;
export type SessionIdParams = z.infer<typeof sessionIdParamsSchema>;
export type StartImpersonationRequest = z.infer<typeof startImpersonationRequestSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
