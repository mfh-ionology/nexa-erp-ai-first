// ---------------------------------------------------------------------------
// Audit Types — Type definitions for the audit trail system
// Source: Architecture §2.6, Business Rules IMP-003, BR-SYS-013/014
// ---------------------------------------------------------------------------

import type { BusinessEvents } from '../events/event-bus.types.js';

/**
 * Permitted actions for audit log entries.
 * Maps to the `action` column on the `audit_logs` table.
 */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'POST'
  | 'LOGIN';

/**
 * Registry of known audit entity types (BR-SYS-014).
 * New modules must add their entity type strings here when adding audit mappings.
 * Query endpoints accept any string (to avoid breaking as new modules are added),
 * but this registry documents the valid set for documentation and future validation.
 */
export const KNOWN_AUDIT_ENTITY_TYPES = [
  'User',
  'AccessGroup',
  'UserAccessGroup',
  'CompanyProfile',
] as const;

export type KnownAuditEntityType = (typeof KNOWN_AUDIT_ENTITY_TYPES)[number];

/**
 * Application-layer representation of an audit log entry.
 * Used by AuditService.log() to insert records into the audit_logs table.
 */
export interface AuditEntry {
  companyId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  userId: string;
  isAiAction: boolean;
  aiConfidence?: number;
  correlationId?: string;
}

/**
 * Mapping function that extracts audit entry fields from an event payload.
 *
 * Returns all AuditEntry fields except `isAiAction`, which is optional and
 * defaults to `false` in the AuditService. This allows most mappings to
 * omit the AI flag while AI-specific mappings can explicitly set it.
 */
export type AuditEventMapping<K extends keyof BusinessEvents> = (
  payload: BusinessEvents[K],
) => Omit<AuditEntry, 'isAiAction'> & { isAiAction?: boolean };
