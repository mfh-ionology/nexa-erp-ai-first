import type { FastifyInstance } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import { resourceListQuerySchema, resourceResponseSchema } from './resource.schema.js';
import type { ResourceListQuery } from './resource.schema.js';
import { createRbacGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';

// ---------------------------------------------------------------------------
// Resource routes plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function resourceRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /resources — list all resources (for permission matrix UI)
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: ResourceListQuery }>(
    '/resources',
    {
      schema: {
        querystring: resourceListQuerySchema,
        response: { 200: successEnvelope(resourceResponseSchema.array()) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const { module, type, search, isActive } = request.query;

      const where: Record<string, unknown> = {};
      if (module) where.module = module;
      if (type) where.type = type;
      if (isActive !== undefined) where.isActive = isActive;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ];
      }

      const resources = await prisma.resource.findMany({
        where,
        orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }],
      });

      return sendSuccess(reply, resources);
    },
  );
}

export const resourceRoutesPlugin = resourceRoutes;
