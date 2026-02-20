import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, UserRole } from '@nexa/db';

import {
  createUserRequestSchema,
  updateUserRequestSchema,
  updateUserRoleRequestSchema,
  updateUserModulesRequestSchema,
  replaceUserAccessGroupsRequestSchema,
  userParamsSchema,
  userListQuerySchema,
  userResponseSchema,
  userListResponseSchema,
  userAccessGroupResponseSchema,
} from './user.schema.js';
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateUserRoleRequest,
  UpdateUserModulesRequest,
  ReplaceUserAccessGroupsRequest,
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
import { createRbacGuard, permissionCache } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AuthError } from '../../core/errors/index.js';

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
      // Security: non-SUPER_ADMIN users cannot create SUPER_ADMIN users
      if (request.body.role === UserRole.SUPER_ADMIN && request.userRole !== UserRole.SUPER_ADMIN) {
        throw new AuthError('FORBIDDEN', 'Insufficient privileges to assign SUPER_ADMIN role', 403);
      }
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
      // Security: non-SUPER_ADMIN users cannot assign SUPER_ADMIN role
      if (request.body.role === UserRole.SUPER_ADMIN && request.userRole !== UserRole.SUPER_ADMIN) {
        throw new AuthError('FORBIDDEN', 'Insufficient privileges to assign SUPER_ADMIN role', 403);
      }
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

  // -------------------------------------------------------------------------
  // GET /users/:id/access-groups — list user's assigned access groups
  // -------------------------------------------------------------------------
  fastify.get<{ Params: UserParams }>(
    '/users/:id/access-groups',
    {
      schema: {
        params: userParamsSchema,
        response: { 200: successEnvelope(userAccessGroupResponseSchema.array()) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const assignments = await prisma.userAccessGroup.findMany({
        where: { userId: request.params.id, companyId: request.companyId },
        include: { accessGroup: { select: { id: true, code: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return sendSuccess(reply, assignments);
    },
  );

  // -------------------------------------------------------------------------
  // PUT /users/:id/access-groups — replace-all access group assignments
  // -------------------------------------------------------------------------
  fastify.put<{ Params: UserParams; Body: ReplaceUserAccessGroupsRequest }>(
    '/users/:id/access-groups',
    {
      schema: {
        params: userParamsSchema,
        body: replaceUserAccessGroupsRequestSchema,
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const { id: targetUserId } = request.params;
      const { accessGroupIds } = request.body;

      // Delete existing and create new in a transaction
      await prisma.$transaction([
        prisma.userAccessGroup.deleteMany({
          where: { userId: targetUserId, companyId: request.companyId },
        }),
        prisma.userAccessGroup.createMany({
          data: accessGroupIds.map((accessGroupId) => ({
            userId: targetUserId,
            accessGroupId,
            companyId: request.companyId,
            assignedBy: request.userId,
          })),
        }),
      ]);

      // Invalidate permission cache for the target user
      permissionCache.invalidate(targetUserId, request.companyId);

      const assignments = await prisma.userAccessGroup.findMany({
        where: { userId: targetUserId, companyId: request.companyId },
        include: { accessGroup: { select: { id: true, code: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return sendSuccess(reply, assignments);
    },
  );
}

export const userRoutesPlugin = userRoutes;
