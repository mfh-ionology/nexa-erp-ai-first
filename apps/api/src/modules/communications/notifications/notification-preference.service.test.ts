import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestContext } from '../../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports that use them
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  prisma: {},
  NotificationChannel: {
    IN_APP: 'IN_APP',
    EMAIL: 'EMAIL',
    PUSH: 'PUSH',
  },
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

// Import after mocks
import {
  getPreferences,
  updatePreferences,
  resetPreferences,
  getRoleDefaults,
  updateRoleDefaults,
} from './notification-preference.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMPLATE_ID_1 = '550e8400-e29b-41d4-a716-446655440000';
const TEMPLATE_ID_2 = '550e8400-e29b-41d4-a716-446655440001';
const USER_ID = 'user-001';

const staffCtx: RequestContext = {
  userId: USER_ID,
  tenantId: 'tenant-001',
  companyId: 'company-001',
  role: 'STAFF',
  enabledModules: [],
};

function fakeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEMPLATE_ID_1,
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
  };
}

function fakePreference(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pref-001',
    userId: USER_ID,
    notificationTemplateId: TEMPLATE_ID_1,
    enableInApp: true,
    enableEmail: false,
    enablePush: false,
    priorityOverride: null,
    isMuted: false,
    muteUntil: null,
    autoReplyEnabled: false,
    autoReplySubject: null,
    autoReplyBody: null,
    autoReplyStartDate: null,
    autoReplyEndDate: null,
    createdAt: new Date('2026-03-03T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:00:00Z'),
    ...overrides,
  };
}

function fakeRoleDefault(overrides: Record<string, unknown> = {}) {
  return {
    id: 'role-def-001',
    role: 'STAFF',
    notificationTemplateId: TEMPLATE_ID_1,
    enableInApp: true,
    enableEmail: true,
    enablePush: false,
    createdAt: new Date('2026-03-03T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:00:00Z'),
    ...overrides,
  };
}

function mockPrisma() {
  const notificationPreferenceMethods = {
    findMany: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  const notificationRoleDefaultMethods = {
    findMany: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue({}),
  };
  const prisma = {
    notificationTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notificationPreference: notificationPreferenceMethods,
    notificationRoleDefault: notificationRoleDefaultMethods,
    // $transaction: pass-through that executes the callback with a tx client
    // whose models delegate to the same mocks
    $transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        notificationPreference: {
          upsert: notificationPreferenceMethods.upsert,
        },
        notificationRoleDefault: {
          upsert: notificationRoleDefaultMethods.upsert,
        },
      };
      return fn(tx);
    }),
  };
  return prisma as any;
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
// getPreferences
// ---------------------------------------------------------------------------

