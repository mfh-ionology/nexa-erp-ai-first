import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import {
  userAccessGroupParamsSchema,
  assignAccessGroupsSchema,
  userAccessGroupsResponseSchema,
} from './user-access-groups.schema.js';
import type { AssignAccessGroupsInput } from './user-access-groups.schema.js';
import { getUserAccessGroups, assignUserAccessGroups } from './user-access-groups.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { DomainError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

const userAccessGroupsEnvelope = successEnvelope(userAccessGroupsResponseSchema);

// ---------------------------------------------------------------------------
// User access group routes plugin
// ---------------------------------------------------------------------------

async function userAccessGroupRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /users/:id/access-groups — list assigned access groups for a user
  fastify.get<{ Params: { id: string } }>(
    '/users/:id/access-groups',
    {
      schema: {
        params: userAccessGroupParamsSchema,
        response: { 200: userAccessGroupsEnvelope },
      },
      preHandler: createPermissionGuard('system.users.detail', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getUserAccessGroups(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // PUT /users/:id/access-groups — replace all access group assignments
  fastify.put<{ Params: { id: string }; Body: AssignAccessGroupsInput }>(
    '/users/:id/access-groups',
    {
      schema: {
        params: userAccessGroupParamsSchema,
        body: assignAccessGroupsSchema,
        response: { 200: userAccessGroupsEnvelope },
      },
      preHandler: createPermissionGuard('system.users.detail', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { accessGroupIds } = request.body;

      // AC #3: Empty array → 422 (DomainError), not Zod's default 400
      if (accessGroupIds.length === 0) {
        throw new DomainError('MIN_GROUPS_REQUIRED', 'At least one access group is required');
      }

      const result = await assignUserAccessGroups(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        request.params.id,
        accessGroupIds,
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );
}

export const userAccessGroupRoutesPlugin = userAccessGroupRoutes;
