import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createDimensionValueSchema,
  updateDimensionValueSchema,
  listDimensionValuesQuerySchema,
  typeIdParamsSchema,
  dimensionValueParamsSchema,
  dimensionValueDetailSchema,
} from './dimension-values.schema.js';
import type { ListDimensionValuesQuery } from './dimension-values.schema.js';
import {
  listDimensionValues,
  getDimensionValueById,
  createDimensionValue,
  updateDimensionValue,
} from './dimension-values.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const dimensionValueDetailEnvelope = successEnvelope(dimensionValueDetailSchema);

// ---------------------------------------------------------------------------
// DimensionValue routes plugin
// ---------------------------------------------------------------------------

async function dimensionValuesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /dimensions/types/:typeId/values — list dimension values
  fastify.get<{ Params: { typeId: string }; Querystring: ListDimensionValuesQuery }>(
    '/dimensions/types/:typeId/values',
    {
      schema: {
        params: typeIdParamsSchema,
        querystring: listDimensionValuesQuerySchema,
      },
      preHandler: createPermissionGuard('finance.dimensions', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listDimensionValues(
        prisma,
        ctx.companyId,
        request.params.typeId,
        request.query,
      );
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /dimensions/types/:typeId/values/:id — dimension value detail
  fastify.get<{ Params: { typeId: string; id: string } }>(
    '/dimensions/types/:typeId/values/:id',
    {
      schema: {
        params: dimensionValueParamsSchema,
        response: { 200: dimensionValueDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.dimensions', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getDimensionValueById(
        prisma,
        ctx.companyId,
        request.params.typeId,
        request.params.id,
      );
      return sendSuccess(reply, result);
    },
  );

  // POST /dimensions/types/:typeId/values — create dimension value
  fastify.post<{ Params: { typeId: string } }>(
    '/dimensions/types/:typeId/values',
    {
      schema: {
        params: typeIdParamsSchema,
        body: createDimensionValueSchema,
        response: { 201: dimensionValueDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.dimensions', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createDimensionValue(
        prisma,
        ctx.companyId,
        request.params.typeId,
        request.body as z.infer<typeof createDimensionValueSchema>,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /dimensions/types/:typeId/values/:id — update dimension value
  fastify.patch<{ Params: { typeId: string; id: string } }>(
    '/dimensions/types/:typeId/values/:id',
    {
      schema: {
        params: dimensionValueParamsSchema,
        body: updateDimensionValueSchema,
        response: { 200: dimensionValueDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.dimensions', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateDimensionValue(
        prisma,
        ctx.companyId,
        request.params.typeId,
        request.params.id,
        request.body as z.infer<typeof updateDimensionValueSchema>,
      );
      return sendSuccess(reply, result);
    },
  );
}

export const dimensionValuesRoutesPlugin = dimensionValuesRoutes;
