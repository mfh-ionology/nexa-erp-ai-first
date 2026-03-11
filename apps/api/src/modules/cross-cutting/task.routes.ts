import type { FastifyInstance } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import {
  createTaskSchema,
  updateTaskSchema,
  statusTransitionSchema,
  addAssigneeSchema,
  taskListQuerySchema,
  taskParamsSchema,
  assigneeParamsSchema,
  taskResponseSchema,
  taskListResponseSchema,
} from './task.schema.js';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  StatusTransitionInput,
  AddAssigneeInput,
  TaskListQuery,
  TaskParams,
  AssigneeParams,
} from './task.schema.js';
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
import { createRbacGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Task CRUD routes plugin
//
// Route layout:
//   GET    /tasks           — list with filters (VIEWER)
//   GET    /tasks/my        — current user's tasks (STAFF) — BEFORE /:id
//   GET    /tasks/:id       — detail (VIEWER)
//   POST   /tasks           — create (STAFF)
//   PATCH  /tasks/:id       — update (STAFF)
//   PATCH  /tasks/:id/status — status transition (STAFF)
//   POST   /tasks/:id/assignees       — add assignee (STAFF)
//   DELETE /tasks/:id/assignees/:userId — remove assignee (STAFF)
//   DELETE /tasks/:id       — delete (STAFF, service enforces ownership)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function taskRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /tasks — list with filters (AC: #8)
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: TaskListQuery }>(
    '/tasks',
    {
      schema: {
        querystring: taskListQuerySchema,
        response: { 200: successEnvelope(taskListResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await listTasks(ctx, prisma, request.query);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // GET /tasks/my — current user's tasks (AC: #7)
  // IMPORTANT: registered BEFORE /:id to avoid route collision
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: TaskListQuery }>(
    '/tasks/my',
    {
      schema: {
        querystring: taskListQuerySchema,
        response: { 200: successEnvelope(taskListResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getMyTasks(ctx, prisma, request.query);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // GET /tasks/:id — detail (AC: #1)
  // -------------------------------------------------------------------------
  fastify.get<{ Params: TaskParams }>(
    '/tasks/:id',
    {
      schema: {
        params: taskParamsSchema,
        response: { 200: successEnvelope(taskResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getTask(ctx, prisma, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // POST /tasks — create (AC: #1, #2, #3)
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateTaskInput }>(
    '/tasks',
    {
      schema: {
        body: createTaskSchema,
        response: { 201: successEnvelope(taskResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createTask(ctx, prisma, request.server.eventBus, request.body);
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /tasks/:id — update (AC: #4)
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: TaskParams; Body: UpdateTaskInput }>(
    '/tasks/:id',
    {
      schema: {
        params: taskParamsSchema,
        body: updateTaskSchema,
        response: { 200: successEnvelope(taskResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateTask(ctx, prisma, request.params.id, request.body);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /tasks/:id/status — status transition (AC: #4, #5, #6)
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: TaskParams; Body: StatusTransitionInput }>(
    '/tasks/:id/status',
    {
      schema: {
        params: taskParamsSchema,
        body: statusTransitionSchema,
        response: { 200: successEnvelope(taskResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await changeTaskStatus(
        ctx,
        prisma,
        request.server.eventBus,
        request.params.id,
        request.body.status,
      );
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // POST /tasks/:id/assignees — add assignee (AC: #3)
  // -------------------------------------------------------------------------
  fastify.post<{ Params: TaskParams; Body: AddAssigneeInput }>(
    '/tasks/:id/assignees',
    {
      schema: {
        params: taskParamsSchema,
        body: addAssigneeSchema,
        response: { 201: successEnvelope(taskResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await addAssignee(
        ctx,
        prisma,
        request.server.eventBus,
        request.params.id,
        request.body.userId,
      );
      // Return the updated task with assignees
      const result = await getTask(ctx, prisma, request.params.id);
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /tasks/:id/assignees/:userId — remove assignee (AC: #3)
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: AssigneeParams }>(
    '/tasks/:id/assignees/:userId',
    {
      schema: {
        params: assigneeParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await removeAssignee(ctx, prisma, request.params.id, request.params.userId);
      return reply.status(204).send();
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /tasks/:id — delete (service enforces creator/MANAGER+ ownership)
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: TaskParams }>(
    '/tasks/:id',
    {
      schema: {
        params: taskParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await deleteTask(ctx, prisma, request.params.id);
      return reply.status(204).send();
    },
  );
}

export const taskRoutesPlugin = taskRoutes;
