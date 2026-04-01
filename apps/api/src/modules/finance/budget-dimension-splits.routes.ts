import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  putDimensionSplitsSchema,
  budgetLineSplitParamsSchema,
  deleteSplitParamsSchema,
  listSplitsQuerySchema,
  budgetLineDimensionSchema,
} from './budget-dimension-splits.schema.js';
import type {
  ListSplitsQuery,
  BudgetLineSplitParams,
  DeleteSplitParams,
} from './budget-dimension-splits.schema.js';
import {
  listDimensionSplits,
  putDimensionSplits,
  deleteDimensionSplits,
} from './budget-dimension-splits.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError, DomainError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const splitsListEnvelope = z.object({
  success: z.literal(true),
  data: z.array(budgetLineDimensionSchema),
});

// ---------------------------------------------------------------------------
// Budget Dimension Splits routes plugin
// ---------------------------------------------------------------------------

async function budgetDimensionSplitsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /budgets/:budgetId/lines/:lineId/dimension-splits — list splits for a line
  fastify.get<{ Params: BudgetLineSplitParams; Querystring: ListSplitsQuery }>(
    '/budgets/:budgetId/lines/:lineId/dimension-splits',
    {
      schema: {
        params: budgetLineSplitParamsSchema,
        querystring: listSplitsQuerySchema,
        response: { 200: splitsListEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { budgetId, lineId } = request.params;
      const result = await listDimensionSplits(
        prisma,
        ctx.companyId,
        budgetId,
        lineId,
        request.query,
      );
      return sendSuccess(reply, result);
    },
  );

  // PUT /budgets/:budgetId/lines/:lineId/dimension-splits — replace splits for line + dim type
  fastify.put<{ Params: BudgetLineSplitParams }>(
    '/budgets/:budgetId/lines/:lineId/dimension-splits',
    {
      schema: {
        params: budgetLineSplitParamsSchema,
        body: putDimensionSplitsSchema,
        response: { 200: splitsListEnvelope },
      },
      preHandler: createPermissionGuard('finance.budgets', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { budgetId, lineId } = request.params;
      try {
        const result = await putDimensionSplits(
          prisma,
          ctx.companyId,
          budgetId,
          lineId,
          request.body as z.infer<typeof putDimensionSplitsSchema>,
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

  // DELETE /budgets/:budgetId/lines/:lineId/dimension-splits/:dimensionTypeId
  fastify.delete<{ Params: DeleteSplitParams }>(
    '/budgets/:budgetId/lines/:lineId/dimension-splits/:dimensionTypeId',
    {
      schema: {
        params: deleteSplitParamsSchema,
      },
      preHandler: createPermissionGuard('finance.budgets', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { budgetId, lineId, dimensionTypeId } = request.params;
      try {
        await deleteDimensionSplits(prisma, ctx.companyId, budgetId, lineId, dimensionTypeId);
        return reply.status(204).send();
      } catch (error) {
        if (error instanceof DomainError && error.code === 'BUDGET_NOT_DRAFT') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );
}

export const budgetDimensionSplitsRoutesPlugin = budgetDimensionSplitsRoutes;
