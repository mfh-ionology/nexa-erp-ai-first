// ---------------------------------------------------------------------------
// Audit Log Schemas — Request/response validation for audit log query routes
// Source: API Contracts §21.7, FR214, BR-PLT-016, BR-PLT-017
// Story: E13b.6 Task 1.1
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const listAuditLogQuerySchema = z.object({
  action: z.string().optional(),
  targetType: z.enum(['tenant', 'plan', 'platform_user', 'impersonation_session']).optional(),
  targetId: z.string().uuid().optional(),
  platformUserId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const exportAuditLogQuerySchema = z.object({
  action: z.string().optional(),
  targetType: z.enum(['tenant', 'plan', 'platform_user', 'impersonation_session']).optional(),
  targetId: z.string().uuid().optional(),
  platformUserId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export const auditLogIdParamsSchema = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const platformUserSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
});

export const auditLogListItemSchema = z.object({
  id: z.string(),
  platformUser: platformUserSummarySchema,
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  ipAddress: z.string(),
  timestamp: z.string(),
});

export const auditLogDetailSchema = z.object({
  id: z.string(),
  platformUser: platformUserSummarySchema,
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  details: z.unknown().nullable(),
  ipAddress: z.string(),
  userAgent: z.string().nullable(),
  timestamp: z.string(),
  createdAt: z.string(),
});

export const auditLogListResponseSchema = z.array(auditLogListItemSchema);

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------

export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;
export type ExportAuditLogQuery = z.infer<typeof exportAuditLogQuerySchema>;
export type AuditLogIdParams = z.infer<typeof auditLogIdParamsSchema>;
export type AuditLogListItem = z.infer<typeof auditLogListItemSchema>;
export type AuditLogDetail = z.infer<typeof auditLogDetailSchema>;