describe('getPreferences', () => {
  it('should return preferences merged with template defaults when no user preference exists', async () => {
    const prisma = mockPrisma();
    const template = fakeTemplate();
    prisma.notificationTemplate.findMany.mockResolvedValue([template]);
    prisma.notificationPreference.findMany.mockResolvedValue([]);

    const result = await getPreferences(staffCtx, prisma);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      templateId: TEMPLATE_ID_1,
      templateCode: 'APPROVAL_REQUESTED',
      templateName: 'Approval Required',
      eventName: 'approval.requested',
      defaultChannels: ['IN_APP', 'EMAIL'],
      defaultPriority: 'HIGH',
      enableInApp: true, // IN_APP is in defaultChannels
      enableEmail: true, // EMAIL is in defaultChannels
      enablePush: false, // PUSH is NOT in defaultChannels
      priorityOverride: null,
      isMuted: false,
      muteUntil: null,
      hasUserPreference: false,
      source: 'TEMPLATE_DEFAULT',
    });
  });

  it('should return user preference overrides when preference exists', async () => {
    const prisma = mockPrisma();
    const template = fakeTemplate();
    const preference = fakePreference({
      enableInApp: true,
      enableEmail: false,
      enablePush: true,
      isMuted: false,
      muteUntil: null,
    });
    prisma.notificationTemplate.findMany.mockResolvedValue([template]);
    prisma.notificationPreference.findMany.mockResolvedValue([preference]);

    const result = await getPreferences(staffCtx, prisma);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      templateId: TEMPLATE_ID_1,
      enableInApp: true,
      enableEmail: false,
      enablePush: true,
      hasUserPreference: true,
      source: 'USER',
    });
  });

  it('should handle multiple templates with mixed preference states', async () => {
    const prisma = mockPrisma();
    const template1 = fakeTemplate({ id: TEMPLATE_ID_1, code: 'APPROVAL_REQUESTED' });
    const template2 = fakeTemplate({
      id: TEMPLATE_ID_2,
      code: 'PAYMENT_POSTED',
      name: 'Payment Received',
      eventName: 'payment.posted',
      defaultChannels: ['IN_APP'],
      defaultPriority: 'NORMAL',
    });

    // User has preference for template1 only
    const preference = fakePreference({
      notificationTemplateId: TEMPLATE_ID_1,
      enableInApp: false,
      enableEmail: true,
      enablePush: false,
    });

    prisma.notificationTemplate.findMany.mockResolvedValue([template1, template2]);
    prisma.notificationPreference.findMany.mockResolvedValue([preference]);

    const result = await getPreferences(staffCtx, prisma);

    expect(result.items).toHaveLength(2);

    // Template 1: user preference applied
    expect(result.items[0]).toMatchObject({
      templateId: TEMPLATE_ID_1,
      enableInApp: false,
      enableEmail: true,
      enablePush: false,
      hasUserPreference: true,
      source: 'USER',
    });

    // Template 2: template defaults (no user preference)
    expect(result.items[1]).toMatchObject({
      templateId: TEMPLATE_ID_2,
      enableInApp: true, // IN_APP in defaults
      enableEmail: false, // EMAIL NOT in defaults
      enablePush: false, // PUSH NOT in defaults
      hasUserPreference: false,
      source: 'TEMPLATE_DEFAULT',
    });
  });

  it('should return empty items when no active templates exist', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([]);

    const result = await getPreferences(staffCtx, prisma);

    expect(result.items).toHaveLength(0);
  });

  it('should include muteUntil as ISO string when set', async () => {
    const prisma = mockPrisma();
    const template = fakeTemplate();
    const muteDate = new Date('2026-03-10T12:00:00Z');
    const preference = fakePreference({ muteUntil: muteDate });

    prisma.notificationTemplate.findMany.mockResolvedValue([template]);
    prisma.notificationPreference.findMany.mockResolvedValue([preference]);

    const result = await getPreferences(staffCtx, prisma);

    expect(result.items[0]!.muteUntil).toBe('2026-03-10T12:00:00.000Z');
  });

  // ---- Cascade: role default layer (E9-4 Task 5) ----

  it('should use role defaults when no user preference exists (cascade)', async () => {
    const prisma = mockPrisma();
    const template = fakeTemplate();
    const roleDef = fakeRoleDefault({
      notificationTemplateId: TEMPLATE_ID_1,
      enableInApp: true,
      enableEmail: false,
      enablePush: true,
    });

    prisma.notificationTemplate.findMany.mockResolvedValue([template]);
    prisma.notificationPreference.findMany.mockResolvedValue([]);
    prisma.notificationRoleDefault.findMany.mockResolvedValue([roleDef]);

    const result = await getPreferences(staffCtx, prisma);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      templateId: TEMPLATE_ID_1,
      enableInApp: true,
      enableEmail: false,
      enablePush: true,
      hasUserPreference: false,
      source: 'ROLE_DEFAULT',
    });
  });

  it('should prioritize user preference over role default (cascade)', async () => {
    const prisma = mockPrisma();
    const template = fakeTemplate();
    const userPref = fakePreference({
      enableInApp: false,
      enableEmail: true,
      enablePush: false,
    });
    const roleDef = fakeRoleDefault({
      enableInApp: true,
      enableEmail: false,
      enablePush: true,
    });

    prisma.notificationTemplate.findMany.mockResolvedValue([template]);
    prisma.notificationPreference.findMany.mockResolvedValue([userPref]);
    prisma.notificationRoleDefault.findMany.mockResolvedValue([roleDef]);

    const result = await getPreferences(staffCtx, prisma);

    expect(result.items[0]).toMatchObject({
      enableInApp: false, // from user preference, not role default
      enableEmail: true,
      enablePush: false,
      hasUserPreference: true,
      source: 'USER',
    });
  });

  it('should fall back to template default when no user preference and no role default', async () => {
    const prisma = mockPrisma();
    const template = fakeTemplate({ defaultChannels: ['IN_APP', 'PUSH'] });

    prisma.notificationTemplate.findMany.mockResolvedValue([template]);
    prisma.notificationPreference.findMany.mockResolvedValue([]);
    prisma.notificationRoleDefault.findMany.mockResolvedValue([]);

    const result = await getPreferences(staffCtx, prisma);

    expect(result.items[0]).toMatchObject({
      enableInApp: true,
      enableEmail: false,
      enablePush: true,
      source: 'TEMPLATE_DEFAULT',
    });
  });
});

