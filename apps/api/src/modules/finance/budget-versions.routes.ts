import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createBudgetVersionSchema,
  updateBudgetVersionSchema,
  listBudgetVersionsQuerySchema,
  budgetVersionParamsSchema,
  budgetVersionDetailSchema,
  budgetVersionListItemSchema,
} from './budget-versions.schema.js';
import type { ListBudgetVersionsQuery } from './budget-versions.schema.js';
import {
  listBudgetVersions,
  getBudgetVersionById,
  createBudgetVersion,
  updateBudgetVersion,
} from './budget-versions.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const budgetVersionDetailEnvelope = successEnvelope(budgetVersionDetailSchema);

// ---------------------------------------------------------------------------
// Budget Versions routes plugin
// ---------------------------------------------------------------------------

async function budgetVersionsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /budget-versions — list budget versions with optional fiscal year filter
  fastify.get<{ Querystring: ListBudgetVersionsQuery }>(
    '/budget-versions',
    {
      schema: {
        querystring: listBudgetVersionsQuerySchema,
      },
      preHandler: createPermissionGuard('finance.budgets', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listBudgetVersions(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /budget-versions/:id — budget version detail with copiedFromVersion
  fastify.get<{ Params: { id: string } }>(
    '/budget-versions/:id',
    {
      schema: {
        params: budgetVersionParamsSchema,
        response: { 200: budgetVersionDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getBudgetVersionById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /budget-versions — create budget version with auto-assigned version number
  fastify.post(
    '/budget-versions',
    {
      schema: {
        body: createBudgetVersionSchema,
        response: { 201: budgetVersionDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createBudgetVersion(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof createBudgetVersionSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /budget-versions/:id — update versionName or isActive
  fastify.patch<{ Params: { id: string } }>(
    '/budget-versions/:id',
    {
      schema: {
        params: budgetVersionParamsSchema,
        body: updateBudgetVersionSchema,
        response: { 200: budgetVersionDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateBudgetVersion(
        prisma,
        ctx.companyId,
        request.params.id,
        request.body as z.infer<typeof updateBudgetVersionSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );
}

export const budgetVersionsRoutesPlugin = budgetVersionsRoutes;
