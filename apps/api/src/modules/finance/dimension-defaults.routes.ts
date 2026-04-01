import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createDimensionDefaultSchema,
  listDimensionDefaultsQuerySchema,
  dimensionDefaultParamsSchema,
} from './dimension-defaults.schema.js';
import type { ListDimensionDefaultsQuery } from './dimension-defaults.schema.js';
import {
  listDimensionDefaults,
  createDimensionDefault,
  deleteDimensionDefault,
} from './dimension-defaults.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// DimensionDefault routes plugin
// ---------------------------------------------------------------------------

async function dimensionDefaultsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /dimensions/defaults — list dimension defaults
  fastify.get<{ Querystring: ListDimensionDefaultsQuery }>(
    '/dimensions/defaults',
    {
      schema: {
        querystring: listDimensionDefaultsQuerySchema,
      },
      preHandler: createPermissionGuard('finance.dimensions', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const data = await listDimensionDefaults(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, data);
    },
  );

  // POST /dimensions/defaults — create dimension default
  fastify.post(
    '/dimensions/defaults',
    {
      schema: {
        body: createDimensionDefaultSchema,
      },
      preHandler: createPermissionGuard('finance.dimensions', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createDimensionDefault(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof createDimensionDefaultSchema>,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // DELETE /dimensions/defaults/:id — delete dimension default
  fastify.delete<{ Params: { id: string } }>(
    '/dimensions/defaults/:id',
    {
      schema: {
        params: dimensionDefaultParamsSchema,
      },
      preHandler: createPermissionGuard('finance.dimensions', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await deleteDimensionDefault(prisma, ctx.companyId, request.params.id);
      return reply.status(204).send();
    },
  );
}

export const dimensionDefaultsRoutesPlugin = dimensionDefaultsRoutes;
