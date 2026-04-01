import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createDimensionTypeSchema,
  updateDimensionTypeSchema,
  listDimensionTypesQuerySchema,
  dimensionTypeParamsSchema,
  dimensionTypeDetailSchema,
} from './dimension-types.schema.js';
import type { ListDimensionTypesQuery } from './dimension-types.schema.js';
import {
  listDimensionTypes,
  getDimensionTypeById,
  createDimensionType,
  updateDimensionType,
} from './dimension-types.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const dimensionTypeDetailEnvelope = successEnvelope(dimensionTypeDetailSchema);

// ---------------------------------------------------------------------------
// DimensionType routes plugin
// ---------------------------------------------------------------------------

async function dimensionTypesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /dimensions/types — list dimension types with pagination and filters
  fastify.get<{ Querystring: ListDimensionTypesQuery }>(
    '/dimensions/types',
    {
      schema: {
        querystring: listDimensionTypesQuerySchema,
      },
      preHandler: createPermissionGuard('finance.dimensions', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listDimensionTypes(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /dimensions/types/:id — dimension type detail with values count
  fastify.get<{ Params: { id: string } }>(
    '/dimensions/types/:id',
    {
      schema: {
        params: dimensionTypeParamsSchema,
        response: { 200: dimensionTypeDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.dimensions', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getDimensionTypeById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /dimensions/types — create dimension type
  fastify.post(
    '/dimensions/types',
    {
      schema: {
        body: createDimensionTypeSchema,
        response: { 201: dimensionTypeDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.dimensions', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createDimensionType(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof createDimensionTypeSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /dimensions/types/:id — update dimension type
  fastify.patch<{ Params: { id: string } }>(
    '/dimensions/types/:id',
    {
      schema: {
        params: dimensionTypeParamsSchema,
        body: updateDimensionTypeSchema,
        response: { 200: dimensionTypeDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.dimensions', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateDimensionType(
        prisma,
        ctx.companyId,
        request.params.id,
        request.body as z.infer<typeof updateDimensionTypeSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );
}

export const dimensionTypesRoutesPlugin = dimensionTypesRoutes;
