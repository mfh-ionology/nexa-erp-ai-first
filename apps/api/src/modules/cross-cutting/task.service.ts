import type { PrismaClient } from '@nexa/db';
import { UserRole } from '@nexa/db';
import type { RequestContext } from '../../core/types/request-context.js';
import type { EventBus } from '../../core/events/event-bus.js';
import type { CreateTaskInput, UpdateTaskInput, TaskListQuery } from './task.schema.js';
import { validateEntityExists } from '../../core/entity-registry/index.js';
import { AppError, NotFoundError, ValidationError } from '../../core/errors/index.js';
import { hasMinimumRole, ROLE_LEVEL } from '../../core/rbac/rbac.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPrismaKnownError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === code
  );
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

// Shared include for task queries — assignees with user info
const assigneesInclude = {
  assignees: {
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
} as const;

// Map assignees to flat response shape
function mapAssignees(
  assignees: Array<{
    id: string;
    userId: string;
    user: { id: string; firstName: string; lastName: string; email: string };
  }>,
) {
  return assignees.map((a) => ({
    id: a.id,
    userId: a.userId,
    displayName: `${a.user.firstName} ${a.user.lastName}`.trim(),
    email: a.user.email,
  }));
}

// ---------------------------------------------------------------------------
// createTask (AC: #1, #2, #3)
// ---------------------------------------------------------------------------

export async function createTask(
  ctx: RequestContext,
  prisma: PrismaClient,
  eventBus: EventBus,
  input: CreateTaskInput,
) {
  // BR-TASK-003: Validate entity exists if provided.
  // Tolerate ENTITY_TYPE_NOT_AVAILABLE — the entity type is registered but its
  // Prisma model may not exist yet (e.g. CustomerInvoice before E14 is built).
  if (input.entityType && input.entityId) {
    try {
      await validateEntityExists(prisma, input.entityType, input.entityId, ctx.companyId);
    } catch (err) {
      const isNotAvailable = err instanceof AppError && err.code === 'ENTITY_TYPE_NOT_AVAILABLE';
      if (!isNotAvailable) throw err;
      // Entity model not yet available — store the link anyway
    }
  }

  // BR-TASK-004: Validate all assignees exist in same company
  if (input.assigneeIds && input.assigneeIds.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        id: { in: input.assigneeIds },
        companyId: ctx.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    const foundIds = new Set(users.map((u) => u.id));
    const missing = input.assigneeIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new ValidationError(
        `Assignee(s) not found in company: ${missing.join(', ')}`,
        undefined,
        'errors.task.invalidAssignees',
      );
    }
  }

  // Create task + assignees in a transaction
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        companyId: ctx.companyId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? 'NORMAL',
        status: 'OPEN',
        dueDate: input.dueDate ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        createdById: ctx.userId,
        updatedBy: ctx.userId,
        assignees:
          input.assigneeIds && input.assigneeIds.length > 0
            ? {
                create: input.assigneeIds.map((userId) => ({ userId })),
              }
            : undefined,
      },
      include: assigneesInclude,
    });
    return created;
  });

  // BR-TASK-005: Emit task.assigned for each assignee
  if (task.assignees.length > 0) {
    for (const assignee of task.assignees) {
      eventBus.emit('task.assigned', {
        taskId: task.id,
        taskTitle: task.title,
        assigneeUserId: assignee.userId,
        assignedBy: ctx.userId,
        companyId: ctx.companyId,
        entityType: task.entityType ?? undefined,
        entityId: task.entityId ?? undefined,
      });
    }
  }

  return {
    ...task,
    assignees: mapAssignees(task.assignees),
  };
}

// ---------------------------------------------------------------------------
// listTasks (AC: #8)
// ---------------------------------------------------------------------------

