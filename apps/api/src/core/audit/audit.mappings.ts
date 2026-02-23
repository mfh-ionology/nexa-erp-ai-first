// ---------------------------------------------------------------------------
// Audit Event Mappings — Maps business events to audit log entries
// Source: Event Catalog §15, Architecture §2.6
// ---------------------------------------------------------------------------

import type { BusinessEvents } from '../events/event-bus.types.js';
import type { AuditEntry, AuditEventMapping } from './audit.types.js';

/**
 * Result type returned by mapping functions in the registry.
 * Same as AuditEntry but with `isAiAction` optional (defaults to false).
 */
type AuditMappingResult = Omit<AuditEntry, 'isAiAction'> & {
  isAiAction?: boolean;
};

/**
 * Internal mutable registry of event-to-audit mappings, keyed by event name.
 * Use registerAuditMapping() to add entries — do not mutate directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- type-erased storage; type safety enforced at registration via registerAuditMapping()
const _auditMappings: Record<string, (payload: any) => AuditMappingResult> = {};

/**
 * Read-only view of registered audit event mappings.
 * Built-in mappings for currently-emitted events are registered below.
 * Future modules register their own mappings by calling
 * `registerAuditMapping()` during plugin initialisation.
 */
export const AUDIT_EVENT_MAPPINGS: Readonly<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Record<string, (payload: any) => AuditMappingResult>
> = _auditMappings;

/**
 * Type-safe registration of an audit event mapping.
 * Validates that the mapping function signature matches the event payload type.
 */
export function registerAuditMapping<K extends keyof BusinessEvents>(
  event: K,
  mapping: AuditEventMapping<K>,
): void {
  _auditMappings[event as string] = mapping;
}

// ── Built-in mappings for currently-emitted events ──────────────────────────

registerAuditMapping('user.login', (payload) => ({
  companyId: payload.companyId,
  entityType: 'User',
  entityId: payload.userId,
  action: 'LOGIN',
  afterData: { loginMethod: payload.loginMethod, ipAddress: payload.ipAddress },
  userId: payload.userId,
}));

registerAuditMapping('user.mfa.setup', (payload) => ({
  companyId: payload.companyId,
  entityType: 'User',
  entityId: payload.userId,
  action: 'UPDATE',
  afterData: { mfaAction: 'setup' },
  userId: payload.userId,
}));

registerAuditMapping('user.mfa.enabled', (payload) => ({
  companyId: payload.companyId,
  entityType: 'User',
  entityId: payload.userId,
  action: 'UPDATE',
  afterData: { mfaAction: 'enabled' },
  userId: payload.userId,
}));

registerAuditMapping('user.mfa.reset', (payload) => ({
  companyId: payload.companyId,
  entityType: 'User',
  entityId: payload.targetUserId,
  action: 'UPDATE',
  afterData: { resetByUserId: payload.resetByUserId },
  userId: payload.resetByUserId,
}));

registerAuditMapping('accessGroup.created', (payload) => ({
  companyId: payload.companyId,
  entityType: 'AccessGroup',
  entityId: payload.groupId,
  action: 'CREATE',
  afterData: { code: payload.code, name: payload.name },
  userId: payload.createdBy,
}));

// COMPLIANCE GAP: accessGroup.updated event payload lacks beforeData/afterData.
// The emitter in access-groups.service.ts (lines ~217, ~343) only provides { groupId, companyId, changedBy }.
// FIX REQUIRED: (1) Add beforeData/afterData fields to the 'accessGroup.updated' type in event-bus.types.ts,
//   (2) capture the pre-update state in access-groups.service.ts before the Prisma update call,
//   (3) include both snapshots in the emitted payload.
// Without this, UPDATE audit records for AccessGroup entities lack change details (IMP-003 compliance gap).
registerAuditMapping('accessGroup.updated', (payload) => ({
  companyId: payload.companyId,
  entityType: 'AccessGroup',
  entityId: payload.groupId,
  action: 'UPDATE',
  userId: payload.changedBy,
}));

registerAuditMapping('accessGroup.deleted', (payload) => ({
  companyId: payload.companyId,
  entityType: 'AccessGroup',
  entityId: payload.groupId,
  action: 'DELETE',
  userId: payload.deletedBy,
}));

registerAuditMapping('user.accessGroups.assigned', (payload) => ({
  companyId: payload.companyId,
  entityType: 'UserAccessGroup',
  entityId: payload.userId,
  action: 'UPDATE',
  afterData: { groupIds: payload.groupIds },
  userId: payload.assignedBy,
}));

registerAuditMapping('user.accessGroups.revoked', (payload) => ({
  companyId: payload.companyId,
  entityType: 'UserAccessGroup',
  entityId: payload.userId,
  action: 'DELETE',
  afterData: { groupIds: payload.groupIds },
  userId: payload.revokedBy,
}));

registerAuditMapping('company.defaultData.imported', (payload) => ({
  companyId: payload.companyId,
  entityType: 'CompanyProfile',
  entityId: payload.companyId,
  action: 'UPDATE',
  afterData: { version: payload.version },
  userId: payload.importedBy,
}));
