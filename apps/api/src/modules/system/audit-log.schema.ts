import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'POST',
  'LOGIN',
] as const;

// ---------------------------------------------------------------------------
// Query Schemas
// ---------------------------------------------------------------------------

export const auditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.uuid().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  userId: z.uuid().optional(),
  dateFrom: z.iso.datetime({ offset: true }).optional(),
  dateTo: z.iso.datetime({ offset: true }).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// entityType accepts any non-empty string for forward compatibility as new modules
// add entity types. See KNOWN_AUDIT_ENTITY_TYPES in audit.types.ts for the
// current registry per BR-SYS-014.
export const auditLogEntityParamsSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.uuid(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const auditLogResponseSchema = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.enum(AUDIT_ACTIONS),
  beforeData: z.record(z.string(), z.unknown()).nullable(),
  afterData: z.record(z.string(), z.unknown()).nullable(),
  userId: z.string(),
  isAiAction: z.boolean(),
  aiConfidence: z.number().nullable(),
  correlationId: z.string().nullable(),
  timestamp: z.date(),
});

export const auditLogListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(auditLogResponseSchema),
  meta: z
    .object({
      cursor: z.string().nullable(),
      hasMore: z.boolean(),
      total: z.number(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
export type AuditLogEntityParams = z.infer<typeof auditLogEntityParamsSchema>;
export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;
