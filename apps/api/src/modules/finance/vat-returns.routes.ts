import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import {
  createVatReturnSchema,
  listVatReturnsQuerySchema,
  vatReturnParamsSchema,
  vatReturnDetailSchema,
} from './vat-returns.schema.js';
import type { ListVatReturnsQuery } from './vat-returns.schema.js';
import {
  listVatReturns,
  getVatReturnById,
  createVatReturn,
  calculateVatReturn,
} from './vat-returns.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError } from '../../core/errors/index.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const vatReturnDetailEnvelope = successEnvelope(vatReturnDetailSchema);

// ---------------------------------------------------------------------------
// VAT Returns routes plugin
// ---------------------------------------------------------------------------

async function vatReturnsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /vat-returns — list VAT returns with status filter (AC-1)
  fastify.get<{ Querystring: ListVatReturnsQuery }>(
    '/vat-returns',
    {
      schema: {
        querystring: listVatReturnsQuerySchema,
      },
      preHandler: createPermissionGuard('finance.vatReturns', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listVatReturns(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /vat-returns/:id — VAT return detail with all 9 boxes (AC-4)
  fastify.get<{ Params: { id: string } }>(
    '/vat-returns/:id',
    {
      schema: {
        params: vatReturnParamsSchema,
        response: { 200: vatReturnDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.vatReturns', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getVatReturnById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /vat-returns — create a new draft VAT return for a period range (AC-2)
  fastify.post(
    '/vat-returns',
    {
      schema: {
        body: createVatReturnSchema,
        response: { 201: vatReturnDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.vatReturns', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createVatReturn(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof createVatReturnSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // POST /vat-returns/:id/calculate — populate 9 boxes from journal data (AC-3)
  fastify.post<{ Params: { id: string } }>(
    '/vat-returns/:id/calculate',
    {
      schema: {
        params: vatReturnParamsSchema,
        response: { 200: vatReturnDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.vatReturns', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await calculateVatReturn(prisma, ctx.companyId, request.params.id);
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof AppError && error.code === 'INVALID_STATUS') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );
}

export const vatReturnsRoutesPlugin = vatReturnsRoutes;