export async function listTasks(ctx: RequestContext, prisma: PrismaClient, query: TaskListQuery) {
  const where: Record<string, unknown> = {
    companyId: ctx.companyId,
    deletedAt: null,
  };

  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.entityType) where.entityType = query.entityType;
  if (query.entityId) where.entityId = query.entityId;
  if (query.assigneeId) {
    where.assignees = { some: { userId: query.assigneeId } };
  }
  if (query.search) {
    where.title = { contains: query.search, mode: 'insensitive' };
  }

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: assigneesInclude,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    items: items.map((t) => ({
      ...t,
      assignees: mapAssignees(t.assignees),
    })),
    total,
  };
}

// ---------------------------------------------------------------------------
// getMyTasks (AC: #7)
// ---------------------------------------------------------------------------

export async function getMyTasks(ctx: RequestContext, prisma: PrismaClient, query: TaskListQuery) {
  const where: Record<string, unknown> = {
    companyId: ctx.companyId,
    deletedAt: null,
    assignees: { some: { userId: ctx.userId } },
  };

  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.entityType) where.entityType = query.entityType;
  if (query.entityId) where.entityId = query.entityId;
  if (query.search) {
    where.title = { contains: query.search, mode: 'insensitive' };
  }

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: assigneesInclude,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    items: items.map((t) => ({
      ...t,
      assignees: mapAssignees(t.assignees),
    })),
    total,
  };
}

// ---------------------------------------------------------------------------
// getTask (AC: #1)
// ---------------------------------------------------------------------------

export async function getTask(ctx: RequestContext, prisma: PrismaClient, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: ctx.companyId, deletedAt: null },
    include: assigneesInclude,
  });

  if (!task) {
    throw new NotFoundError('TASK_NOT_FOUND', 'Task not found', 'errors.task.notFound');
  }

  return {
    ...task,
    assignees: mapAssignees(task.assignees),
  };
}

// ---------------------------------------------------------------------------
// updateTask (AC: #4)
// ---------------------------------------------------------------------------

export async function updateTask(
  ctx: RequestContext,
  prisma: PrismaClient,
  taskId: string,
  input: UpdateTaskInput,
) {
  // Defense-in-depth: Zod .refine() may not serialize through Fastify
  if (
    input.title === undefined &&
    input.description === undefined &&
    input.priority === undefined &&
    input.dueDate === undefined
  ) {
    throw new ValidationError(
      'At least one field (title, description, priority, or dueDate) is required',
      undefined,
      'errors.task.emptyUpdate',
    );
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: ctx.companyId, deletedAt: null },
  });

  if (!task) {
    throw new NotFoundError('TASK_NOT_FOUND', 'Task not found', 'errors.task.notFound');
  }

  // BR-TASK-006: Reject updates on terminal status tasks
  if (TERMINAL_STATUSES.has(task.status)) {
    throw new AppError(
      'TASK_TERMINAL_STATUS',
      'Cannot update a task in terminal status',
      422,
      undefined,
      'errors.task.terminalStatus',
    );
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      updatedBy: ctx.userId,
    },
    include: assigneesInclude,
  });

  return {
    ...updated,
    assignees: mapAssignees(updated.assignees),
  };
}

// ---------------------------------------------------------------------------
// changeTaskStatus (AC: #4, #5, #6)
// ---------------------------------------------------------------------------

export async function changeTaskStatus(
  ctx: RequestContext,
  prisma: PrismaClient,
  eventBus: EventBus,
  taskId: string,
  newStatus: string,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: ctx.companyId, deletedAt: null },
  });

  if (!task) {
    throw new NotFoundError('TASK_NOT_FOUND', 'Task not found', 'errors.task.notFound');
  }

  // BR-TASK-006: Reject transitions from terminal states
  if (TERMINAL_STATUSES.has(task.status)) {
    throw new AppError(
      'TASK_TERMINAL_STATUS',
      'Cannot change status of a completed or cancelled task',
      422,
      undefined,
      'errors.task.terminalStatus',
    );
  }

  // BR-TASK-008: Set completedAt when transitioning to COMPLETED
  const completedAt = newStatus === 'COMPLETED' ? new Date() : undefined;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: newStatus as 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
      ...(completedAt ? { completedAt } : {}),
      updatedBy: ctx.userId,
    },
    include: assigneesInclude,
  });

  // Emit status_changed event — include createdById + assigneeUserIds for notification targeting
  eventBus.emit('task.status_changed', {
    taskId: updated.id,
    taskTitle: updated.title,
    fromStatus: task.status,
    toStatus: newStatus,
    changedBy: ctx.userId,
    companyId: ctx.companyId,
    ...(completedAt ? { completedAt: completedAt.toISOString() } : {}),
    createdById: updated.createdById,
    assigneeUserIds: updated.assignees.map((a) => a.userId),
  });

  return {
    ...updated,
    assignees: mapAssignees(updated.assignees),
  };
}

