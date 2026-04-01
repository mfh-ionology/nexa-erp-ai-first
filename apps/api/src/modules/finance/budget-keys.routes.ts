import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createBudgetKeySchema,
  updateBudgetKeySchema,
  applyBudgetKeySchema,
  listBudgetKeysQuerySchema,
  budgetKeyParamsSchema,
  budgetKeyItemSchema,
  applyBudgetKeyResultSchema,
} from './budget-keys.schema.js';
import type { ListBudgetKeysQuery } from './budget-keys.schema.js';
import {
  listBudgetKeys,
  getBudgetKeyById,
  createBudgetKey,
  updateBudgetKey,
  deleteBudgetKey,
  applyBudgetKey,
} from './budget-keys.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const budgetKeyItemEnvelope = successEnvelope(budgetKeyItemSchema);
const applyResultEnvelope = successEnvelope(applyBudgetKeyResultSchema);

// ---------------------------------------------------------------------------
// Budget Keys routes plugin
// ---------------------------------------------------------------------------

async function budgetKeysRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /budget-keys — list budget keys with optional isActive filter
  fastify.get<{ Querystring: ListBudgetKeysQuery }>(
    '/budget-keys',
    {
      schema: {
        querystring: listBudgetKeysQuerySchema,
      },
      preHandler: createPermissionGuard('finance.budgets', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listBudgetKeys(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /budget-keys/:id — budget key detail
  fastify.get<{ Params: { id: string } }>(
    '/budget-keys/:id',
    {
      schema: {
        params: budgetKeyParamsSchema,
        response: { 200: budgetKeyItemEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getBudgetKeyById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /budget-keys — create budget key
  fastify.post(
    '/budget-keys',
    {
      schema: {
        body: createBudgetKeySchema,
        response: { 201: budgetKeyItemEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createBudgetKey(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof createBudgetKeySchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /budget-keys/:id — update budget key
  fastify.patch<{ Params: { id: string } }>(
    '/budget-keys/:id',
    {
      schema: {
        params: budgetKeyParamsSchema,
        body: updateBudgetKeySchema,
        response: { 200: budgetKeyItemEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateBudgetKey(
        prisma,
        ctx.companyId,
        request.params.id,
        request.body as z.infer<typeof updateBudgetKeySchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );

  // DELETE /budget-keys/:id — hard delete budget key
  fastify.delete<{ Params: { id: string } }>(
    '/budget-keys/:id',
    {
      schema: {
        params: budgetKeyParamsSchema,
      },
      preHandler: createPermissionGuard('finance.budgets', 'delete'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await deleteBudgetKey(prisma, ctx.companyId, request.params.id);
      return reply.status(204).send();
    },
  );

  // POST /budget-keys/:id/apply — calculate period amounts from annual total
  fastify.post<{ Params: { id: string } }>(
    '/budget-keys/:id/apply',
    {
      schema: {
        params: budgetKeyParamsSchema,
        body: applyBudgetKeySchema,
        response: { 200: applyResultEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const body = request.body as z.infer<typeof applyBudgetKeySchema>;
      const result = await applyBudgetKey(
        prisma,
        ctx.companyId,
        request.params.id,
        body.annualAmount,
      );
      return sendSuccess(reply, result);
    },
  );
}

export const budgetKeysRoutesPlugin = budgetKeysRoutes;
