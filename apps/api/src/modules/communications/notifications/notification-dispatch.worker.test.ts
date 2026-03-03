import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  prisma: {},
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
}));

// Mock BullMQ — we test the processor function directly, not the Worker infra
vi.mock('bullmq', () => {
  // Must use a class (not arrow function) so `new Worker(...)` works
  class MockWorker {
    processor: (...args: unknown[]) => unknown;
    on = vi.fn();
    close = vi.fn().mockResolvedValue(undefined);
    constructor(_queueName: string, processor: (...args: unknown[]) => unknown, _opts?: unknown) {
      this.processor = processor;
    }
  }
  return { Worker: MockWorker };
});

vi.mock('./notification-dispatch.queue.js', () => ({
  NOTIFICATION_DISPATCH_QUEUE_NAME: 'notification-dispatch',
}));

const mockPushNotification = vi.fn();
const mockPushUnreadCount = vi.fn();

vi.mock('./notification.websocket.js', () => ({
  pushNotificationToUser: (...args: unknown[]) => mockPushNotification(...args),
  pushUnreadCountToUser: (...args: unknown[]) => mockPushUnreadCount(...args),
}));

const mockRenderHtml = vi.fn().mockReturnValue('<html>rendered</html>');
const mockRenderText = vi.fn().mockReturnValue('rendered text');

vi.mock('../email/notification-email-template.js', () => ({
  renderNotificationEmailHtml: (...args: unknown[]) => mockRenderHtml(...args),
  renderNotificationEmailText: (...args: unknown[]) => mockRenderText(...args),
}));

const mockEventBusEmit = vi.fn();

vi.mock('../../../core/events/event-bus.js', () => ({
  eventBus: { emit: (...args: unknown[]) => mockEventBusEmit(...args) },
}));

// Import after mocks
import { NotificationStatus } from '@nexa/db';
import { createNotificationDispatchWorker } from './notification-dispatch.worker.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOTIFICATION_ID = '550e8400-e29b-41d4-a716-446655440001';

function fakeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_ID,
    userId: 'user-001',
    templateId: 'tmpl-001',
    title: 'Test notification',
    body: 'Test body',
    channel: 'IN_APP',
    priority: 'NORMAL',
    actionUrl: null,
    entityType: null,
    entityId: null,
    status: 'PENDING',
    deliveredAt: null,
    readAt: null,
    dismissedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockPrisma() {
  return {
    notification: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    companyProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  } as any;
}

function mockEmailSender() {
  return {
    sendEmail: vi.fn().mockResolvedValue(undefined),
    verifyConnection: vi.fn().mockResolvedValue(true),
    close: vi.fn(),
  };
}

function mockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function fakeJob(
  data: { notificationId: string; channel: string },
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'job-001',
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...overrides,
  } as any;
}

