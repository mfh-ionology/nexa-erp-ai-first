import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createDimensionRequirementSchema,
  updateDimensionRequirementSchema,
  listDimensionRequirementsQuerySchema,
  dimensionRequirementParamsSchema,
} from './dimension-requirements.schema.js';
import type { ListDimensionRequirementsQuery } from './dimension-requirements.schema.js';
import {
  listDimensionRequirements,
  createDimensionRequirement,
  updateDimensionRequirement,
  deleteDimensionRequirement,
} from './dimension-requirements.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// DimensionRequirement routes plugin
// ---------------------------------------------------------------------------

async function dimensionRequirementsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /dimensions/requirements — list dimension requirements
  fastify.get<{ Querystring: ListDimensionRequirementsQuery }>(
    '/dimensions/requirements',
    {
      schema: {
        querystring: listDimensionRequirementsQuerySchema,
      },
      preHandler: createPermissionGuard('finance.dimensions', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listDimensionRequirements(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // POST /dimensions/requirements — create dimension requirement
  fastify.post(
    '/dimensions/requirements',
    {
      schema: {
        body: createDimensionRequirementSchema,
      },
      preHandler: createPermissionGuard('finance.dimensions', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createDimensionRequirement(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof createDimensionRequirementSchema>,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /dimensions/requirements/:id — update dimension requirement
  fastify.patch<{ Params: { id: string } }>(
    '/dimensions/requirements/:id',
    {
      schema: {
        params: dimensionRequirementParamsSchema,
        body: updateDimensionRequirementSchema,
      },
      preHandler: createPermissionGuard('finance.dimensions', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateDimensionRequirement(
        prisma,
        ctx.companyId,
        request.params.id,
        request.body as z.infer<typeof updateDimensionRequirementSchema>,
      );
      return sendSuccess(reply, result);
    },
  );

  // DELETE /dimensions/requirements/:id — delete dimension requirement
  fastify.delete<{ Params: { id: string } }>(
    '/dimensions/requirements/:id',
    {
      schema: {
        params: dimensionRequirementParamsSchema,
      },
      preHandler: createPermissionGuard('finance.dimensions', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await deleteDimensionRequirement(prisma, ctx.companyId, request.params.id);
      return reply.status(204).send();
    },
  );
}

export const dimensionRequirementsRoutesPlugin = dimensionRequirementsRoutes;
