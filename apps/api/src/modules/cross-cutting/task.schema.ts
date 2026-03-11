import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

const taskStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const taskPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createTaskSchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().max(50000).optional(),
    priority: taskPriorityEnum.optional().default('NORMAL'),
    dueDate: z.coerce.date().optional(),
    entityType: z.string().min(1).optional(),
    entityId: z.uuid().optional(),
    assigneeIds: z.array(z.uuid()).optional(),
  })
  .refine(
    (data) => {
      const hasType = data.entityType !== undefined;
      const hasId = data.entityId !== undefined;
      return hasType === hasId;
    },
    { message: 'entityType and entityId must both be provided or both omitted' },
  );

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(50000).optional(),
    priority: taskPriorityEnum.optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.priority !== undefined ||
      data.dueDate !== undefined,
    { message: 'At least one field (title, description, priority, or dueDate) is required' },
  );

export const statusTransitionSchema = z.object({
  status: taskStatusEnum,
});

export const addAssigneeSchema = z.object({
  userId: z.uuid(),
});

export const taskListQuerySchema = z.object({
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  entityType: z.string().min(1).optional(),
  entityId: z.uuid().optional(),
  assigneeId: z.uuid().optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export const taskParamsSchema = z.object({
  id: z.uuid(),
});

export const assigneeParamsSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const taskAssigneeResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
});

export const taskResponseSchema = z.object({
  id: z.uuid(),
  companyId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  priority: taskPriorityEnum,
  status: taskStatusEnum,
  dueDate: z.date().nullable(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  createdById: z.string(),
  completedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  updatedBy: z.string(),
  assignees: z.array(taskAssigneeResponseSchema),
});

export const taskListResponseSchema = z.object({
  items: z.array(taskResponseSchema),
  total: z.number().int(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>;
export type AddAssigneeInput = z.infer<typeof addAssigneeSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
export type TaskParams = z.infer<typeof taskParamsSchema>;
export type AssigneeParams = z.infer<typeof assigneeParamsSchema>;
export type TaskResponse = z.infer<typeof taskResponseSchema>;
export type TaskListResponse = z.infer<typeof taskListResponseSchema>;
