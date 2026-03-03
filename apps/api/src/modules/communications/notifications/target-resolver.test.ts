import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

import { resolveTargetUsers } from './target-resolver.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ALICE = 'user-alice';
const USER_BOB = 'user-bob';
const USER_CHARLIE = 'user-charlie';

function fakeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'template-001',
    code: 'APPROVAL_REQUESTED',
    name: 'Approval Required',
    description: null,
    eventName: 'approval.requested',
    titleTemplate: 'Approval required',
    bodyTemplate: 'A {{entityType}} requires your approval.',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'HIGH',
    actionUrl: null,
    isActive: true,
    createdAt: new Date('2026-03-03T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:00:00Z'),
    ...overrides,
  } as any;
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    userCompanyRole: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    invoice: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    purchaseOrder: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    salesOrder: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveTargetUsers', () => {
  // ── Strategy 1: Direct user reference ──────────────────────────────────

  describe('direct user reference', () => {
    it('should resolve currentAssigneeId from payload', async () => {
      const prisma = mockPrisma();
      const result = await resolveTargetUsers(prisma, fakeTemplate(), {
        currentAssigneeId: USER_BOB,
        entityType: 'PurchaseOrder',
        entityId: 'po-001',
      });

      expect(result).toEqual([USER_BOB]);
    });

    it('should resolve assigneeId from payload', async () => {
      const prisma = mockPrisma();
      const result = await resolveTargetUsers(prisma, fakeTemplate(), {
        assigneeId: USER_BOB,
      });

      expect(result).toEqual([USER_BOB]);
    });

    it('should resolve userId from payload', async () => {
      const prisma = mockPrisma();
      const result = await resolveTargetUsers(
        prisma,
        fakeTemplate({ eventName: 'user.accessGroups.assigned' }),
        {
          userId: USER_BOB,
          companyId: 'company-001',
          groupIds: ['group-1'],
          assignedBy: USER_ALICE,
        },
      );

      expect(result).toContain(USER_BOB);
    });

    it('should resolve newAssigneeId for escalation events', async () => {
      const prisma = mockPrisma();
      const result = await resolveTargetUsers(
        prisma,
        fakeTemplate({ eventName: 'approval.escalated' }),
        {
          requestId: 'req-001',
          entityType: 'Invoice',
          entityId: 'inv-001',
          fromLevel: 1,
          toLevel: 2,
          newAssigneeId: USER_CHARLIE,
        },
      );

      expect(result).toContain(USER_CHARLIE);
    });

    it('should resolve forwardedTo for forwarding events', async () => {
      const prisma = mockPrisma();
      const result = await resolveTargetUsers(
        prisma,
        fakeTemplate({ eventName: 'approval.forwarded' }),
        {
          requestId: 'req-001',
          entityType: 'Invoice',
          entityId: 'inv-001',
          forwardedTo: USER_CHARLIE,
          forwardedBy: USER_ALICE,
        },
      );

      expect(result).toContain(USER_CHARLIE);
      // forwardedBy is the actor — should be excluded
      expect(result).not.toContain(USER_ALICE);
    });
  });

  // ── Strategy 2: Approval response → entity creator ────────────────────

  describe('approval response — entity creator resolution', () => {
    it('should resolve entity creator when approvedBy is present', async () => {
      const prisma = mockPrisma();
      prisma.invoice = {
        findUnique: vi.fn().mockResolvedValue({ createdBy: USER_BOB }),
      };

      const result = await resolveTargetUsers(
        prisma,
        fakeTemplate({ eventName: 'approval.completed' }),
        {
          requestId: 'req-001',
          entityType: 'Invoice',
          entityId: 'inv-001',
          approvedBy: USER_ALICE,
        },
      );

      // BOB (entity creator) should be notified
      expect(result).toContain(USER_BOB);
      // ALICE (approver / actor) should be excluded
      expect(result).not.toContain(USER_ALICE);
    });

    it('should resolve entity creator when rejectedBy is present', async () => {
      const prisma = mockPrisma();
      prisma.purchaseOrder = {
        findUnique: vi.fn().mockResolvedValue({ createdBy: USER_BOB }),
      };

      const result = await resolveTargetUsers(
        prisma,
        fakeTemplate({ eventName: 'approval.rejected' }),
        {
          requestId: 'req-002',
          entityType: 'PurchaseOrder',
          entityId: 'po-002',
          rejectedBy: USER_CHARLIE,
          rejectionReason: 'Over budget',
        },
      );

      expect(result).toContain(USER_BOB);
      expect(result).not.toContain(USER_CHARLIE);
    });
  });

  // ── Strategy 3: Entity owner (generic) ─────────────────────────────────

  describe('entity owner resolution', () => {
    it('should look up createdBy when no direct user ref exists', async () => {
      const prisma = mockPrisma();
      prisma.salesOrder = {
        findUnique: vi.fn().mockResolvedValue({ createdBy: USER_BOB }),
      };

      const result = await resolveTargetUsers(
        prisma,
        fakeTemplate({ eventName: 'order.confirmed' }),
        {
          entityType: 'SalesOrder',
          entityId: 'so-001',
        },
      );

      expect(result).toEqual([USER_BOB]);
    });

    it('should return empty when entity type is unknown', async () => {
      const prisma = mockPrisma();

      const result = await resolveTargetUsers(prisma, fakeTemplate(), {
        entityType: 'UnknownEntity',
        entityId: 'unknown-001',
      });

      expect(result).toEqual([]);
    });

    it('should return empty when entity is not found', async () => {
      const prisma = mockPrisma();
      prisma.invoice = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      const result = await resolveTargetUsers(prisma, fakeTemplate(), {
        entityType: 'Invoice',
        entityId: 'nonexistent',
      });

      expect(result).toEqual([]);
    });
  });

  // ── Strategy 4: Role-based targeting ───────────────────────────────────

  describe('role-based targeting', () => {
    it('should target MANAGER+ users when no direct targets and companyId present', async () => {
      const prisma = mockPrisma();
      prisma.userCompanyRole.findMany.mockResolvedValue([
        { userId: USER_ALICE },
        { userId: USER_BOB },
      ]);

      const result = await resolveTargetUsers(
        prisma,
        fakeTemplate({ eventName: 'stock.reorder.triggered' }),
        {
          itemId: 'item-001',
          companyId: 'company-001',
        },
      );

      expect(result).toContain(USER_ALICE);
      expect(result).toContain(USER_BOB);
      expect(prisma.userCompanyRole.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'company-001',
          role: { in: ['MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
        },
        select: { userId: true },
      });
    });

    it('should not use role-based if direct targets were found', async () => {
      const prisma = mockPrisma();

      const result = await resolveTargetUsers(prisma, fakeTemplate(), {
        currentAssigneeId: USER_BOB,
        companyId: 'company-001',
      });

      // Direct target found — role-based should NOT be invoked
      expect(prisma.userCompanyRole.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([USER_BOB]);
    });
  });

  // ── Self-notification filtering ────────────────────────────────────────

  describe('self-notification filtering', () => {
    it('should exclude triggeredBy user from results', async () => {
      const prisma = mockPrisma();

      const result = await resolveTargetUsers(prisma, fakeTemplate(), {
        currentAssigneeId: USER_ALICE,
        triggeredBy: USER_ALICE, // same user
      });

      expect(result).toEqual([]);
    });

    it('should exclude actorId from results', async () => {
      const prisma = mockPrisma();

      const result = await resolveTargetUsers(prisma, fakeTemplate(), {
        currentAssigneeId: USER_BOB,
        actorId: USER_BOB,
      });

      expect(result).toEqual([]);
    });

    it('should exclude assignedBy from results', async () => {
      const prisma = mockPrisma();

      const result = await resolveTargetUsers(
        prisma,
        fakeTemplate({ eventName: 'user.accessGroups.assigned' }),
        {
          userId: USER_BOB,
          companyId: 'company-001',
          groupIds: ['group-1'],
          assignedBy: USER_ALICE,
        },
      );

      // BOB notified, ALICE excluded (she is the actor)
      expect(result).toContain(USER_BOB);
      expect(result).not.toContain(USER_ALICE);
    });

    it('should not exclude non-actor users', async () => {
      const prisma = mockPrisma();

      const result = await resolveTargetUsers(prisma, fakeTemplate(), {
        currentAssigneeId: USER_BOB,
        triggeredBy: USER_ALICE, // different user
      });

      expect(result).toEqual([USER_BOB]);
    });
  });

  // ── Deduplication ──────────────────────────────────────────────────────

  describe('deduplication', () => {
    it('should deduplicate when same user appears from multiple strategies', async () => {
      const prisma = mockPrisma();
      // currentAssigneeId targets BOB
      // approvedBy triggers entity creator lookup, which also returns BOB
      prisma.invoice = {
        findUnique: vi.fn().mockResolvedValue({ createdBy: USER_BOB }),
      };

      const result = await resolveTargetUsers(
        prisma,
        fakeTemplate({ eventName: 'approval.completed' }),
        {
          currentAssigneeId: USER_BOB,
          entityType: 'Invoice',
          entityId: 'inv-001',
          approvedBy: USER_ALICE,
        },
      );

      // BOB should appear only once
      expect(result.filter((id) => id === USER_BOB)).toHaveLength(1);
      // ALICE excluded as actor
      expect(result).not.toContain(USER_ALICE);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should return empty array when no resolution strategy applies', async () => {
      const prisma = mockPrisma();

      const result = await resolveTargetUsers(prisma, fakeTemplate(), {
        someRandomField: 'value',
      });

      expect(result).toEqual([]);
    });

    it('should handle entity lookup failure gracefully', async () => {
      const prisma = mockPrisma();
      prisma.invoice = {
        findUnique: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      };
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await resolveTargetUsers(prisma, fakeTemplate(), {
        entityType: 'Invoice',
        entityId: 'inv-fail',
      });

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to look up creator'));
    });

    it('should handle role lookup failure gracefully', async () => {
      const prisma = mockPrisma();
      prisma.userCompanyRole.findMany.mockRejectedValue(new Error('DB error'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await resolveTargetUsers(
        prisma,
        fakeTemplate({ eventName: 'stock.reorder.triggered' }),
        {
          companyId: 'company-001',
        },
      );

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to look up users by role'),
      );
    });
  });
});
