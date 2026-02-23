import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createAccessGroupSchema,
  updateAccessGroupSchema,
  setPermissionsSchema,
  listAccessGroupsQuerySchema,
  accessGroupParamsSchema,
  accessGroupDetailSchema,
  accessGroupListItemSchema,
} from './access-groups.schema.js';
import type { ListAccessGroupsQuery, SetPermissionsInput } from './access-groups.schema.js';
import {
  createAccessGroup,
  listAccessGroups,
  getAccessGroupById,
  updateAccessGroup,
  deleteAccessGroup,
  setAccessGroupPermissions,
} from './access-groups.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError, DomainError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const accessGroupDetailEnvelope = successEnvelope(accessGroupDetailSchema);

const accessGroupListEnvelope = z.object({
  success: z.literal(true),
  data: z.array(accessGroupListItemSchema),
  meta: z
    .object({
      cursor: z.string().optional(),
      hasMore: z.boolean().optional(),
      total: z.number().optional(),
    })
    .optional(),
});

const permissionsListEnvelope = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      resourceCode: z.string(),
      canAccess: z.boolean(),
      canNew: z.boolean(),
      canView: z.boolean(),
      canEdit: z.boolean(),
      canDelete: z.boolean(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Access group routes plugin
// ---------------------------------------------------------------------------

async function accessGroupRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /access-groups — create a new access group
  fastify.post(
    '/access-groups',
    {
      schema: {
        body: createAccessGroupSchema,
        response: { 201: accessGroupDetailEnvelope },
      },
      preHandler: createPermissionGuard('system.access-groups.list', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createAccessGroup(prisma, request.server.eventBus, ctx.companyId, request.body as { code: string; name: string; description?: string }, ctx.userId);
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // GET /access-groups — list access groups with pagination and filters
  fastify.get<{ Querystring: ListAccessGroupsQuery }>(
    '/access-groups',
    {
      schema: {
        querystring: listAccessGroupsQuerySchema,
        response: { 200: accessGroupListEnvelope },
      },
      preHandler: createPermissionGuard('system.access-groups.list', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listAccessGroups(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, data, meta);
    },
  );

  // GET /access-groups/:id — get access group detail
  fastify.get<{ Params: { id: string } }>(
    '/access-groups/:id',
    {
      schema: {
        params: accessGroupParamsSchema,
        response: { 200: accessGroupDetailEnvelope },
      },
      preHandler: createPermissionGuard('system.access-groups.detail', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getAccessGroupById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // PATCH /access-groups/:id — update access group metadata
  fastify.patch<{ Params: { id: string } }>(
    '/access-groups/:id',
    {
      schema: {
        params: accessGroupParamsSchema,
        body: updateAccessGroupSchema,
        response: { 200: accessGroupDetailEnvelope },
      },
      preHandler: createPermissionGuard('system.access-groups.detail', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateAccessGroup(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        request.params.id,
        request.body as { name?: string; description?: string | null },
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );

  // DELETE /access-groups/:id — soft-delete access group
  fastify.delete<{ Params: { id: string } }>(
    '/access-groups/:id',
    {
      schema: {
        params: accessGroupParamsSchema,
      },
      preHandler: createPermissionGuard('system.access-groups.detail', 'delete'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        await deleteAccessGroup(prisma, request.server.eventBus, ctx.companyId, request.params.id, ctx.userId);
        return await reply.status(204).send();
      } catch (error) {
        if (
          error instanceof DomainError &&
          ['SYSTEM_GROUP_PROTECTED', 'GROUP_HAS_USERS'].includes(error.code)
        ) {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // PUT /access-groups/:id/permissions — replace all permissions
  fastify.put<{ Params: { id: string }; Body: SetPermissionsInput }>(
    '/access-groups/:id/permissions',
    {
      schema: {
        params: accessGroupParamsSchema,
        body: setPermissionsSchema,
        response: { 200: permissionsListEnvelope },
      },
      preHandler: createPermissionGuard('system.access-groups.detail', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await setAccessGroupPermissions(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        request.params.id,
        request.body,
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );
}

export const accessGroupRoutesPlugin = accessGroupRoutes;