// ---------------------------------------------------------------------------
// updatePreferences
// ---------------------------------------------------------------------------

describe('updatePreferences', () => {
  it('should upsert a new preference record', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([{ id: TEMPLATE_ID_1 }]);
    prisma.notificationPreference.upsert.mockResolvedValue(fakePreference());

    const result = await updatePreferences(staffCtx, prisma, {
      preferences: [
        {
          notificationTemplateId: TEMPLATE_ID_1,
          enableInApp: true,
          enableEmail: false,
          enablePush: false,
        },
      ],
    });

    expect(result).toEqual({ updated: 1 });
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: {
        userId_notificationTemplateId: {
          userId: USER_ID,
          notificationTemplateId: TEMPLATE_ID_1,
        },
      },
      create: {
        userId: USER_ID,
        notificationTemplateId: TEMPLATE_ID_1,
        enableInApp: true,
        enableEmail: false,
        enablePush: false,
        isMuted: false,
        muteUntil: null,
      },
      update: {
        enableInApp: true,
        enableEmail: false,
        enablePush: false,
      },
    });
  });

  it('should upsert multiple preferences in a single call', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([
      { id: TEMPLATE_ID_1 },
      { id: TEMPLATE_ID_2 },
    ]);
    prisma.notificationPreference.upsert.mockResolvedValue(fakePreference());

    const result = await updatePreferences(staffCtx, prisma, {
      preferences: [
        {
          notificationTemplateId: TEMPLATE_ID_1,
          enableInApp: true,
          enableEmail: false,
        },
        {
          notificationTemplateId: TEMPLATE_ID_2,
          enableInApp: false,
          enableEmail: true,
          enablePush: true,
        },
      ],
    });

    expect(result).toEqual({ updated: 2 });
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledTimes(2);
  });

  it('should handle partial updates (only specified fields in update)', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([{ id: TEMPLATE_ID_1 }]);
    prisma.notificationPreference.upsert.mockResolvedValue(fakePreference());

    await updatePreferences(staffCtx, prisma, {
      preferences: [
        {
          notificationTemplateId: TEMPLATE_ID_1,
          enableEmail: false,
          // enableInApp and enablePush not specified — should not appear in update
        },
      ],
    });

    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          enableEmail: false,
          // enableInApp and enablePush should NOT be in the update object
        },
      }),
    );
  });

  it('should handle muteUntil with datetime string', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([{ id: TEMPLATE_ID_1 }]);
    prisma.notificationPreference.upsert.mockResolvedValue(fakePreference());

    await updatePreferences(staffCtx, prisma, {
      preferences: [
        {
          notificationTemplateId: TEMPLATE_ID_1,
          isMuted: true,
          muteUntil: '2026-03-10T12:00:00Z',
        },
      ],
    });

    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          isMuted: true,
          muteUntil: new Date('2026-03-10T12:00:00Z'),
        }),
        update: expect.objectContaining({
          isMuted: true,
          muteUntil: new Date('2026-03-10T12:00:00Z'),
        }),
      }),
    );
  });

  it('should clear muteUntil when set to null', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([{ id: TEMPLATE_ID_1 }]);
    prisma.notificationPreference.upsert.mockResolvedValue(fakePreference());

    await updatePreferences(staffCtx, prisma, {
      preferences: [
        {
          notificationTemplateId: TEMPLATE_ID_1,
          muteUntil: null,
        },
      ],
    });

    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          muteUntil: null,
        }),
        update: expect.objectContaining({
          muteUntil: null,
        }),
      }),
    );
  });

  it('should use defaults for create when optional fields not provided', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([{ id: TEMPLATE_ID_1 }]);
    prisma.notificationPreference.upsert.mockResolvedValue(fakePreference());

    await updatePreferences(staffCtx, prisma, {
      preferences: [
        {
          notificationTemplateId: TEMPLATE_ID_1,
          // No optional fields specified
        },
      ],
    });

    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          enableInApp: true,
          enableEmail: true,
          enablePush: true,
          isMuted: false,
          muteUntil: null,
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// resetPreferences
// ---------------------------------------------------------------------------

describe('resetPreferences', () => {
  it('should delete all user preferences', async () => {
    const prisma = mockPrisma();
    prisma.notificationPreference.deleteMany.mockResolvedValue({ count: 3 });

    const result = await resetPreferences(staffCtx, prisma);

    expect(result).toEqual({ deleted: 3 });
    expect(prisma.notificationPreference.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
  });

  it('should return zero when no preferences exist', async () => {
    const prisma = mockPrisma();
    prisma.notificationPreference.deleteMany.mockResolvedValue({ count: 0 });

    const result = await resetPreferences(staffCtx, prisma);

    expect(result).toEqual({ deleted: 0 });
  });
});

// ---------------------------------------------------------------------------
// getRoleDefaults (E9-4 Task 5)
// ---------------------------------------------------------------------------

const adminCtx: RequestContext = {
  userId: 'admin-001',
  tenantId: 'tenant-001',
  companyId: 'company-001',
  role: 'ADMIN',
  enabledModules: [],
};

describe('getRoleDefaults', () => {
  it('should return role defaults merged with templates', async () => {
    const prisma = mockPrisma();
    const template = fakeTemplate();
    const roleDef = fakeRoleDefault({
      role: 'STAFF',
      notificationTemplateId: TEMPLATE_ID_1,
      enableInApp: true,
      enableEmail: false,
      enablePush: true,
    });

    prisma.notificationTemplate.findMany.mockResolvedValue([template]);
    prisma.notificationRoleDefault.findMany.mockResolvedValue([roleDef]);

    const result = await getRoleDefaults(adminCtx, prisma, { role: 'STAFF' });

    expect(result.role).toBe('STAFF');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      templateId: TEMPLATE_ID_1,
      templateCode: 'APPROVAL_REQUESTED',
      templateName: 'Approval Required',
      enableInApp: true,
      enableEmail: false,
      enablePush: true,
      hasRoleDefault: true,
    });
  });

  it('should fall back to template defaults when no role default exists', async () => {
    const prisma = mockPrisma();
    const template = fakeTemplate({ defaultChannels: ['IN_APP', 'EMAIL'] });

    prisma.notificationTemplate.findMany.mockResolvedValue([template]);
    prisma.notificationRoleDefault.findMany.mockResolvedValue([]);

    const result = await getRoleDefaults(adminCtx, prisma, { role: 'MANAGER' });

    expect(result.role).toBe('MANAGER');
    expect(result.items[0]).toMatchObject({
      enableInApp: true,
      enableEmail: true,
      enablePush: false,
      hasRoleDefault: false,
    });
  });

  it('should return empty items when no active templates exist', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([]);

    const result = await getRoleDefaults(adminCtx, prisma, { role: 'STAFF' });

    expect(result.items).toHaveLength(0);
  });

  it('should handle multiple templates with mixed role-default states', async () => {
    const prisma = mockPrisma();
    const template1 = fakeTemplate({ id: TEMPLATE_ID_1 });
    const template2 = fakeTemplate({
      id: TEMPLATE_ID_2,
      code: 'PAYMENT_POSTED',
      name: 'Payment Received',
      eventName: 'payment.posted',
      defaultChannels: ['IN_APP'],
    });

    // Role default exists for template1 only
    const roleDef = fakeRoleDefault({
      notificationTemplateId: TEMPLATE_ID_1,
      enableInApp: false,
      enableEmail: true,
      enablePush: true,
    });

    prisma.notificationTemplate.findMany.mockResolvedValue([template1, template2]);
    prisma.notificationRoleDefault.findMany.mockResolvedValue([roleDef]);

    const result = await getRoleDefaults(adminCtx, prisma, { role: 'STAFF' });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ hasRoleDefault: true, enableInApp: false });
    expect(result.items[1]).toMatchObject({ hasRoleDefault: false, enableInApp: true });
  });
});

