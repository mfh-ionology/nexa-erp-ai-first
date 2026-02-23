import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import {
  listResourcesQuerySchema,
  resourceResponseSchema,
} from './resources.schema.js';
import type { ListResourcesQuery } from './resources.schema.js';
import { listResources } from './resources.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Response envelope for resource list
// ---------------------------------------------------------------------------

const resourceListEnvelope = z.object({
  success: z.literal(true),
  data: z.array(resourceResponseSchema),
  meta: z.object({ total: z.number() }).optional(),
});

// ---------------------------------------------------------------------------
// Resource routes plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function resourceRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /resources — list all resources with optional filters
  fastify.get<{ Querystring: ListResourcesQuery }>(
    '/resources',
    {
      schema: {
        querystring: listResourcesQuerySchema,
        response: { 200: resourceListEnvelope },
      },
      preHandler: createPermissionGuard('system.resources.list', 'view'),
    },
    async (request, reply) => {
      const { data, meta } = await listResources(prisma, request.query);
      return sendSuccess(reply, data, meta);
    },
  );
}

export const resourceRoutesPlugin = resourceRoutes;
