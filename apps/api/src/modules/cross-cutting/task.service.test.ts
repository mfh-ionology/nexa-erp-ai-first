import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestContext } from '../../core/types/request-context.js';
import type { CreateTaskInput, UpdateTaskInput, TaskListQuery } from './task.schema.js';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports that use them
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  prisma: {},
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

vi.mock('../../core/entity-registry/index.js', () => ({
  validateEntityExists: vi.fn(),
}));

// Import after mocks are set up
import { validateEntityExists } from '../../core/entity-registry/index.js';
import { AppError } from '../../core/errors/app-error.js';
import { NotFoundError } from '../../core/errors/not-found-error.js';
import { ValidationError } from '../../core/errors/validation-error.js';

import {
  createTask,
  listTasks,
  getMyTasks,
  getTask,
  updateTask,
  changeTaskStatus,
  addAssignee,
  removeAssignee,
  deleteTask,
} from './task.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TASK_ID = '550e8400-e29b-41d4-a716-446655440000';
const ENTITY_ID = '660e8400-e29b-41d4-a716-446655440000';
const USER_ID_1 = 'user-001';
const USER_ID_2 = 'user-002';
const USER_ID_3 = 'user-003';

const staffCtx: RequestContext = {
  userId: USER_ID_1,
  tenantId: 'tenant-001',
  companyId: 'company-001',
  role: 'STAFF',
  enabledModules: [],
};

const managerCtx: RequestContext = {
  ...staffCtx,
  userId: USER_ID_2,
  role: 'MANAGER',
};

const otherStaffCtx: RequestContext = {
  ...staffCtx,
  userId: USER_ID_3,
  role: 'STAFF',
};

function fakeAssignee(userId: string) {
  return {
    id: `assignee-${userId}`,
    userId,
    user: {
      id: userId,
      firstName: 'User',
      lastName: userId,
      email: `${userId}@test.com`,
    },
  };
}

function fakeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    companyId: 'company-001',
    title: 'Test Task',
    description: null,
    priority: 'NORMAL',
    status: 'OPEN',
    dueDate: null,
    entityType: null,
    entityId: null,
    createdById: USER_ID_1,
    completedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-03-03T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:00:00Z'),
    updatedBy: USER_ID_1,
    assignees: [],
    ...overrides,
  };
}

function mockEventBus() {
  return { emit: vi.fn() } as { emit: ReturnType<typeof vi.fn> };
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const prisma = {
    task: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    taskAssignee: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      delete: vi.fn(),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) =>
    fn(prisma),
  );
  return prisma as never;
}

// ---------------------------------------------------------------------------
// createTask (AC: #1, #2, #3)
// ---------------------------------------------------------------------------

