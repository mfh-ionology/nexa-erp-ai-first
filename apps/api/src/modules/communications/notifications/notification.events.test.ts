import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBus } from '../../../core/events/event-bus.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('./notification.service.js', () => ({
  createNotificationsFromEvent: vi.fn(),
}));

import { createNotificationsFromEvent } from './notification.service.js';
import { registerNotificationSubscribers } from './notification.events.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockPrisma() {
  return {} as never;
}

function mockLogger() {
  return { warn: vi.fn() };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createNotificationsFromEvent).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// registerNotificationSubscribers
// ---------------------------------------------------------------------------

describe('registerNotificationSubscribers', () => {
  it('should trigger notification creation when a subscribed event is emitted', async () => {
    const eventBus = new EventBus();
    const prisma = mockPrisma();
    registerNotificationSubscribers(eventBus, prisma);

    const payload = {
      requestId: 'req-001',
      entityType: 'PurchaseOrder',
      entityId: 'po-001',
      currentAssigneeId: 'user-002',
      ruleId: 'rule-001',
      levelOrder: 1,
    };

    eventBus.emit('approval.requested', payload);
    await eventBus.drain();

    expect(createNotificationsFromEvent).toHaveBeenCalledWith(
      prisma,
      'approval.requested',
      payload,
    );
  });

  it('should subscribe to all curated business events', async () => {
    const eventBus = new EventBus();
    const prisma = mockPrisma();
    registerNotificationSubscribers(eventBus, prisma);

    // Emit a selection of events from different categories
    const events: Array<{ name: string; payload: Record<string, unknown> }> = [
      {
        name: 'approval.completed',
        payload: { requestId: 'r1', entityType: 'Invoice', entityId: 'inv-1', approvedBy: 'u1' },
      },
      {
        name: 'invoice.approved',
        payload: {
          invoiceId: 'inv-1',
          invoiceNumber: 'INV-001',
          customerId: 'c1',
          totalAmount: '100',
        },
      },
      {
        name: 'stock.reorder.triggered',
        payload: {
          itemId: 'item-1',
          itemCode: 'SKU-001',
          itemName: 'Widget',
          warehouseId: 'wh-1',
          currentQuantity: '5',
          reorderPoint: '10',
          reorderQuantity: '50',
        },
      },
      {
        name: 'user.accessGroups.assigned',
        payload: { userId: 'u1', companyId: 'c1', groupIds: ['g1'], assignedBy: 'admin' },
      },
      {
        name: 'ai.automation.failed',
        payload: { automationId: 'a1', companyId: 'c1', runId: 'r1', error: 'timeout' },
      },
    ];

    for (const { name, payload } of events) {
      (eventBus as any).emit(name, payload);
    }

    await eventBus.drain();

    expect(createNotificationsFromEvent).toHaveBeenCalledTimes(5);
  });

  it('should catch and log handler errors without propagating', async () => {
    const eventBus = new EventBus();
    const prisma = mockPrisma();
    const logger = mockLogger();

    vi.mocked(createNotificationsFromEvent).mockRejectedValue(new Error('DB connection lost'));

    registerNotificationSubscribers(eventBus, prisma, logger);

    eventBus.emit('approval.requested', {
      requestId: 'r1',
      entityType: 'Invoice',
      entityId: 'inv-1',
      currentAssigneeId: 'u1',
      ruleId: 'rule-1',
      levelOrder: 1,
    });

    await eventBus.drain();

    // Handler error was caught and logged
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('approval.requested'),
      expect.any(Error),
    );

    // No unhandled rejection — the event bus should not throw
  });

  it('should not trigger notifications for unsubscribed events', async () => {
    const eventBus = new EventBus();
    const prisma = mockPrisma();
    registerNotificationSubscribers(eventBus, prisma);

    // Emit an event that is NOT in the notification subscription list
    eventBus.emit('journal.posted', {
      journalEntryId: 'j1',
      entryNumber: 'JE-001',
      source: 'MANUAL',
      transactionDate: '2026-03-03',
      periodId: 'p1',
      totalAmount: '1000',
      lineCount: 2,
      createdBy: 'u1',
    });

    await eventBus.drain();

    expect(createNotificationsFromEvent).not.toHaveBeenCalled();
  });

  it('should handle events with no matching template as no-ops', async () => {
    const eventBus = new EventBus();
    const prisma = mockPrisma();
    registerNotificationSubscribers(eventBus, prisma);

    // createNotificationsFromEvent returns silently when no template matches
    vi.mocked(createNotificationsFromEvent).mockResolvedValue(undefined);

    eventBus.emit('dispatch.shipped', {
      dispatchId: 'd1',
      orderId: 'o1',
      orderNumber: 'SO-001',
      customerId: 'c1',
      lines: [{ itemId: 'item-1', quantity: '10', warehouseId: 'wh-1' }],
    });

    await eventBus.drain();

    // Service was called but returned silently (no template)
    expect(createNotificationsFromEvent).toHaveBeenCalledTimes(1);
    expect(createNotificationsFromEvent).toHaveBeenCalledWith(
      prisma,
      'dispatch.shipped',
      expect.objectContaining({ dispatchId: 'd1' }),
    );
  });
});
