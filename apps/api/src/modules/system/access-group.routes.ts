import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import {
  createAccessGroupRequestSchema,
  updateAccessGroupRequestSchema,
  replacePermissionsRequestSchema,
  replaceFieldOverridesRequestSchema,
  accessGroupSummarySchema,
  accessGroupDetailSchema,
} from './access-group.schema.js';
import type {
  CreateAccessGroupRequest,
  UpdateAccessGroupRequest,
  ReplacePermissionsRequest,
  ReplaceFieldOverridesRequest,
} from './access-group.schema.js';
import {
  listAccessGroups,
  getAccessGroup,
  createAccessGroup,
  updateAccessGroup,
  deleteAccessGroup,
  replacePermissions,
  replaceFieldOverrides,
} from './access-group.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Access Group routes plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function accessGroupRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /access-groups — list for current company
  // -------------------------------------------------------------------------
  fastify.get(
    '/access-groups',
    {
      schema: {
        response: { 200: successEnvelope(accessGroupSummarySchema.array()) },
      },
      preHandler: createPermissionGuard('system.access-groups.list', 'view'),
    },
    async (request, reply) => {
      const groups = await listAccessGroups(prisma, request.companyId);
      return sendSuccess(reply, groups);
    },
  );

  // -------------------------------------------------------------------------
  // GET /access-groups/:id — detail with permissions + field overrides
  // -------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/access-groups/:id',
    {
      schema: {
        response: { 200: successEnvelope(accessGroupDetailSchema) },
      },
      preHandler: createPermissionGuard('system.access-groups.detail', 'view'),
    },
    async (request, reply) => {
      const group = await getAccessGroup(prisma, request.companyId, request.params.id);
      return sendSuccess(reply, group);
    },
  );

  // -------------------------------------------------------------------------
  // POST /access-groups — create
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateAccessGroupRequest }>(
    '/access-groups',
    {
      schema: {
        body: createAccessGroupRequestSchema,
        response: { 201: successEnvelope(accessGroupDetailSchema) },
      },
      preHandler: createPermissionGuard('system.access-groups.list', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const group = await createAccessGroup(prisma, request.companyId, request.body, ctx);
      return sendSuccess(reply, group, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /access-groups/:id — update metadata
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string }; Body: UpdateAccessGroupRequest }>(
    '/access-groups/:id',
    {
      schema: {
        body: updateAccessGroupRequestSchema,
        response: { 200: successEnvelope(accessGroupDetailSchema) },
      },
      preHandler: createPermissionGuard('system.access-groups.detail', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const group = await updateAccessGroup(
        prisma,
        request.companyId,
        request.params.id,
        request.body,
        ctx,
      );
      return sendSuccess(reply, group);
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /access-groups/:id — soft-delete (isActive=false)
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/access-groups/:id',
    {
      preHandler: createPermissionGuard('system.access-groups.detail', 'delete'),
    },
    async (request, reply) => {
      await deleteAccessGroup(prisma, request.companyId, request.params.id);
      return reply.status(204).send();
    },
  );

  // -------------------------------------------------------------------------
  // PUT /access-groups/:id/permissions — replace-all permissions
  // -------------------------------------------------------------------------
  fastify.put<{ Params: { id: string }; Body: ReplacePermissionsRequest }>(
    '/access-groups/:id/permissions',
    {
      schema: {
        body: replacePermissionsRequestSchema,
      },
      preHandler: createPermissionGuard('system.access-groups.detail', 'edit'),
    },
    async (request, reply) => {
      const permissions = await replacePermissions(
        prisma,
        request.companyId,
        request.params.id,
        request.body.permissions,
      );
      return sendSuccess(reply, permissions);
    },
  );

  // -------------------------------------------------------------------------
  // PUT /access-groups/:id/field-overrides — replace-all field overrides
  // -------------------------------------------------------------------------
  fastify.put<{ Params: { id: string }; Body: ReplaceFieldOverridesRequest }>(
    '/access-groups/:id/field-overrides',
    {
      schema: {
        body: replaceFieldOverridesRequestSchema,
      },
      preHandler: createPermissionGuard('system.access-groups.detail', 'edit'),
    },
    async (request, reply) => {
      const overrides = await replaceFieldOverrides(
        prisma,
        request.companyId,
        request.params.id,
        request.body.fieldOverrides,
      );
      return sendSuccess(reply, overrides);
    },
  );
}

export const accessGroupRoutesPlugin = accessGroupRoutes;