describe('createTask', () => {
  beforeEach(() => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validInput: CreateTaskInput = {
    title: 'New task',
    priority: 'NORMAL',
  };

  it('creates task with correct fields and defaults', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    const created = fakeTask({ title: 'New task' });
    (prisma as { task: { create: ReturnType<typeof vi.fn> } }).task.create.mockResolvedValue(
      created,
    );

    const result = await createTask(staffCtx, prisma, eventBus, validInput);

    expect(result.title).toBe('New task');
    expect(result.assignees).toEqual([]);
    expect(
      (prisma as { task: { create: ReturnType<typeof vi.fn> } }).task.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company-001',
          title: 'New task',
          status: 'OPEN',
          createdById: USER_ID_1,
          updatedBy: USER_ID_1,
        }),
      }),
    );
  });

  it('validates entityType/entityId when provided (BR-TASK-003)', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    const created = fakeTask({ entityType: 'Customer', entityId: ENTITY_ID });
    (prisma as { task: { create: ReturnType<typeof vi.fn> } }).task.create.mockResolvedValue(
      created,
    );

    const input: CreateTaskInput = {
      ...validInput,
      entityType: 'Customer',
      entityId: ENTITY_ID,
    };
    await createTask(staffCtx, prisma, eventBus, input);

    expect(validateEntityExists).toHaveBeenCalledWith(prisma, 'Customer', ENTITY_ID, 'company-001');
  });

  it('propagates entity validation errors', async () => {
    vi.mocked(validateEntityExists).mockRejectedValue(
      new AppError('ENTITY_NOT_FOUND', 'Not found', 404),
    );
    const prisma = mockPrisma();
    const eventBus = mockEventBus();

    const input: CreateTaskInput = {
      ...validInput,
      entityType: 'Customer',
      entityId: ENTITY_ID,
    };
    await expect(createTask(staffCtx, prisma, eventBus, input)).rejects.toThrow(AppError);
  });

  it('validates assignees exist in same company (BR-TASK-004)', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    // Return only one user when two were requested → one missing
    (prisma as { user: { findMany: ReturnType<typeof vi.fn> } }).user.findMany.mockResolvedValue([
      { id: USER_ID_1 },
    ]);

    const input: CreateTaskInput = {
      ...validInput,
      assigneeIds: [USER_ID_1, 'nonexistent-user'],
    };

    await expect(createTask(staffCtx, prisma, eventBus, input)).rejects.toThrow(ValidationError);
  });

  it('emits task.assigned event for each assignee (BR-TASK-005)', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    // All assignees found
    (prisma as { user: { findMany: ReturnType<typeof vi.fn> } }).user.findMany.mockResolvedValue([
      { id: USER_ID_1 },
      { id: USER_ID_2 },
    ]);
    const created = fakeTask({
      assignees: [fakeAssignee(USER_ID_1), fakeAssignee(USER_ID_2)],
    });
    (prisma as { task: { create: ReturnType<typeof vi.fn> } }).task.create.mockResolvedValue(
      created,
    );

    const input: CreateTaskInput = {
      ...validInput,
      assigneeIds: [USER_ID_1, USER_ID_2],
    };
    await createTask(staffCtx, prisma, eventBus, input);

    expect(eventBus.emit).toHaveBeenCalledTimes(2);
    expect(eventBus.emit).toHaveBeenCalledWith(
      'task.assigned',
      expect.objectContaining({
        taskId: TASK_ID,
        assigneeUserId: USER_ID_1,
        assignedBy: USER_ID_1,
        companyId: 'company-001',
      }),
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      'task.assigned',
      expect.objectContaining({
        assigneeUserId: USER_ID_2,
      }),
    );
  });

  it('does not emit events when no assignees', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    const created = fakeTask();
    (prisma as { task: { create: ReturnType<typeof vi.fn> } }).task.create.mockResolvedValue(
      created,
    );

    await createTask(staffCtx, prisma, eventBus, validInput);

    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// listTasks (AC: #8)
// ---------------------------------------------------------------------------

describe('listTasks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validQuery: TaskListQuery = {};

  it('filters by companyId and excludes soft-deleted', async () => {
    const prisma = mockPrisma();
    (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany.mockResolvedValue(
      [],
    );
    (prisma as { task: { count: ReturnType<typeof vi.fn> } }).task.count.mockResolvedValue(0);

    await listTasks(staffCtx, prisma, validQuery);

    expect(
      (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-001',
          deletedAt: null,
        }),
      }),
    );
  });

  it('applies status filter', async () => {
    const prisma = mockPrisma();
    (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany.mockResolvedValue(
      [],
    );
    (prisma as { task: { count: ReturnType<typeof vi.fn> } }).task.count.mockResolvedValue(0);

    await listTasks(staffCtx, prisma, { status: 'OPEN' });

    expect(
      (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'OPEN' }),
      }),
    );
  });

  it('applies priority filter', async () => {
    const prisma = mockPrisma();
    (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany.mockResolvedValue(
      [],
    );
    (prisma as { task: { count: ReturnType<typeof vi.fn> } }).task.count.mockResolvedValue(0);

    await listTasks(staffCtx, prisma, { priority: 'HIGH' });

    expect(
      (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ priority: 'HIGH' }),
      }),
    );
  });

  it('applies entityType + entityId filter', async () => {
    const prisma = mockPrisma();
    (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany.mockResolvedValue(
      [],
    );
    (prisma as { task: { count: ReturnType<typeof vi.fn> } }).task.count.mockResolvedValue(0);

    await listTasks(staffCtx, prisma, { entityType: 'Customer', entityId: ENTITY_ID });

    expect(
      (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entityType: 'Customer',
          entityId: ENTITY_ID,
        }),
      }),
    );
  });

  it('applies assigneeId filter', async () => {
    const prisma = mockPrisma();
    (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany.mockResolvedValue(
      [],
    );
    (prisma as { task: { count: ReturnType<typeof vi.fn> } }).task.count.mockResolvedValue(0);

    await listTasks(staffCtx, prisma, { assigneeId: USER_ID_1 });

    expect(
      (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignees: { some: { userId: USER_ID_1 } },
        }),
      }),
    );
  });

  it('applies search filter (title ILIKE)', async () => {
    const prisma = mockPrisma();
    (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany.mockResolvedValue(
      [],
    );
    (prisma as { task: { count: ReturnType<typeof vi.fn> } }).task.count.mockResolvedValue(0);

    await listTasks(staffCtx, prisma, { search: 'review' });

    expect(
      (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: { contains: 'review', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('respects custom limit and offset', async () => {
    const prisma = mockPrisma();
    (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany.mockResolvedValue(
      [],
    );
    (prisma as { task: { count: ReturnType<typeof vi.fn> } }).task.count.mockResolvedValue(0);

    await listTasks(staffCtx, prisma, { limit: 10, offset: 20 });

    expect(
      (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany,
    ).toHaveBeenCalledWith(expect.objectContaining({ take: 10, skip: 20 }));
  });

  it('returns items with mapped assignees and total', async () => {
    const prisma = mockPrisma();
    const task = fakeTask({ assignees: [fakeAssignee(USER_ID_1)] });
    (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany.mockResolvedValue([
      task,
    ]);
    (prisma as { task: { count: ReturnType<typeof vi.fn> } }).task.count.mockResolvedValue(1);

    const result = await listTasks(staffCtx, prisma, validQuery);

    expect(result.total).toBe(1);
    expect(result.items[0].assignees[0]).toEqual({
      id: `assignee-${USER_ID_1}`,
      userId: USER_ID_1,
      displayName: `User ${USER_ID_1}`,
      email: `${USER_ID_1}@test.com`,
    });
  });
});

// ---------------------------------------------------------------------------
// getMyTasks (AC: #7)
// ---------------------------------------------------------------------------

describe('getMyTasks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('only returns tasks where current user is assignee', async () => {
    const prisma = mockPrisma();
    (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany.mockResolvedValue(
      [],
    );
    (prisma as { task: { count: ReturnType<typeof vi.fn> } }).task.count.mockResolvedValue(0);

    await getMyTasks(staffCtx, prisma, {});

    expect(
      (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-001',
          deletedAt: null,
          assignees: { some: { userId: USER_ID_1 } },
        }),
      }),
    );
  });

  it('applies additional filters on top of assignee scope', async () => {
    const prisma = mockPrisma();
    (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany.mockResolvedValue(
      [],
    );
    (prisma as { task: { count: ReturnType<typeof vi.fn> } }).task.count.mockResolvedValue(0);

    await getMyTasks(staffCtx, prisma, { status: 'OPEN', priority: 'HIGH' });

    expect(
      (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignees: { some: { userId: USER_ID_1 } },
          status: 'OPEN',
          priority: 'HIGH',
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// changeTaskStatus (AC: #4, #5, #6)
// ---------------------------------------------------------------------------

describe('changeTaskStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('transitions from OPEN to IN_PROGRESS', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    const existing = fakeTask({ status: 'OPEN' });
    const updated = fakeTask({ status: 'IN_PROGRESS' });
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { task: { update: ReturnType<typeof vi.fn> } }).task.update.mockResolvedValue(
      updated,
    );

    const result = await changeTaskStatus(staffCtx, prisma, eventBus, TASK_ID, 'IN_PROGRESS');

    expect(result.status).toBe('IN_PROGRESS');
    expect(eventBus.emit).toHaveBeenCalledWith(
      'task.status_changed',
      expect.objectContaining({
        taskId: TASK_ID,
        fromStatus: 'OPEN',
        toStatus: 'IN_PROGRESS',
        changedBy: USER_ID_1,
        companyId: 'company-001',
      }),
    );
  });

  it('sets completedAt when transitioning to COMPLETED (BR-TASK-008)', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    const existing = fakeTask({ status: 'IN_PROGRESS' });
    const updated = fakeTask({
      status: 'COMPLETED',
      completedAt: new Date(),
    });
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { task: { update: ReturnType<typeof vi.fn> } }).task.update.mockResolvedValue(
      updated,
    );

    await changeTaskStatus(staffCtx, prisma, eventBus, TASK_ID, 'COMPLETED');

    expect(
      (prisma as { task: { update: ReturnType<typeof vi.fn> } }).task.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        }),
      }),
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      'task.status_changed',
      expect.objectContaining({
        toStatus: 'COMPLETED',
        completedAt: expect.any(String),
      }),
    );
  });

  it('rejects status change from COMPLETED (BR-TASK-006)', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    const existing = fakeTask({ status: 'COMPLETED' });
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      existing,
    );

    await expect(
      changeTaskStatus(staffCtx, prisma, eventBus, TASK_ID, 'OPEN'),
    ).rejects.toMatchObject({
      code: 'TASK_TERMINAL_STATUS',
      statusCode: 422,
    });
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('rejects status change from CANCELLED (BR-TASK-006)', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    const existing = fakeTask({ status: 'CANCELLED' });
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      existing,
    );

    await expect(
      changeTaskStatus(staffCtx, prisma, eventBus, TASK_ID, 'IN_PROGRESS'),
    ).rejects.toMatchObject({
      code: 'TASK_TERMINAL_STATUS',
      statusCode: 422,
    });
  });

  it('throws NotFoundError when task does not exist', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();

    await expect(
      changeTaskStatus(staffCtx, prisma, eventBus, TASK_ID, 'IN_PROGRESS'),
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// addAssignee / removeAssignee (AC: #3)
// ---------------------------------------------------------------------------

describe('addAssignee', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds assignee and emits task.assigned event', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    const task = fakeTask();
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      task,
    );
    (prisma as { user: { findFirst: ReturnType<typeof vi.fn> } }).user = {
      ...prisma.user,
      findFirst: vi.fn().mockResolvedValue({ id: USER_ID_2 }),
    } as never;
    (
      prisma as { taskAssignee: { create: ReturnType<typeof vi.fn> } }
    ).taskAssignee.create.mockResolvedValue({
      id: 'new-assignee',
      taskId: TASK_ID,
      userId: USER_ID_2,
    });

    await addAssignee(staffCtx, prisma, eventBus, TASK_ID, USER_ID_2);

    expect(eventBus.emit).toHaveBeenCalledWith(
      'task.assigned',
      expect.objectContaining({
        taskId: TASK_ID,
        assigneeUserId: USER_ID_2,
        assignedBy: USER_ID_1,
        companyId: 'company-001',
      }),
    );
  });

  it('handles duplicate assignee (P2002 → 409)', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    const task = fakeTask();
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      task,
    );
    (prisma as { user: { findFirst: ReturnType<typeof vi.fn> } }).user = {
      ...prisma.user,
      findFirst: vi.fn().mockResolvedValue({ id: USER_ID_2 }),
    } as never;
    (
      prisma as { taskAssignee: { create: ReturnType<typeof vi.fn> } }
    ).taskAssignee.create.mockRejectedValue({ code: 'P2002' });

    await expect(addAssignee(staffCtx, prisma, eventBus, TASK_ID, USER_ID_2)).rejects.toMatchObject(
      {
        code: 'DUPLICATE_ASSIGNEE',
        statusCode: 409,
      },
    );
  });

  it('rejects assignee not found in company (BR-TASK-004)', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();
    const task = fakeTask();
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      task,
    );
    (prisma as { user: { findFirst: ReturnType<typeof vi.fn> } }).user = {
      ...prisma.user,
      findFirst: vi.fn().mockResolvedValue(null),
    } as never;

    await expect(addAssignee(staffCtx, prisma, eventBus, TASK_ID, 'nonexistent')).rejects.toThrow(
      ValidationError,
    );
  });

  it('throws NotFoundError when task does not exist', async () => {
    const prisma = mockPrisma();
    const eventBus = mockEventBus();

    await expect(addAssignee(staffCtx, prisma, eventBus, TASK_ID, USER_ID_2)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('removeAssignee', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes assignee successfully', async () => {
    const prisma = mockPrisma();
    const task = fakeTask();
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      task,
    );
    (
      prisma as { taskAssignee: { findFirst: ReturnType<typeof vi.fn> } }
    ).taskAssignee.findFirst.mockResolvedValue({
      id: 'assignee-1',
      taskId: TASK_ID,
      userId: USER_ID_2,
    });

    await removeAssignee(staffCtx, prisma, TASK_ID, USER_ID_2);

    expect(
      (prisma as { taskAssignee: { delete: ReturnType<typeof vi.fn> } }).taskAssignee.delete,
    ).toHaveBeenCalledWith({ where: { id: 'assignee-1' } });
  });

  it('throws NotFoundError when assignee not found on task', async () => {
    const prisma = mockPrisma();
    const task = fakeTask();
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      task,
    );
    // taskAssignee.findFirst returns null by default

    await expect(removeAssignee(staffCtx, prisma, TASK_ID, USER_ID_2)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('throws NotFoundError when task does not exist', async () => {
    const prisma = mockPrisma();

    await expect(removeAssignee(staffCtx, prisma, TASK_ID, USER_ID_2)).rejects.toThrow(
      NotFoundError,
    );
  });
});

// ---------------------------------------------------------------------------
// deleteTask (ownership check)
// ---------------------------------------------------------------------------

describe('deleteTask', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows creator (STAFF) to delete their own task', async () => {
    const prisma = mockPrisma();
    const task = fakeTask({ createdById: USER_ID_1 });
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      task,
    );
    (prisma as { task: { update: ReturnType<typeof vi.fn> } }).task.update.mockResolvedValue({
      ...task,
      deletedAt: new Date(),
    });

    await deleteTask(staffCtx, prisma, TASK_ID);

    expect(
      (prisma as { task: { update: ReturnType<typeof vi.fn> } }).task.update,
    ).toHaveBeenCalledWith({
      where: { id: TASK_ID },
      data: {
        deletedAt: expect.any(Date),
        updatedBy: USER_ID_1,
      },
    });
  });

  it('rejects non-creator STAFF from deleting', async () => {
    const prisma = mockPrisma();
    const task = fakeTask({ createdById: USER_ID_1 }); // created by user-001
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      task,
    );

    // otherStaffCtx has userId: user-003, role: STAFF
    await expect(deleteTask(otherStaffCtx, prisma, TASK_ID)).rejects.toMatchObject({
      statusCode: 403,
      messageKey: 'errors.task.deleteNotOwner',
    });
  });

  it("allows MANAGER to delete others' tasks", async () => {
    const prisma = mockPrisma();
    const task = fakeTask({ createdById: USER_ID_1 }); // created by user-001
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      task,
    );
    (prisma as { task: { update: ReturnType<typeof vi.fn> } }).task.update.mockResolvedValue({
      ...task,
      deletedAt: new Date(),
    });

    // managerCtx has userId: user-002, role: MANAGER
    await deleteTask(managerCtx, prisma, TASK_ID);

    expect(
      (prisma as { task: { update: ReturnType<typeof vi.fn> } }).task.update,
    ).toHaveBeenCalledWith({
      where: { id: TASK_ID },
      data: {
        deletedAt: expect.any(Date),
        updatedBy: USER_ID_2,
      },
    });
  });

  it('throws NotFoundError when task does not exist', async () => {
    const prisma = mockPrisma();

    await expect(deleteTask(staffCtx, prisma, TASK_ID)).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// updateTask (terminal status rejection)
// ---------------------------------------------------------------------------

describe('updateTask', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates allowed fields on OPEN task', async () => {
    const prisma = mockPrisma();
    const existing = fakeTask({ status: 'OPEN' });
    const updated = fakeTask({ title: 'Updated title' });
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { task: { update: ReturnType<typeof vi.fn> } }).task.update.mockResolvedValue(
      updated,
    );

    const input: UpdateTaskInput = { title: 'Updated title' };
    const result = await updateTask(staffCtx, prisma, TASK_ID, input);

    expect(result.title).toBe('Updated title');
  });

  it('rejects update on COMPLETED task (BR-TASK-006)', async () => {
    const prisma = mockPrisma();
    const existing = fakeTask({ status: 'COMPLETED' });
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      existing,
    );

    await expect(updateTask(staffCtx, prisma, TASK_ID, { title: 'nope' })).rejects.toMatchObject({
      code: 'TASK_TERMINAL_STATUS',
      statusCode: 422,
    });
  });

  it('rejects update on CANCELLED task (BR-TASK-006)', async () => {
    const prisma = mockPrisma();
    const existing = fakeTask({ status: 'CANCELLED' });
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      existing,
    );

    await expect(updateTask(staffCtx, prisma, TASK_ID, { title: 'nope' })).rejects.toMatchObject({
      code: 'TASK_TERMINAL_STATUS',
      statusCode: 422,
    });
  });

  it('throws NotFoundError when task does not exist', async () => {
    const prisma = mockPrisma();

    await expect(updateTask(staffCtx, prisma, TASK_ID, { title: 'nope' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects empty update (no fields provided)', async () => {
    const prisma = mockPrisma();
    const existing = fakeTask();
    (prisma as { task: { findFirst: ReturnType<typeof vi.fn> } }).task.findFirst.mockResolvedValue(
      existing,
    );

    // Cast to bypass Zod refinement — tests defense-in-depth check in service
    const emptyInput = {} as UpdateTaskInput;

    await expect(updateTask(staffCtx, prisma, TASK_ID, emptyInput)).rejects.toThrow(
      ValidationError,
    );
  });
});
