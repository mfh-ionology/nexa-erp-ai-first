import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, UserRole } from '@nexa/db';

import {
  createUserRequestSchema,
  updateUserRequestSchema,
  updateUserRoleRequestSchema,
  updateUserModulesRequestSchema,
  userParamsSchema,
  userListQuerySchema,
  userResponseSchema,
  userListResponseSchema,
} from './user.schema.js';
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateUserRoleRequest,
  UpdateUserModulesRequest,
  UserParams,
  UserListQuery,
} from './user.schema.js';
import {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  updateUserRole,
  updateUserModules,
  deactivateUser,
} from './user.service.js';
import { createRbacGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response schemas for pagination
// ---------------------------------------------------------------------------

const paginationMetaSchema = z.object({
  cursor: z.uuid().optional(),
  hasMore: z.boolean().optional(),
  total: z.number().optional(),
});

const userListEnvelope = z.object({
  success: z.literal(true),
  data: userListResponseSchema,
  meta: paginationMetaSchema.optional(),
});

const roleUpdateResponseSchema = z.object({
  userId: z.uuid(),
  role: z.enum(UserRole),
});

// ---------------------------------------------------------------------------
// User CRUD routes plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /users — create user
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateUserRequest }>(
    '/users',
    {
      schema: {
        body: createUserRequestSchema,
        response: { 201: successEnvelope(userResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const user = await createUser(prisma, { ...request.body, companyId: request.companyId }, ctx);
      return sendSuccess(reply, user, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // GET /users — list users with cursor pagination
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: UserListQuery }>(
    '/users',
    {
      schema: {
        querystring: userListQuerySchema,
        response: { 200: userListEnvelope },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const { data, meta } = await listUsers(prisma, request.companyId, request.query);
      return sendSuccess(reply, data, meta);
    },
  );

  // -------------------------------------------------------------------------
  // GET /users/:id — get single user
  // -------------------------------------------------------------------------
  fastify.get<{ Params: UserParams }>(
    '/users/:id',
    {
      schema: {
        params: userParamsSchema,
        response: { 200: successEnvelope(userResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const user = await getUserById(prisma, request.params.id, request.companyId);
      return sendSuccess(reply, user);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /users/:id — update user
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: UserParams; Body: UpdateUserRequest }>(
    '/users/:id',
    {
      schema: {
        params: userParamsSchema,
        body: updateUserRequestSchema,
        response: { 200: successEnvelope(userResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const user = await updateUser(
        prisma,
        request.params.id,
        request.companyId,
        request.body,
        ctx,
      );
      return sendSuccess(reply, user);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /users/:id/role — update global role
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: UserParams; Body: UpdateUserRoleRequest }>(
    '/users/:id/role',
    {
      schema: {
        params: userParamsSchema,
        body: updateUserRoleRequestSchema,
        response: { 200: successEnvelope(roleUpdateResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateUserRole(
        prisma,
        request.params.id,
        request.companyId,
        request.body.role,
        ctx,
      );
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /users/:id/modules — update enabled modules
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: UserParams; Body: UpdateUserModulesRequest }>(
    '/users/:id/modules',
    {
      schema: {
        params: userParamsSchema,
        body: updateUserModulesRequestSchema,
        response: { 200: successEnvelope(userResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const user = await updateUserModules(
        prisma,
        request.params.id,
        request.companyId,
        request.body.enabledModules,
        ctx,
      );
      return sendSuccess(reply, user);
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /users/:id — soft-delete (deactivate)
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: UserParams }>(
    '/users/:id',
    {
      schema: {
        params: userParamsSchema,
        response: { 200: successEnvelope(userResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const user = await deactivateUser(prisma, request.params.id, request.companyId, ctx);
      return sendSuccess(reply, user);
    },
  );
}

export const userRoutesPlugin = userRoutes;
