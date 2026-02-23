// ---------------------------------------------------------------------------
// AuditService Unit Tests — Event-driven audit logging
// Source: E3-2 Task 9 (AC #1, #2, #5)
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBus } from '../events/event-bus.js';
import { AuditService } from './audit.service.js';
import { AUDIT_EVENT_MAPPINGS } from './audit.mappings.js';
import type { AuditEntry } from './audit.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush queueMicrotask-scheduled handlers and async continuations */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Create a mock PrismaClient with auditLog model methods */
function makeMockPrisma() {
  return {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-generated-id' }),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

// ---------------------------------------------------------------------------
// Test Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const USER_ID = '00000000-0000-4000-a000-000000000001';
const GROUP_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const TARGET_USER_ID = 'bbbbbbbb-0000-4000-a000-000000000002';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditService', () => {
  let service: AuditService;
  let eventBus: EventBus;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(() => {
    service = new AuditService();
    eventBus = new EventBus();
    mockPrisma = makeMockPrisma();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 9.2 — Business event creates AuditLog record (AC #1)
  // =========================================================================

  it('creates an AuditLog record with correct fields when a business event is emitted', async () => {
    service.registerEventSubscriptions(eventBus, mockPrisma as never);

    eventBus.emit('accessGroup.created', {
      groupId: GROUP_ID,
      companyId: COMPANY_ID,
      code: 'FINANCE_MANAGER',
      name: 'Finance Manager',
      createdBy: USER_ID,
    });

    await flushMicrotasks();

    await vi.waitFor(() => {
      expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
    });

    const { data } = mockPrisma.auditLog.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data).toEqual(
      expect.objectContaining({
        companyId: COMPANY_ID,
        entityType: 'AccessGroup',
        entityId: GROUP_ID,
        action: 'CREATE',
        userId: USER_ID,
        isAiAction: false,
      }),
    );
  });

  // =========================================================================
  // 9.3 — accessGroup.created → CREATE audit with afterData (AC #1)
  // =========================================================================

  it('accessGroup.created creates audit record with action=CREATE and afterData containing code and name', async () => {
    service.registerEventSubscriptions(eventBus, mockPrisma as never);

    eventBus.emit('accessGroup.created', {
      groupId: GROUP_ID,
      companyId: COMPANY_ID,
      code: 'ADMIN',
      name: 'Administrators',
      createdBy: USER_ID,
    });

    await flushMicrotasks();

    await vi.waitFor(() => {
      expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
    });

    const { data } = mockPrisma.auditLog.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.action).toBe('CREATE');
    expect(data.afterData).toEqual({ code: 'ADMIN', name: 'Administrators' });
  });

  // =========================================================================
  // 9.4 — accessGroup.deleted → DELETE audit (AC #1)
  // =========================================================================

  it('accessGroup.deleted creates audit record with action=DELETE', async () => {
    service.registerEventSubscriptions(eventBus, mockPrisma as never);

    eventBus.emit('accessGroup.deleted', {
      groupId: GROUP_ID,
      companyId: COMPANY_ID,
      deletedBy: USER_ID,
    });

    await flushMicrotasks();

    await vi.waitFor(() => {
      expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
    });

    const { data } = mockPrisma.auditLog.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.action).toBe('DELETE');
    expect(data.entityType).toBe('AccessGroup');
    expect(data.entityId).toBe(GROUP_ID);
    expect(data.userId).toBe(USER_ID);
  });

  // =========================================================================
  // 9.5 — user.login → LOGIN audit with afterData (AC #1)
  // =========================================================================

  it('user.login creates audit record with action=LOGIN and afterData containing loginMethod', async () => {
    service.registerEventSubscriptions(eventBus, mockPrisma as never);

    eventBus.emit('user.login', {
      userId: USER_ID,
      companyId: COMPANY_ID,
      loginMethod: 'password',
      ipAddress: '192.168.1.1',
    });

    await flushMicrotasks();

    await vi.waitFor(() => {
      expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
    });

    const { data } = mockPrisma.auditLog.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.action).toBe('LOGIN');
    expect(data.entityType).toBe('User');
    expect(data.entityId).toBe(USER_ID);
    expect(data.afterData).toEqual({
      loginMethod: 'password',
      ipAddress: '192.168.1.1',
    });
  });

  // =========================================================================
  // 9.6 — AI action tracking (AC #5)
  // =========================================================================

  describe('AI action tracking', () => {
    it('creates AuditLog with isAiAction=true and aiConfidence when set', async () => {
      const entry: AuditEntry = {
        companyId: COMPANY_ID,
        entityType: 'Invoice',
        entityId: 'inv-001',
        action: 'CREATE',
        userId: USER_ID,
        isAiAction: true,
        aiConfidence: 0.9512,
        afterData: { source: 'document-understanding' },
      };

      await service.log(mockPrisma as never, entry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
      const { data } = mockPrisma.auditLog.create.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(data.isAiAction).toBe(true);
      expect(data.aiConfidence).toBe(0.9512);
    });

    it('defaults isAiAction to false when not explicitly set in event mapping', async () => {
      service.registerEventSubscriptions(eventBus, mockPrisma as never);

      eventBus.emit('accessGroup.created', {
        groupId: GROUP_ID,
        companyId: COMPANY_ID,
        code: 'TEST',
        name: 'Test',
        createdBy: USER_ID,
      });

      await flushMicrotasks();

      await vi.waitFor(() => {
        expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
      });

      const { data } = mockPrisma.auditLog.create.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(data.isAiAction).toBe(false);
      expect(data.aiConfidence).toBeUndefined();
    });
  });

  // =========================================================================
  // 9.7 — Error handling: audit failures must not propagate (NFR22)
  // =========================================================================

  describe('error handling', () => {
    it('logs error but does NOT propagate when audit insert fails (schema/programming error)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const dbError = new Error('invalid field name');
      mockPrisma.auditLog.create.mockRejectedValueOnce(dbError);

      const entry: AuditEntry = {
        companyId: COMPANY_ID,
        entityType: 'User',
        entityId: USER_ID,
        action: 'LOGIN',
        userId: USER_ID,
        isAiAction: false,
      };

      // Must NOT throw
      await expect(service.log(mockPrisma as never, entry)).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AuditService] Failed to write audit log — possible schema or mapping error:',
        expect.objectContaining({ entityType: 'User', action: 'LOGIN', error: dbError }),
      );

      consoleSpy.mockRestore();
    });

    it('classifies transient DB errors and logs at warn level', async () => {
      const customLogger = { error: vi.fn(), warn: vi.fn() };
      service.setLogger(customLogger);

      // Prisma P1001 = "Can't reach database server"
      const transientError = Object.assign(new Error('connection refused'), { code: 'P1001' });
      mockPrisma.auditLog.create.mockRejectedValueOnce(transientError);

      const entry: AuditEntry = {
        companyId: COMPANY_ID,
        entityType: 'User',
        entityId: USER_ID,
        action: 'LOGIN',
        userId: USER_ID,
        isAiAction: false,
      };

      await service.log(mockPrisma as never, entry);

      expect(customLogger.warn).toHaveBeenCalledWith(
        '[AuditService] Transient DB error writing audit log (will not retry):',
        transientError,
      );
      expect(customLogger.error).not.toHaveBeenCalled();
    });

    it('uses custom logger error for non-transient errors via setLogger()', async () => {
      const customLogger = { error: vi.fn(), warn: vi.fn() };
      service.setLogger(customLogger);

      const dbError = new Error('timeout');
      mockPrisma.auditLog.create.mockRejectedValueOnce(dbError);

      const entry: AuditEntry = {
        companyId: COMPANY_ID,
        entityType: 'User',
        entityId: USER_ID,
        action: 'LOGIN',
        userId: USER_ID,
        isAiAction: false,
      };

      await service.log(mockPrisma as never, entry);

      expect(customLogger.error).toHaveBeenCalledWith(
        '[AuditService] Failed to write audit log — possible schema or mapping error:',
        expect.objectContaining({ entityType: 'User', action: 'LOGIN', error: dbError }),
      );
    });

    it('audit failure does not affect other event handlers on the EventBus', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPrisma.auditLog.create.mockRejectedValue(new Error('db error'));

      service.registerEventSubscriptions(eventBus, mockPrisma as never);

      const otherHandler = vi.fn();
      eventBus.on('accessGroup.created', otherHandler);

      eventBus.emit('accessGroup.created', {
        groupId: GROUP_ID,
        companyId: COMPANY_ID,
        code: 'TEST',
        name: 'Test',
        createdBy: USER_ID,
      });

      await flushMicrotasks();

      await vi.waitFor(() => {
        expect(otherHandler).toHaveBeenCalledOnce();
      });

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // 9.8 — All 10 event mappings extract correct fields
  // =========================================================================

  describe('audit event mappings', () => {
    it('maps user.login correctly', () => {
      const result = AUDIT_EVENT_MAPPINGS['user.login']!({
        userId: USER_ID,
        companyId: COMPANY_ID,
        loginMethod: 'password',
        ipAddress: '10.0.0.1',
      });

      expect(result).toEqual({
        companyId: COMPANY_ID,
        entityType: 'User',
        entityId: USER_ID,
        action: 'LOGIN',
        afterData: { loginMethod: 'password', ipAddress: '10.0.0.1' },
        userId: USER_ID,
      });
    });

    it('maps user.mfa.setup correctly', () => {
      const result = AUDIT_EVENT_MAPPINGS['user.mfa.setup']!({
        userId: USER_ID,
        companyId: COMPANY_ID,
      });

      expect(result).toEqual({
        companyId: COMPANY_ID,
        entityType: 'User',
        entityId: USER_ID,
        action: 'UPDATE',
        afterData: { mfaAction: 'setup' },
        userId: USER_ID,
      });
    });

    it('maps user.mfa.enabled correctly', () => {
      const result = AUDIT_EVENT_MAPPINGS['user.mfa.enabled']!({
        userId: USER_ID,
        companyId: COMPANY_ID,
      });

      expect(result).toEqual({
        companyId: COMPANY_ID,
        entityType: 'User',
        entityId: USER_ID,
        action: 'UPDATE',
        afterData: { mfaAction: 'enabled' },
        userId: USER_ID,
      });
    });

    it('maps user.mfa.reset correctly (admin action on another user)', () => {
      const result = AUDIT_EVENT_MAPPINGS['user.mfa.reset']!({
        targetUserId: TARGET_USER_ID,
        resetByUserId: USER_ID,
        companyId: COMPANY_ID,
      });

      expect(result).toEqual({
        companyId: COMPANY_ID,
        entityType: 'User',
        entityId: TARGET_USER_ID,
        action: 'UPDATE',
        afterData: { resetByUserId: USER_ID },
        userId: USER_ID,
      });
    });

    it('maps accessGroup.created correctly', () => {
      const result = AUDIT_EVENT_MAPPINGS['accessGroup.created']!({
        groupId: GROUP_ID,
        companyId: COMPANY_ID,
        code: 'ADMIN',
        name: 'Administrators',
        createdBy: USER_ID,
      });

      expect(result).toEqual({
        companyId: COMPANY_ID,
        entityType: 'AccessGroup',
        entityId: GROUP_ID,
        action: 'CREATE',
        afterData: { code: 'ADMIN', name: 'Administrators' },
        userId: USER_ID,
      });
    });

    it('maps accessGroup.updated correctly', () => {
      const result = AUDIT_EVENT_MAPPINGS['accessGroup.updated']!({
        groupId: GROUP_ID,
        companyId: COMPANY_ID,
        changedBy: USER_ID,
      });

      expect(result).toEqual({
        companyId: COMPANY_ID,
        entityType: 'AccessGroup',
        entityId: GROUP_ID,
        action: 'UPDATE',
        userId: USER_ID,
      });
    });

    it('maps accessGroup.deleted correctly', () => {
      const result = AUDIT_EVENT_MAPPINGS['accessGroup.deleted']!({
        groupId: GROUP_ID,
        companyId: COMPANY_ID,
        deletedBy: USER_ID,
      });

      expect(result).toEqual({
        companyId: COMPANY_ID,
        entityType: 'AccessGroup',
        entityId: GROUP_ID,
        action: 'DELETE',
        userId: USER_ID,
      });
    });

    it('maps user.accessGroups.assigned correctly', () => {
      const groupIds = ['group-1', 'group-2'];
      const result = AUDIT_EVENT_MAPPINGS['user.accessGroups.assigned']!({
        userId: TARGET_USER_ID,
        companyId: COMPANY_ID,
        groupIds,
        assignedBy: USER_ID,
      });

      expect(result).toEqual({
        companyId: COMPANY_ID,
        entityType: 'UserAccessGroup',
        entityId: TARGET_USER_ID,
        action: 'UPDATE',
        afterData: { groupIds },
        userId: USER_ID,
      });
    });

    it('maps user.accessGroups.revoked correctly', () => {
      const groupIds = ['group-1'];
      const result = AUDIT_EVENT_MAPPINGS['user.accessGroups.revoked']!({
        userId: TARGET_USER_ID,
        companyId: COMPANY_ID,
        groupIds,
        revokedBy: USER_ID,
      });

      expect(result).toEqual({
        companyId: COMPANY_ID,
        entityType: 'UserAccessGroup',
        entityId: TARGET_USER_ID,
        action: 'DELETE',
        afterData: { groupIds },
        userId: USER_ID,
      });
    });

    it('maps company.defaultData.imported correctly', () => {
      const result = AUDIT_EVENT_MAPPINGS['company.defaultData.imported']!({
        companyId: COMPANY_ID,
        importedBy: USER_ID,
        version: '1.0.0',
      });

      expect(result).toEqual({
        companyId: COMPANY_ID,
        entityType: 'CompanyProfile',
        entityId: COMPANY_ID,
        action: 'UPDATE',
        afterData: { version: '1.0.0' },
        userId: USER_ID,
      });
    });

    it('has exactly 10 registered event mappings', () => {
      expect(Object.keys(AUDIT_EVENT_MAPPINGS)).toHaveLength(10);
    });
  });

  // =========================================================================
  // 9.9 / 9.10 — Immutability: application-layer verification only
  // =========================================================================
  // NOTE: These unit tests verify the APPLICATION-LAYER immutability guarantee
  // (AuditService exposes no update/delete methods). They do NOT verify AC #2's
  // database-level enforcement via PostgreSQL RULEs.
  //
  // AC #2 (DB-level immutability) is verified by the integration test at:
  //   packages/db/src/__tests__/audit-immutability.test.ts
  // which runs against a live PostgreSQL instance and confirms the RULEs
  // silently discard UPDATE and DELETE operations.
  // =========================================================================

  describe('immutability (application-layer — see audit-immutability.test.ts for DB-level AC #2)', () => {
    const originalRecord = {
      id: 'audit-record-001',
      companyId: COMPANY_ID,
      entityType: 'User',
      entityId: USER_ID,
      action: 'LOGIN',
      beforeData: null,
      afterData: { loginMethod: 'password' },
      userId: USER_ID,
      isAiAction: false,
      aiConfidence: null,
      correlationId: null,
      timestamp: new Date('2026-02-21T10:00:00Z'),
    };

    it('AuditService API surface has no update/delete methods (application-layer immutability)', () => {
      expect(typeof service.log).toBe('function');
      expect(typeof service.registerEventSubscriptions).toBe('function');
      expect(typeof service.setLogger).toBe('function');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).update).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).delete).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).remove).toBeUndefined();
    });

    it('UPDATE on audit record has no effect — record remains unchanged (mock-based)', async () => {
      // PostgreSQL RULE silently discards UPDATEs; Prisma returns the original record
      mockPrisma.auditLog.update.mockResolvedValueOnce(originalRecord);
      mockPrisma.auditLog.findUnique.mockResolvedValueOnce(originalRecord);

      // Attempt to change the action field from LOGIN to DELETE
      await mockPrisma.auditLog.update({
        where: { id: originalRecord.id },
        data: { action: 'DELETE' },
      });

      // Verify the record is unchanged (DB rule discarded the UPDATE)
      const record = await mockPrisma.auditLog.findUnique({
        where: { id: originalRecord.id },
      });

      expect(record).not.toBeNull();
      expect(record!.action).toBe('LOGIN');
      expect(record!.entityType).toBe('User');
      expect(record!.afterData).toEqual({ loginMethod: 'password' });
    });

    // =========================================================================
    // 9.10 — Immutability: DELETE has no effect (AC #2)
    // =========================================================================

    it('DELETE on audit record has no effect — record still exists (mock-based)', async () => {
      // PostgreSQL RULE silently discards DELETEs; Prisma returns the record
      mockPrisma.auditLog.delete.mockResolvedValueOnce(originalRecord);
      mockPrisma.auditLog.findUnique.mockResolvedValueOnce(originalRecord);

      // Attempt to delete the record
      await mockPrisma.auditLog.delete({
        where: { id: originalRecord.id },
      });

      // Verify the record still exists (DB rule discarded the DELETE)
      const record = await mockPrisma.auditLog.findUnique({
        where: { id: originalRecord.id },
      });

      expect(record).not.toBeNull();
      expect(record!.id).toBe(originalRecord.id);
      expect(record!.action).toBe('LOGIN');
    });
  });

  // =========================================================================
  // AuditService.log() — direct unit tests
  // =========================================================================

  describe('log()', () => {
    it('inserts a record with all provided fields', async () => {
      const entry: AuditEntry = {
        companyId: COMPANY_ID,
        entityType: 'AccessGroup',
        entityId: GROUP_ID,
        action: 'CREATE',
        beforeData: undefined,
        afterData: { code: 'ADMIN', name: 'Administrators' },
        userId: USER_ID,
        isAiAction: false,
        correlationId: 'corr-001',
      };

      await service.log(mockPrisma as never, entry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
      const { data } = mockPrisma.auditLog.create.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(data.companyId).toBe(COMPANY_ID);
      expect(data.entityType).toBe('AccessGroup');
      expect(data.entityId).toBe(GROUP_ID);
      expect(data.action).toBe('CREATE');
      expect(data.afterData).toEqual({ code: 'ADMIN', name: 'Administrators' });
      expect(data.userId).toBe(USER_ID);
      expect(data.isAiAction).toBe(false);
      expect(data.correlationId).toBe('corr-001');
    });

    it('omits optional fields when not provided', async () => {
      const entry: AuditEntry = {
        companyId: COMPANY_ID,
        entityType: 'User',
        entityId: USER_ID,
        action: 'LOGIN',
        userId: USER_ID,
        isAiAction: false,
      };

      await service.log(mockPrisma as never, entry);

      const { data } = mockPrisma.auditLog.create.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(data.beforeData).toBeUndefined();
      expect(data.afterData).toBeUndefined();
      expect(data.aiConfidence).toBeUndefined();
      expect(data.correlationId).toBeUndefined();
    });
  });
});
