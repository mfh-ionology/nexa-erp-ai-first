import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports that use them
// ---------------------------------------------------------------------------

// Must use a class (not arrow function) so `new Worker(...)` works
vi.mock('bullmq', () => {
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

vi.mock('./task-overdue.queue.js', () => ({
  TASK_OVERDUE_QUEUE_NAME: 'task-overdue-check',
}));

vi.mock('../../core/events/event-bus.js', () => ({
  eventBus: { emit: vi.fn() },
}));

import { Worker } from 'bullmq';
import { createTaskOverdueWorker } from './task-overdue.worker.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TASK_ID_1 = 'task-001';
const TASK_ID_2 = 'task-002';
const TASK_ID_3 = 'task-003';
const USER_ID_1 = 'user-001';
const USER_ID_2 = 'user-002';
const COMPANY_ID = 'company-001';

function fakeOverdueTask(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID_1,
    title: 'Overdue Task',
    dueDate: new Date('2026-03-01T00:00:00Z'),
    companyId: COMPANY_ID,
    createdById: USER_ID_1,
    entityType: null,
    entityId: null,
    assignees: [{ userId: USER_ID_2 }],
    ...overrides,
  };
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    task: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notificationTemplate: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    notification: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as any;
}

function mockEventBus() {
  return { emit: vi.fn() };
}

function mockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

const fakeConnection = { host: 'localhost', port: 6379 };

/**
 * Extract the processor function from the Worker mock instance and invoke it.
 */
async function runWorkerProcessor(prisma: any, eventBus: any, logger: any) {
  const worker = createTaskOverdueWorker(prisma, eventBus, fakeConnection, logger);

  // The MockWorker class stores the processor on the instance
  const processor = (worker as any).processor as (job: any) => Promise<void>;

  await processor({ id: 'job-1', data: {} });
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
// createTaskOverdueWorker — processor logic
// ---------------------------------------------------------------------------

describe('task-overdue worker', () => {
  it('detects overdue tasks (status OPEN/IN_PROGRESS, dueDate < now)', async () => {
    const eventBus = mockEventBus();
    const overdueTasks = [
      fakeOverdueTask({ id: TASK_ID_1, status: 'OPEN' }),
      fakeOverdueTask({ id: TASK_ID_2, status: 'IN_PROGRESS', title: 'Task 2' }),
    ];
    const prisma = mockPrisma();
    prisma.task.findMany.mockResolvedValue(overdueTasks);

    await runWorkerProcessor(prisma, eventBus, mockLogger());

    // Queries for overdue tasks with correct filter
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueDate: { lt: expect.any(Date) },
          deletedAt: null,
        }),
      }),
    );

    // Emits events for both overdue tasks
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
    expect(eventBus.emit).toHaveBeenCalledWith(
      'task.overdue',
      expect.objectContaining({
        taskId: TASK_ID_1,
        companyId: COMPANY_ID,
        assigneeUserIds: [USER_ID_2],
        createdById: USER_ID_1,
      }),
    );
  });

  it('does NOT flag completed/cancelled tasks as overdue', async () => {
    const eventBus = mockEventBus();
    const prisma = mockPrisma();
    // findMany returns empty because completed/cancelled tasks are excluded by the WHERE clause
    prisma.task.findMany.mockResolvedValue([]);

    await runWorkerProcessor(prisma, eventBus, mockLogger());

    // The query filters only for OPEN/IN_PROGRESS
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        }),
      }),
    );
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('excludes deleted tasks (deletedAt set)', async () => {
    const eventBus = mockEventBus();
    const prisma = mockPrisma();
    prisma.task.findMany.mockResolvedValue([]);

    await runWorkerProcessor(prisma, eventBus, mockLogger());

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      }),
    );
  });

  it('skips tasks already notified within 24h (deduplication)', async () => {
    const eventBus = mockEventBus();
    const prisma = mockPrisma();

    const overdueTasks = [
      fakeOverdueTask({ id: TASK_ID_1 }),
      fakeOverdueTask({ id: TASK_ID_2, title: 'Task 2' }),
    ];
    prisma.task.findMany.mockResolvedValue(overdueTasks);

    // Template exists for dedup lookup
    prisma.notificationTemplate.findFirst.mockResolvedValue({ id: 'template-overdue' });

    // TASK_ID_1 was already notified within 24h
    prisma.notification.findMany.mockResolvedValue([{ entityId: TASK_ID_1 }]);

    await runWorkerProcessor(prisma, eventBus, mockLogger());

    // Only TASK_ID_2 should get an event (TASK_ID_1 was deduplicated)
    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    expect(eventBus.emit).toHaveBeenCalledWith(
      'task.overdue',
      expect.objectContaining({ taskId: TASK_ID_2 }),
    );
  });

  it('emits correct payload (taskId, taskTitle, dueDate, companyId, assigneeUserIds, createdById)', async () => {
    const eventBus = mockEventBus();
    const prisma = mockPrisma();
    const dueDate = new Date('2026-03-01T12:00:00Z');

    const task = fakeOverdueTask({
      id: TASK_ID_1,
      title: 'Review invoice',
      dueDate,
      companyId: 'company-xyz',
      createdById: 'creator-001',
      assignees: [{ userId: 'assignee-a' }, { userId: 'assignee-b' }],
      entityType: 'Invoice',
      entityId: 'inv-001',
    });
    prisma.task.findMany.mockResolvedValue([task]);

    await runWorkerProcessor(prisma, eventBus, mockLogger());

    expect(eventBus.emit).toHaveBeenCalledWith('task.overdue', {
      taskId: TASK_ID_1,
      taskTitle: 'Review invoice',
      dueDate: dueDate.toISOString(),
      companyId: 'company-xyz',
      assigneeUserIds: ['assignee-a', 'assignee-b'],
      createdById: 'creator-001',
      entityType: 'Task',
      entityId: TASK_ID_1,
    });
  });

  it('handles individual task failure gracefully (does not stop batch)', async () => {
    const eventBus = mockEventBus();
    const logger = mockLogger();
    const prisma = mockPrisma();

    const overdueTasks = [
      fakeOverdueTask({ id: TASK_ID_1 }),
      fakeOverdueTask({ id: TASK_ID_2, title: 'Task 2' }),
      fakeOverdueTask({ id: TASK_ID_3, title: 'Task 3' }),
    ];
    prisma.task.findMany.mockResolvedValue(overdueTasks);

    // First emit throws, others succeed
    eventBus.emit
      .mockImplementationOnce(() => {
        throw new Error('Redis connection lost');
      })
      .mockImplementation(() => {});

    await runWorkerProcessor(prisma, eventBus, logger);

    // Should have attempted all 3, even though first failed
    expect(eventBus.emit).toHaveBeenCalledTimes(3);
    // Error was logged for the failed task
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: TASK_ID_1 }),
      expect.stringContaining('Failed to emit event'),
    );
  });

  it('logs summary with count of processed and emitted tasks', async () => {
    const eventBus = mockEventBus();
    const logger = mockLogger();
    const prisma = mockPrisma();

    const overdueTasks = [fakeOverdueTask({ id: TASK_ID_1 })];
    prisma.task.findMany.mockResolvedValue(overdueTasks);

    await runWorkerProcessor(prisma, eventBus, logger);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Processed 1 overdue tasks, emitted 1 events'),
    );
  });

  it('logs info and returns early when no overdue tasks found', async () => {
    const eventBus = mockEventBus();
    const logger = mockLogger();
    const prisma = mockPrisma();
    prisma.task.findMany.mockResolvedValue([]);

    await runWorkerProcessor(prisma, eventBus, logger);

    expect(logger.info).toHaveBeenCalledWith('[task-overdue] No overdue tasks found');
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('skips dedup check when no overdue template exists', async () => {
    const eventBus = mockEventBus();
    const prisma = mockPrisma();

    prisma.task.findMany.mockResolvedValue([fakeOverdueTask()]);
    prisma.notificationTemplate.findFirst.mockResolvedValue(null);

    await runWorkerProcessor(prisma, eventBus, mockLogger());

    // No notification dedup query since template doesn't exist yet
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
    // Still emits the event
    expect(eventBus.emit).toHaveBeenCalledTimes(1);
  });

  it('uses task identity (not linked entity) for entityType/entityId', async () => {
    const eventBus = mockEventBus();
    const prisma = mockPrisma();

    // Task linked to an Invoice — but notification should use Task/taskId for dedup
    const task = fakeOverdueTask({ entityType: 'Invoice', entityId: 'inv-001' });
    prisma.task.findMany.mockResolvedValue([task]);

    await runWorkerProcessor(prisma, eventBus, mockLogger());

    expect(eventBus.emit).toHaveBeenCalledWith(
      'task.overdue',
      expect.objectContaining({
        entityType: 'Task',
        entityId: TASK_ID_1,
      }),
    );
  });
});