/** Extract the processor function from the mocked Worker constructor. */
function getProcessor(worker: any): (job: any) => Promise<void> {
  return worker.processor;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockRenderHtml.mockReturnValue('<html>rendered</html>');
  mockRenderText.mockReturnValue('rendered text');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notification-dispatch worker', () => {
  describe('IN_APP delivery', () => {
    it('should mark notification as DELIVERED with deliveredAt', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const notification = fakeNotification({ status: 'PENDING' });
      prisma.notification.findUnique.mockResolvedValue(notification);
      prisma.notification.update.mockResolvedValue({
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        body: notification.body,
        priority: notification.priority,
        actionUrl: notification.actionUrl,
        entityType: notification.entityType,
        entityId: notification.entityId,
        status: 'DELIVERED',
        createdAt: notification.createdAt,
      });
      prisma.notification.count.mockResolvedValue(5);

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'IN_APP' }));

      expect(prisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
      });
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
        data: {
          status: NotificationStatus.DELIVERED,
          deliveredAt: expect.any(Date),
        },
        select: {
          id: true,
          userId: true,
          title: true,
          body: true,
          priority: true,
          actionUrl: true,
          entityType: true,
          entityId: true,
          status: true,
          createdAt: true,
        },
      });
    });

    it('should push notification via WebSocket after DELIVERED', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const notification = fakeNotification({ status: 'PENDING' });
      const createdAt = notification.createdAt;
      prisma.notification.findUnique.mockResolvedValue(notification);
      prisma.notification.update.mockResolvedValue({
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        body: notification.body,
        priority: notification.priority,
        actionUrl: notification.actionUrl,
        entityType: notification.entityType,
        entityId: notification.entityId,
        status: 'DELIVERED',
        createdAt,
      });
      prisma.notification.count.mockResolvedValue(3);

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'IN_APP' }));

      expect(mockPushNotification).toHaveBeenCalledWith('user-001', {
        id: NOTIFICATION_ID,
        title: 'Test notification',
        body: 'Test body',
        priority: 'NORMAL',
        actionUrl: null,
        entityType: null,
        entityId: null,
        status: 'DELIVERED',
        createdAt: createdAt.toISOString(),
      });
    });

    it('should push unread count via WebSocket after delivery', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const notification = fakeNotification({ status: 'PENDING' });
      prisma.notification.findUnique.mockResolvedValue(notification);
      prisma.notification.update.mockResolvedValue({
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        body: notification.body,
        priority: notification.priority,
        actionUrl: notification.actionUrl,
        entityType: notification.entityType,
        entityId: notification.entityId,
        status: 'DELIVERED',
        createdAt: notification.createdAt,
      });
      prisma.notification.count.mockResolvedValue(7);

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'IN_APP' }));

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-001',
          status: { in: ['PENDING', 'DELIVERED'] },
        },
      });
      expect(mockPushUnreadCount).toHaveBeenCalledWith('user-001', 7);
    });

    it('should not revert DELIVERED status when WebSocket push fails', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const notification = fakeNotification({ status: 'PENDING' });
      prisma.notification.findUnique.mockResolvedValue(notification);
      prisma.notification.update.mockResolvedValue({
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        body: notification.body,
        priority: notification.priority,
        actionUrl: notification.actionUrl,
        entityType: notification.entityType,
        entityId: notification.entityId,
        status: 'DELIVERED',
        createdAt: notification.createdAt,
      });

      // Make WebSocket push throw
      mockPushNotification.mockImplementation(() => {
        throw new Error('WebSocket connection lost');
      });

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any);
      const processor = getProcessor(worker);

      // Should NOT throw — error is caught internally
      await expect(
        processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'IN_APP' })),
      ).resolves.toBeUndefined();

      // DELIVERED status was set (update was called before the WS push)
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DELIVERED' }),
        }),
      );

      // Warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationId: NOTIFICATION_ID,
          userId: 'user-001',
          error: 'WebSocket connection lost',
        }),
        'notification-dispatch: WebSocket push failed — notification still DELIVERED',
      );
    });
  });

  describe('EMAIL delivery', () => {
    const USER_EMAIL = 'john@example.com';
    const COMPANY_NAME = 'Acme Corp';

    function setupEmailMocks(prisma: ReturnType<typeof mockPrisma>) {
      const notification = fakeNotification({
        status: 'PENDING',
        channel: 'EMAIL',
        actionUrl: 'https://app.nexa.io/approvals/1',
      });
      // Single findUnique — processor fetches notification and passes to deliverEmail
      prisma.notification.findUnique.mockResolvedValue(notification);
      prisma.user.findUnique.mockResolvedValue({
        email: USER_EMAIL,
        firstName: 'John',
        companyId: 'company-001',
      });
      prisma.companyProfile.findUnique.mockResolvedValue({
        name: COMPANY_NAME,
        logoUrl: 'https://cdn.nexa.io/logo.png',
      });
      prisma.notification.update.mockResolvedValue({
        ...notification,
        status: 'DELIVERED',
        deliveredAt: new Date(),
      });
      return notification;
    }

    it('E9.3-API-007: should look up user email, render HTML template, send email, and mark DELIVERED', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const sender = mockEmailSender();
      const notification = setupEmailMocks(prisma);

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any, sender);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'EMAIL' }));

      // Looked up user email
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        select: { email: true, firstName: true, companyId: true },
      });

      // Fetched company branding
      expect(prisma.companyProfile.findUnique).toHaveBeenCalledWith({
        where: { id: 'company-001' },
        select: { name: true, logoUrl: true },
      });

      // Rendered HTML with correct data
      expect(mockRenderHtml).toHaveBeenCalledWith({
        title: notification.title,
        body: notification.body,
        actionUrl: notification.actionUrl,
        companyName: COMPANY_NAME,
        logoUrl: 'https://cdn.nexa.io/logo.png',
      });

      // Rendered plain text
      expect(mockRenderText).toHaveBeenCalledWith({
        title: notification.title,
        body: notification.body,
        actionUrl: notification.actionUrl,
      });

      // Sent email with correct fields
      expect(sender.sendEmail).toHaveBeenCalledWith({
        to: USER_EMAIL,
        subject: notification.title,
        html: '<html>rendered</html>',
        text: 'rendered text',
      });

      // Marked DELIVERED atomically via updateMany
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID, status: NotificationStatus.PENDING },
        data: {
          status: NotificationStatus.DELIVERED,
          deliveredAt: expect.any(Date),
        },
      });

      // Emitted email.sent event
      expect(mockEventBusEmit).toHaveBeenCalledWith('email.sent', {
        emailMessageId: NOTIFICATION_ID,
        recipientEmail: USER_EMAIL,
        subject: notification.title,
        documentType: 'notification',
      });
    });

    it('E9.3-API-014: should propagate sendEmail error for BullMQ retry', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const sender = mockEmailSender();
      setupEmailMocks(prisma);

      sender.sendEmail.mockRejectedValue(new Error('SMTP connection refused'));

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any, sender);
      const processor = getProcessor(worker);

      await expect(
        processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'EMAIL' })),
      ).rejects.toThrow('SMTP connection refused');

      // Should NOT have marked as DELIVERED (error thrown before update)
      expect(prisma.notification.updateMany).not.toHaveBeenCalled();
    });

    it('E9.3-API-015: should mark FAILED with warning when emailSender is null (SMTP not configured)', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const notification = fakeNotification({ status: 'PENDING', channel: 'EMAIL' });
      prisma.notification.findUnique.mockResolvedValue(notification);
      prisma.notification.update.mockResolvedValue({
        ...notification,
        status: 'FAILED',
      });

      // Pass null emailSender (SMTP not configured)
      const worker = createNotificationDispatchWorker(prisma, logger, {} as any, null);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'EMAIL' }));

      // Warning logged
      expect(logger.warn).toHaveBeenCalledWith(
        { notificationId: NOTIFICATION_ID },
        'notification-dispatch: EMAIL sender not configured — marking FAILED (email not sent)',
      );

      // Marked FAILED — not DELIVERED (honest about non-delivery)
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
        data: {
          status: NotificationStatus.FAILED,
        },
      });

      // No email sent, no event emitted
      expect(mockRenderHtml).not.toHaveBeenCalled();
      expect(mockEventBusEmit).not.toHaveBeenCalled();
    });

    it('E9.3-API-023: should mark FAILED after BullMQ exhausts all retries', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const sender = mockEmailSender();
      prisma.notification.update.mockResolvedValue({});

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any, sender);

      // Extract the 'failed' event handler
      const onCalls = (worker as any).on.mock.calls;
      const failedHandler = onCalls.find(
        (call: [string, (...args: unknown[]) => void]) => call[0] === 'failed',
      )?.[1];
      expect(failedHandler).toBeDefined();

      // Simulate all 3 retries exhausted for EMAIL channel
      const job = fakeJob(
        { notificationId: NOTIFICATION_ID, channel: 'EMAIL' },
        { attemptsMade: 3, opts: { attempts: 3 } },
      );
      const err = new Error('SMTP permanently unreachable');

      await failedHandler(job, err);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
        data: { status: NotificationStatus.FAILED },
      });
    });

    it('E9.3-API-024: should render email HTML containing notification title, body, action URL, and company branding', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const sender = mockEmailSender();
      setupEmailMocks(prisma);

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any, sender);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'EMAIL' }));

      // Verify renderNotificationEmailHtml was called with all required data
      expect(mockRenderHtml).toHaveBeenCalledTimes(1);
      const renderCall = mockRenderHtml.mock.calls[0][0];
      expect(renderCall.title).toBe('Test notification');
      expect(renderCall.body).toBe('Test body');
      expect(renderCall.actionUrl).toBe('https://app.nexa.io/approvals/1');
      expect(renderCall.companyName).toBe(COMPANY_NAME);
      expect(renderCall.logoUrl).toBe('https://cdn.nexa.io/logo.png');
    });

    it('should mark FAILED when user has no email address', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const sender = mockEmailSender();
      const notification = fakeNotification({ status: 'PENDING', channel: 'EMAIL' });
      prisma.notification.findUnique.mockResolvedValue(notification);
      prisma.user.findUnique.mockResolvedValue({
        email: null,
        firstName: 'John',
        companyId: 'company-001',
      });
      prisma.notification.update.mockResolvedValue({
        ...notification,
        status: 'FAILED',
      });

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any, sender);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'EMAIL' }));

      // Warning logged
      expect(logger.warn).toHaveBeenCalledWith(
        { notificationId: NOTIFICATION_ID, userId: 'user-001' },
        'notification-dispatch: user has no email — marking FAILED',
      );

      // Marked FAILED — no email sent
      expect(sender.sendEmail).not.toHaveBeenCalled();
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
        data: {
          status: NotificationStatus.FAILED,
        },
      });
    });

    it('should mark FAILED when user email format is invalid', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const sender = mockEmailSender();
      const notification = fakeNotification({ status: 'PENDING', channel: 'EMAIL' });
      prisma.notification.findUnique.mockResolvedValue(notification);
      prisma.user.findUnique.mockResolvedValue({
        email: 'not-an-email',
        firstName: 'John',
        companyId: 'company-001',
      });
      prisma.notification.update.mockResolvedValue({
        ...notification,
        status: 'FAILED',
      });

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any, sender);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'EMAIL' }));

      // Warning logged with email address
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationId: NOTIFICATION_ID,
          email: 'not-an-email',
        }),
        'notification-dispatch: invalid email format — marking FAILED',
      );

      // Marked FAILED — no SMTP attempt
      expect(sender.sendEmail).not.toHaveBeenCalled();
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
        data: {
          status: NotificationStatus.FAILED,
        },
      });
    });

    it('should render with fallback branding when companyProfile is not found', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const sender = mockEmailSender();
      const notification = fakeNotification({
        status: 'PENDING',
        channel: 'EMAIL',
        actionUrl: 'https://app.nexa.io/approvals/1',
      });
      prisma.notification.findUnique.mockResolvedValue(notification);
      prisma.user.findUnique.mockResolvedValue({
        email: 'john@example.com',
        firstName: 'John',
        companyId: 'company-001',
      });
      // companyProfile returns null — no company found
      prisma.companyProfile.findUnique.mockResolvedValue(null);
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any, sender);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'EMAIL' }));

      // Template rendered with undefined companyName/logoUrl (falls back to defaults)
      expect(mockRenderHtml).toHaveBeenCalledWith({
        title: notification.title,
        body: notification.body,
        actionUrl: notification.actionUrl,
        companyName: undefined,
        logoUrl: undefined,
      });

      // Email was still sent
      expect(sender.sendEmail).toHaveBeenCalled();

      // Marked DELIVERED
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID, status: NotificationStatus.PENDING },
        data: {
          status: NotificationStatus.DELIVERED,
          deliveredAt: expect.any(Date),
        },
      });
    });
  });

  describe('PUSH stub delivery', () => {
    it('should mark notification as DELIVERED (stub)', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      const notification = fakeNotification({ status: 'PENDING', channel: 'PUSH' });
      prisma.notification.findUnique.mockResolvedValue(notification);
      prisma.notification.update.mockResolvedValue({
        ...notification,
        status: 'DELIVERED',
        deliveredAt: new Date(),
      });

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'PUSH' }));

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
        data: {
          status: NotificationStatus.DELIVERED,
          deliveredAt: expect.any(Date),
        },
      });
    });
  });

  describe('notification not found', () => {
    it('should skip processing when notification does not exist', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      prisma.notification.findUnique.mockResolvedValue(null);

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: 'non-existent', channel: 'IN_APP' }));

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        { notificationId: 'non-existent' },
        'notification-dispatch: notification not found — skipping',
      );
    });
  });

  describe('notification no longer PENDING', () => {
    it('should skip processing when notification is already DELIVERED', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      prisma.notification.findUnique.mockResolvedValue(fakeNotification({ status: 'DELIVERED' }));

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'IN_APP' }));

      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('failure handling', () => {
    it('should propagate delivery errors for BullMQ retry', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      prisma.notification.findUnique.mockResolvedValue(fakeNotification({ status: 'PENDING' }));
      prisma.notification.update.mockRejectedValue(new Error('DB connection lost'));

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any);
      const processor = getProcessor(worker);

      await expect(
        processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'IN_APP' })),
      ).rejects.toThrow('DB connection lost');
    });

    it('should mark notification as FAILED when all retries exhausted via failed event', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      prisma.notification.update.mockResolvedValue({});

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any);

      // Extract the 'failed' event handler
      const onCalls = (worker as any).on.mock.calls;
      const failedHandler = onCalls.find(
        (call: [string, (...args: unknown[]) => void]) => call[0] === 'failed',
      )?.[1];
      expect(failedHandler).toBeDefined();

      // Simulate all retries exhausted (attemptsMade >= attempts)
      const job = fakeJob(
        { notificationId: NOTIFICATION_ID, channel: 'IN_APP' },
        { attemptsMade: 3, opts: { attempts: 3 } },
      );
      const err = new Error('Persistent failure');

      await failedHandler(job, err);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
        data: { status: NotificationStatus.FAILED },
      });
    });

    it('should log retry warning when retries remaining via failed event', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any);

      const onCalls = (worker as any).on.mock.calls;
      const failedHandler = onCalls.find(
        (call: [string, (...args: unknown[]) => void]) => call[0] === 'failed',
      )?.[1];
      expect(failedHandler).toBeDefined();

      // Simulate failure with retries remaining
      const job = fakeJob(
        { notificationId: NOTIFICATION_ID, channel: 'EMAIL' },
        { attemptsMade: 1, opts: { attempts: 3 } },
      );
      const err = new Error('Transient failure');

      await failedHandler(job, err);

      // Should NOT mark as FAILED — retries still available
      expect(prisma.notification.update).not.toHaveBeenCalled();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationId: NOTIFICATION_ID,
          channel: 'EMAIL',
          attempt: 1,
        }),
        'notification-dispatch: job failed — will retry',
      );
    });
  });

  describe('unknown channel', () => {
    it('should log warning and skip for unrecognised channel', async () => {
      const prisma = mockPrisma();
      const logger = mockLogger();
      prisma.notification.findUnique.mockResolvedValue(fakeNotification({ status: 'PENDING' }));

      const worker = createNotificationDispatchWorker(prisma, logger, {} as any);
      const processor = getProcessor(worker);

      await processor(fakeJob({ notificationId: NOTIFICATION_ID, channel: 'SMS' as any }));

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        { notificationId: NOTIFICATION_ID, channel: 'SMS' },
        'notification-dispatch: unknown channel — skipping',
      );
    });
  });
});