// ---------------------------------------------------------------------------
// updateRoleDefaults (E9-4 Task 5)
// ---------------------------------------------------------------------------

describe('updateRoleDefaults', () => {
  it('should upsert a role default record', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([{ id: TEMPLATE_ID_1 }]);
    prisma.notificationRoleDefault.upsert.mockResolvedValue(fakeRoleDefault());

    const result = await updateRoleDefaults(adminCtx, prisma, {
      role: 'STAFF',
      preferences: [
        {
          notificationTemplateId: TEMPLATE_ID_1,
          enableInApp: true,
          enableEmail: false,
          enablePush: true,
        },
      ],
    });

    expect(result).toEqual({ updated: 1 });
    expect(prisma.notificationRoleDefault.upsert).toHaveBeenCalledWith({
      where: {
        role_notificationTemplateId: {
          role: 'STAFF',
          notificationTemplateId: TEMPLATE_ID_1,
        },
      },
      create: {
        role: 'STAFF',
        notificationTemplateId: TEMPLATE_ID_1,
        enableInApp: true,
        enableEmail: false,
        enablePush: true,
      },
      update: {
        enableInApp: true,
        enableEmail: false,
        enablePush: true,
      },
    });
  });

  it('should upsert multiple role defaults in a single call', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([
      { id: TEMPLATE_ID_1 },
      { id: TEMPLATE_ID_2 },
    ]);
    prisma.notificationRoleDefault.upsert.mockResolvedValue(fakeRoleDefault());

    const result = await updateRoleDefaults(adminCtx, prisma, {
      role: 'MANAGER',
      preferences: [
        {
          notificationTemplateId: TEMPLATE_ID_1,
          enableInApp: true,
          enableEmail: true,
          enablePush: false,
        },
        {
          notificationTemplateId: TEMPLATE_ID_2,
          enableInApp: false,
          enableEmail: false,
          enablePush: true,
        },
      ],
    });

    expect(result).toEqual({ updated: 2 });
    expect(prisma.notificationRoleDefault.upsert).toHaveBeenCalledTimes(2);
  });

  it('should throw ValidationError for invalid template IDs', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([]); // no valid templates

    await expect(
      updateRoleDefaults(adminCtx, prisma, {
        role: 'STAFF',
        preferences: [
          {
            notificationTemplateId: TEMPLATE_ID_1,
            enableInApp: true,
            enableEmail: true,
            enablePush: true,
          },
        ],
      }),
    ).rejects.toThrow('Invalid or inactive notification template IDs');
  });

  it('should throw ValidationError for invalid role', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findMany.mockResolvedValue([{ id: TEMPLATE_ID_1 }]);

    await expect(
      updateRoleDefaults(adminCtx, prisma, {
        role: 'INVALID_ROLE' as any,
        preferences: [
          {
            notificationTemplateId: TEMPLATE_ID_1,
            enableInApp: true,
            enableEmail: true,
            enablePush: true,
          },
        ],
      }),
    ).rejects.toThrow('Invalid role');
  });
});
