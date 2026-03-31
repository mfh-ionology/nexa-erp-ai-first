import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createBudgetSchema,
  updateBudgetSchema,
  listBudgetsQuerySchema,
  searchBudgetsQuerySchema,
  budgetParamsSchema,
  budgetDetailSchema,
  budgetListItemSchema,
} from './budgets.schema.js';
import type { ListBudgetsQuery, SearchBudgetsQuery } from './budgets.schema.js';
import {
  listBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  approveBudget,
  copyBudget,
  searchBudgets,
} from './budgets.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError, DomainError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const budgetDetailEnvelope = successEnvelope(budgetDetailSchema);

const budgetSearchEnvelope = z.object({
  success: z.literal(true),
  data: z.array(budgetListItemSchema),
});

// ---------------------------------------------------------------------------
// Budget routes plugin
// ---------------------------------------------------------------------------

async function budgetsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /budgets/search — text search on name (AC-7)
  // Registered BEFORE /:id to avoid path conflict
  fastify.get<{ Querystring: SearchBudgetsQuery }>(
    '/budgets/search',
    {
      schema: {
        querystring: searchBudgetsQuerySchema,
        response: { 200: budgetSearchEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const data = await searchBudgets(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, data);
    },
  );

  // GET /budgets — list budgets with status and fiscal year (AC-1)
  fastify.get<{ Querystring: ListBudgetsQuery }>(
    '/budgets',
    {
      schema: {
        querystring: listBudgetsQuerySchema,
      },
      preHandler: createPermissionGuard('finance.budgets', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listBudgets(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /budgets/:id — budget detail with all lines (AC-2)
  fastify.get<{ Params: { id: string } }>(
    '/budgets/:id',
    {
      schema: {
        params: budgetParamsSchema,
        response: { 200: budgetDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getBudgetById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /budgets — create budget with lines (AC-3)
  fastify.post(
    '/budgets',
    {
      schema: {
        body: createBudgetSchema,
        response: { 201: budgetDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createBudget(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof createBudgetSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /budgets/:id — update budget (only DRAFT status) (AC-4)
  fastify.patch<{ Params: { id: string } }>(
    '/budgets/:id',
    {
      schema: {
        params: budgetParamsSchema,
        body: updateBudgetSchema,
        response: { 200: budgetDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await updateBudget(
          prisma,
          ctx.companyId,
          request.params.id,
          request.body as z.infer<typeof updateBudgetSchema>,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'BUDGET_NOT_DRAFT') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // POST /budgets/:id/approve — transition DRAFT → APPROVED (AC-5)
  fastify.post<{ Params: { id: string } }>(
    '/budgets/:id/approve',
    {
      schema: {
        params: budgetParamsSchema,
        response: { 200: budgetDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await approveBudget(prisma, ctx.companyId, request.params.id, ctx.userId);
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'BUDGET_NOT_DRAFT') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // POST /budgets/:id/copy — create revised budget linked to original (AC-6, BR-FIN-019)
  fastify.post<{ Params: { id: string } }>(
    '/budgets/:id/copy',
    {
      schema: {
        params: budgetParamsSchema,
        response: { 201: budgetDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await copyBudget(prisma, ctx.companyId, request.params.id, ctx.userId);
      return sendSuccess(reply, result, undefined, 201);
    },
  );
}

export const budgetsRoutesPlugin = budgetsRoutes;