// ---------------------------------------------------------------------------
// addAssignee (AC: #3)
// ---------------------------------------------------------------------------

export async function addAssignee(
  ctx: RequestContext,
  prisma: PrismaClient,
  eventBus: EventBus,
  taskId: string,
  userId: string,
) {
  // Validate task exists + companyId scope
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: ctx.companyId, deletedAt: null },
  });

  if (!task) {
    throw new NotFoundError('TASK_NOT_FOUND', 'Task not found', 'errors.task.notFound');
  }

  // BR-TASK-004: Validate user exists in same company
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      companyId: ctx.companyId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!user) {
    throw new ValidationError(
      'User not found in company',
      undefined,
      'errors.task.invalidAssignees',
    );
  }

  // Create assignee — handle P2002 duplicate
  try {
    await prisma.taskAssignee.create({
      data: { taskId, userId },
    });
  } catch (error) {
    if (isPrismaKnownError(error, 'P2002')) {
      throw new AppError(
        'DUPLICATE_ASSIGNEE',
        'User is already assigned to this task',
        409,
        undefined,
        'errors.task.duplicateAssignee',
      );
    }
    throw error;
  }

  // BR-TASK-005: Emit task.assigned event
  eventBus.emit('task.assigned', {
    taskId: task.id,
    taskTitle: task.title,
    assigneeUserId: userId,
    assignedBy: ctx.userId,
    companyId: ctx.companyId,
    entityType: task.entityType ?? undefined,
    entityId: task.entityId ?? undefined,
  });
}

// ---------------------------------------------------------------------------
// removeAssignee (AC: #3)
// ---------------------------------------------------------------------------

export async function removeAssignee(
  ctx: RequestContext,
  prisma: PrismaClient,
  taskId: string,
  userId: string,
) {
  // Validate task exists + companyId scope
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: ctx.companyId, deletedAt: null },
    select: { id: true },
  });

  if (!task) {
    throw new NotFoundError('TASK_NOT_FOUND', 'Task not found', 'errors.task.notFound');
  }

  const assignee = await prisma.taskAssignee.findFirst({
    where: { taskId, userId },
  });

  if (!assignee) {
    throw new NotFoundError(
      'ASSIGNEE_NOT_FOUND',
      'Assignee not found on this task',
      'errors.task.assigneeNotFound',
    );
  }

  await prisma.taskAssignee.delete({
    where: { id: assignee.id },
  });
}

// ---------------------------------------------------------------------------
// deleteTask (AC: soft delete with ownership check)
// ---------------------------------------------------------------------------

export async function deleteTask(ctx: RequestContext, prisma: PrismaClient, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: ctx.companyId, deletedAt: null },
  });

  if (!task) {
    throw new NotFoundError('TASK_NOT_FOUND', 'Task not found', 'errors.task.notFound');
  }

  // Ownership check: creator can delete (STAFF+), otherwise MANAGER+ required
  if (task.createdById !== ctx.userId) {
    if (!(ctx.role in ROLE_LEVEL) || !hasMinimumRole(ctx.role as UserRole, UserRole.MANAGER)) {
      throw new AppError(
        'FORBIDDEN',
        'Only the creator or a manager can delete this task',
        403,
        undefined,
        'errors.task.deleteNotOwner',
      );
    }
  }

  // Soft delete
  await prisma.task.update({
    where: { id: taskId },
    data: {
      deletedAt: new Date(),
      updatedBy: ctx.userId,
    },
  });
}
