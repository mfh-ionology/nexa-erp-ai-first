import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestContext } from '../../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports that use them
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  prisma: {},
  Prisma: {
    TransactionIsolationLevel: {
      Serializable: 'Serializable',
    },
  },
  NotificationChannel: {
    IN_APP: 'IN_APP',
    EMAIL: 'EMAIL',
    PUSH: 'PUSH',
  },
  NotificationStatus: {
    PENDING: 'PENDING',
    DELIVERED: 'DELIVERED',
    READ: 'READ',
    DISMISSED: 'DISMISSED',
    FAILED: 'FAILED',
  },
  NotificationPriority: {
    LOW: 'LOW',
    NORMAL: 'NORMAL',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
  },
}));

vi.mock('./target-resolver.js', () => ({
  resolveTargetUsers: vi.fn(),
}));

vi.mock('./notification-dispatch.queue.js', () => ({
  enqueueNotificationDelivery: vi.fn(),
}));

vi.mock('./template-renderer.js', () => ({
  renderNotificationTemplate: vi.fn(),
}));

vi.mock('../../../core/events/event-bus.js', () => ({
  eventBus: { emit: vi.fn() },
}));

// Import after mocks
import { resolveTargetUsers } from './target-resolver.js';
import { enqueueNotificationDelivery } from './notification-dispatch.queue.js';
import { renderNotificationTemplate } from './template-renderer.js';
import { eventBus } from '../../../core/events/event-bus.js';

import {
  createNotificationsFromEvent,
  listNotifications,
  markAsRead,
  dismissNotification,
  getUnreadCount,
} from './notification.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMPLATE_ID = '550e8400-e29b-41d4-a716-446655440000';
const NOTIFICATION_ID = '660e8400-e29b-41d4-a716-446655440001';
const USER_ID = 'user-001';
const USER_ID_2 = 'user-002';

const staffCtx: RequestContext = {
  userId: USER_ID,
  tenantId: 'tenant-001',
  companyId: 'company-001',
  role: 'STAFF',
  enabledModules: [],
};

function fakeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEMPLATE_ID,
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

function fakeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_ID,
    userId: USER_ID,
    templateId: TEMPLATE_ID,
    title: 'Approval required',
    body: 'A Purchase Order requires your approval.',
    channel: 'IN_APP',
    priority: 'HIGH',
    actionUrl: null,
    entityType: 'PurchaseOrder',
    entityId: 'po-001',
    status: 'DELIVERED',
    deliveredAt: new Date('2026-03-03T00:01:00Z'),
    readAt: null,
    dismissedAt: null,
    createdAt: new Date('2026-03-03T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:01:00Z'),
    ...overrides,
  };
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const notificationMethods = {
    create: vi.fn(),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
  };
  const prisma = {
    notificationTemplate: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    notificationPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    notification: notificationMethods,
    // $transaction: pass-through that executes the callback with a tx client
    // whose notification model delegates to the same mocks
    $transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        notification: {
          create: notificationMethods.create,
          findMany: vi.fn().mockResolvedValue([]), // dedup re-check returns empty (no dupes)
        },
      };
      return fn(tx);
    }),
    ...overrides,
  };
  return prisma as any;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveTargetUsers).mockResolvedValue([]);
  vi.mocked(enqueueNotificationDelivery).mockResolvedValue(undefined);
  vi.mocked(renderNotificationTemplate).mockReturnValue({
    title: 'Approval required',
    body: 'A Purchase Order requires your approval.',
    actionUrl: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// createNotificationsFromEvent
// ---------------------------------------------------------------------------

describe('createNotificationsFromEvent', () => {
  it('should create notifications when a matching template exists', async () => {
    const template = fakeTemplate();
    const prisma = mockPrisma();
    prisma.notificationTemplate.findFirst.mockResolvedValue(template);
    vi.mocked(resolveTargetUsers).mockResolvedValue([USER_ID_2]);
    // No preferences → falls back to template defaults (IN_APP + EMAIL)
    prisma.notificationPreference.findMany.mockResolvedValue([]);

    const createdNotification = fakeNotification({ userId: USER_ID_2, status: 'PENDING' });
    prisma.notification.create.mockResolvedValue(createdNotification);

    await createNotificationsFromEvent(prisma, 'approval.requested', {
      entityType: 'PurchaseOrder',
      entityId: 'po-001',
      currentAssigneeId: USER_ID_2,
    });

    // Should create one notification per channel (IN_APP + EMAIL = 2)
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(enqueueNotificationDelivery).toHaveBeenCalledTimes(2);
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
  });

  it('should be a no-op when no template matches the event', async () => {
    const prisma = mockPrisma();
    prisma.notificationTemplate.findFirst.mockResolvedValue(null);

    await createNotificationsFromEvent(prisma, 'unknown.event', { foo: 'bar' });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(enqueueNotificationDelivery).not.toHaveBeenCalled();
  });

  it('should use user preference channels when preference exists (BR-COM-014)', async () => {
    const template = fakeTemplate({ defaultChannels: ['IN_APP', 'EMAIL'] });
    const prisma = mockPrisma();
    prisma.notificationTemplate.findFirst.mockResolvedValue(template);
    vi.mocked(resolveTargetUsers).mockResolvedValue([USER_ID_2]);

    // User has disabled EMAIL, only IN_APP
    prisma.notificationPreference.findMany.mockResolvedValue([
      {
        userId: USER_ID_2,
        enableInApp: true,
        enableEmail: false,
        enablePush: false,
        isMuted: false,
        muteUntil: null,
        priorityOverride: null,
      },
    ]);

    const created = fakeNotification({ userId: USER_ID_2, status: 'PENDING' });
    prisma.notification.create.mockResolvedValue(created);

    await createNotificationsFromEvent(prisma, 'approval.requested', {
      entityType: 'PurchaseOrder',
      entityId: 'po-001',
    });

    // Only 1 channel (IN_APP) because EMAIL disabled in preference
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: 'IN_APP' }),
      }),
    );
  });

  it('should fall back to template defaults when no preference exists (BR-COM-014)', async () => {
    const template = fakeTemplate({ defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'] });
    const prisma = mockPrisma();
    prisma.notificationTemplate.findFirst.mockResolvedValue(template);
    vi.mocked(resolveTargetUsers).mockResolvedValue([USER_ID_2]);
    // No preferences → falls back to template defaults
    prisma.notificationPreference.findMany.mockResolvedValue([]);

    const created = fakeNotification({ userId: USER_ID_2, status: 'PENDING' });
    prisma.notification.create.mockResolvedValue(created);

    await createNotificationsFromEvent(prisma, 'approval.requested', {});

    // 3 channels from template defaults
    expect(prisma.notification.create).toHaveBeenCalledTimes(3);
  });

  it('should skip muted users', async () => {
    const template = fakeTemplate();
    const prisma = mockPrisma();
    prisma.notificationTemplate.findFirst.mockResolvedValue(template);
    vi.mocked(resolveTargetUsers).mockResolvedValue([USER_ID_2]);

    prisma.notificationPreference.findMany.mockResolvedValue([
      {
        userId: USER_ID_2,
        enableInApp: true,
        enableEmail: true,
        enablePush: false,
        isMuted: true,
        muteUntil: null,
        priorityOverride: null,
      },
    ]);

    await createNotificationsFromEvent(prisma, 'approval.requested', {});

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('should skip users with active muteUntil', async () => {
    const template = fakeTemplate();
    const prisma = mockPrisma();
    prisma.notificationTemplate.findFirst.mockResolvedValue(template);
    vi.mocked(resolveTargetUsers).mockResolvedValue([USER_ID_2]);

    // muteUntil is in the future
    const futureDate = new Date(Date.now() + 3600_000);
    prisma.notificationPreference.findMany.mockResolvedValue([
      {
        userId: USER_ID_2,
        enableInApp: true,
        enableEmail: true,
        enablePush: false,
        isMuted: false,
        muteUntil: futureDate,
        priorityOverride: null,
      },
    ]);

    await createNotificationsFromEvent(prisma, 'approval.requested', {});

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('should handle transaction failures gracefully (AC #5)', async () => {
    const template = fakeTemplate({ defaultChannels: ['IN_APP', 'EMAIL'] });
    const prisma = mockPrisma();
    prisma.notificationTemplate.findFirst.mockResolvedValue(template);
    vi.mocked(resolveTargetUsers).mockResolvedValue([USER_ID_2]);

    // Transaction fails (serialization error)
    prisma.$transaction.mockRejectedValue(new Error('Serialization failure'));

    // Should not throw — TX failure is caught and logged
    await createNotificationsFromEvent(prisma, 'approval.requested', {});

    // No dispatch or events since TX failed
    expect(enqueueNotificationDelivery).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('should handle dispatch queue failures independently (AC #5)', async () => {
    const template = fakeTemplate({ defaultChannels: ['IN_APP', 'EMAIL'] });
    const prisma = mockPrisma();
    prisma.notificationTemplate.findFirst.mockResolvedValue(template);
    vi.mocked(resolveTargetUsers).mockResolvedValue([USER_ID_2]);

    // Transaction succeeds and returns both notifications
    prisma.$transaction.mockResolvedValue([
      { id: 'notif-1', userId: USER_ID_2, channel: 'IN_APP' },
      { id: 'notif-2', userId: USER_ID_2, channel: 'EMAIL' },
    ]);

    // First dispatch fails, second succeeds
    vi.mocked(enqueueNotificationDelivery)
      .mockRejectedValueOnce(new Error('Redis down'))
      .mockResolvedValueOnce(undefined);

    await createNotificationsFromEvent(prisma, 'approval.requested', {});

    // Both dispatch attempts made
    expect(enqueueNotificationDelivery).toHaveBeenCalledTimes(2);
    // Both events emitted (dispatch failure does not block event emission)
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
  });

  it('should use priorityOverride from preference when set', async () => {
    const template = fakeTemplate({ defaultChannels: ['IN_APP'], defaultPriority: 'NORMAL' });
    const prisma = mockPrisma();
    prisma.notificationTemplate.findFirst.mockResolvedValue(template);
    vi.mocked(resolveTargetUsers).mockResolvedValue([USER_ID_2]);

    prisma.notificationPreference.findMany.mockResolvedValue([
      {
        userId: USER_ID_2,
        enableInApp: true,
        enableEmail: false,
        enablePush: false,
        isMuted: false,
        muteUntil: null,
        priorityOverride: 'URGENT',
      },
    ]);

    const created = fakeNotification({ status: 'PENDING' });
    prisma.notification.create.mockResolvedValue(created);

    await createNotificationsFromEvent(prisma, 'approval.requested', {});

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: 'URGENT' }),
      }),
    );
  });

  it('should return early when no target users resolved', async () => {
    const template = fakeTemplate();
    const prisma = mockPrisma();
    prisma.notificationTemplate.findFirst.mockResolvedValue(template);
    vi.mocked(resolveTargetUsers).mockResolvedValue([]);

    await createNotificationsFromEvent(prisma, 'approval.requested', {});

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// listNotifications
// ---------------------------------------------------------------------------

describe('listNotifications', () => {
  it('should return cursor-based paginated results', async () => {
    const prisma = mockPrisma();
    const items = [fakeNotification({ id: 'n-1' }), fakeNotification({ id: 'n-2' })];
    prisma.notification.findMany.mockResolvedValue(items);

    const result = await listNotifications(staffCtx, prisma, { limit: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.cursor).toBeNull();
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        orderBy: { createdAt: 'desc' },
        take: 21, // limit + 1
      }),
    );
  });

  it('should detect hasMore when items exceed limit', async () => {
    const prisma = mockPrisma();
    // Return 3 items when limit is 2 (extra one signals hasMore)
    const items = [
      fakeNotification({ id: 'n-1' }),
      fakeNotification({ id: 'n-2' }),
      fakeNotification({ id: 'n-3' }),
    ];
    prisma.notification.findMany.mockResolvedValue(items);

    const result = await listNotifications(staffCtx, prisma, { limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.meta.hasMore).toBe(true);
    expect(result.meta.cursor).toBe('n-2');
  });

  it('should filter by status when provided', async () => {
    const prisma = mockPrisma();
    prisma.notification.findMany.mockResolvedValue([]);

    await listNotifications(staffCtx, prisma, { limit: 20, status: 'DELIVERED' as any });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, status: 'DELIVERED' },
      }),
    );
  });

  it('should use cursor for pagination', async () => {
    const prisma = mockPrisma();
    prisma.notification.findMany.mockResolvedValue([]);

    await listNotifications(staffCtx, prisma, { limit: 20, cursor: 'cursor-id' });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'cursor-id' },
        skip: 1,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// markAsRead
// ---------------------------------------------------------------------------

describe('markAsRead', () => {
  it('should mark a DELIVERED notification as READ', async () => {
    const prisma = mockPrisma();
    const notification = fakeNotification({ status: 'DELIVERED' });
    prisma.notification.findFirst.mockResolvedValue(notification);
    prisma.notification.update.mockResolvedValue({
      ...notification,
      status: 'READ',
      readAt: new Date(),
    });

    const result = await markAsRead(staffCtx, prisma, NOTIFICATION_ID);

    expect(result.status).toBe('READ');
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: NOTIFICATION_ID },
      data: expect.objectContaining({
        status: 'READ',
        readAt: expect.any(Date),
      }),
    });
  });

  it('should throw NotFoundError when notification does not exist', async () => {
    const prisma = mockPrisma();
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(markAsRead(staffCtx, prisma, 'non-existent')).rejects.toMatchObject({
      name: 'NotFoundError',
      messageKey: 'errors.notification.notFound',
    });
  });

  it('should reject state transition from PENDING to READ', async () => {
    const prisma = mockPrisma();
    prisma.notification.findFirst.mockResolvedValue(fakeNotification({ status: 'PENDING' }));

    await expect(markAsRead(staffCtx, prisma, NOTIFICATION_ID)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 422,
      messageKey: 'errors.notification.invalidStateTransition',
    });
  });

  it('should reject state transition from READ (terminal state)', async () => {
    const prisma = mockPrisma();
    prisma.notification.findFirst.mockResolvedValue(fakeNotification({ status: 'READ' }));

    await expect(markAsRead(staffCtx, prisma, NOTIFICATION_ID)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
  });

  it('should reject state transition from DISMISSED (terminal state)', async () => {
    const prisma = mockPrisma();
    prisma.notification.findFirst.mockResolvedValue(fakeNotification({ status: 'DISMISSED' }));

    await expect(markAsRead(staffCtx, prisma, NOTIFICATION_ID)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
  });

  it('should reject state transition from FAILED (terminal state)', async () => {
    const prisma = mockPrisma();
    prisma.notification.findFirst.mockResolvedValue(fakeNotification({ status: 'FAILED' }));

    await expect(markAsRead(staffCtx, prisma, NOTIFICATION_ID)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
  });
});

// ---------------------------------------------------------------------------
// dismissNotification
// ---------------------------------------------------------------------------

describe('dismissNotification', () => {
  it('should dismiss a DELIVERED notification', async () => {
    const prisma = mockPrisma();
    const notification = fakeNotification({ status: 'DELIVERED' });
    prisma.notification.findFirst.mockResolvedValue(notification);
    prisma.notification.update.mockResolvedValue({
      ...notification,
      status: 'DISMISSED',
      dismissedAt: new Date(),
    });

    const result = await dismissNotification(staffCtx, prisma, NOTIFICATION_ID);

    expect(result.status).toBe('DISMISSED');
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: NOTIFICATION_ID },
      data: expect.objectContaining({
        status: 'DISMISSED',
        dismissedAt: expect.any(Date),
      }),
    });
  });

  it('should throw NotFoundError when notification does not exist', async () => {
    const prisma = mockPrisma();
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(dismissNotification(staffCtx, prisma, 'non-existent')).rejects.toMatchObject({
      name: 'NotFoundError',
      messageKey: 'errors.notification.notFound',
    });
  });

  it('should reject state transition from PENDING to DISMISSED', async () => {
    const prisma = mockPrisma();
    prisma.notification.findFirst.mockResolvedValue(fakeNotification({ status: 'PENDING' }));

    await expect(dismissNotification(staffCtx, prisma, NOTIFICATION_ID)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 422,
    });
  });

  it('should reject state transition from READ (terminal state)', async () => {
    const prisma = mockPrisma();
    prisma.notification.findFirst.mockResolvedValue(fakeNotification({ status: 'READ' }));

    await expect(dismissNotification(staffCtx, prisma, NOTIFICATION_ID)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
  });
});

// ---------------------------------------------------------------------------
// getUnreadCount
// ---------------------------------------------------------------------------

describe('getUnreadCount', () => {
  it('should return count of PENDING + DELIVERED notifications', async () => {
    const prisma = mockPrisma();
    prisma.notification.count.mockResolvedValue(5);

    const result = await getUnreadCount(staffCtx, prisma);

    expect(result).toEqual({ count: 5 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        status: { in: ['PENDING', 'DELIVERED'] },
      },
    });
  });

  it('should return zero when no unread notifications', async () => {
    const prisma = mockPrisma();
    prisma.notification.count.mockResolvedValue(0);

    const result = await getUnreadCount(staffCtx, prisma);

    expect(result).toEqual({ count: 0 });
  });
});
