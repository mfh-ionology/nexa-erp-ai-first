import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  startMonthEndSchema,
  monthEndPeriodParamsSchema,
  completeStepSchema,
  monthEndChecklistSchema,
} from './month-end.schema.js';
import {
  startMonthEnd,
  getMonthEndChecklist,
  completeStep,
  closeMonthEnd,
} from './month-end.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError, DomainError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const checklistEnvelope = successEnvelope(monthEndChecklistSchema);

// ---------------------------------------------------------------------------
// Month-End Close routes plugin
// ---------------------------------------------------------------------------

async function monthEndRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /month-end/start — Initiate month-end close for a period (AC-1)
  fastify.post(
    '/month-end/start',
    {
      schema: {
        body: startMonthEndSchema,
        response: { 201: checklistEnvelope },
      },
      preHandler: createPermissionGuard('finance.periods', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const body = request.body as z.infer<typeof startMonthEndSchema>;
      try {
        const result = await startMonthEnd(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          body.periodId,
          ctx.userId,
        );
        return sendSuccess(reply, result, undefined, 201);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'PERIOD_NOT_OPEN') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // GET /month-end/:periodId — Get checklist with completion status (AC-2)
  fastify.get<{ Params: { periodId: string } }>(
    '/month-end/:periodId',
    {
      schema: {
        params: monthEndPeriodParamsSchema,
        response: { 200: checklistEnvelope },
      },
      preHandler: createPermissionGuard('finance.periods', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getMonthEndChecklist(prisma, ctx.companyId, request.params.periodId);
      return sendSuccess(reply, result);
    },
  );

  // POST /month-end/:periodId/complete-step — Mark a step as done (AC-4)
  fastify.post<{ Params: { periodId: string } }>(
    '/month-end/:periodId/complete-step',
    {
      schema: {
        params: monthEndPeriodParamsSchema,
        body: completeStepSchema,
        response: { 200: checklistEnvelope },
      },
      preHandler: createPermissionGuard('finance.periods', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const body = request.body as z.infer<typeof completeStepSchema>;
      try {
        const result = await completeStep(
          prisma,
          ctx.companyId,
          request.params.periodId,
          body.stepCode,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof DomainError && ['STEP_AUTO_CHECKED'].includes(error.code)) {
          throw new AppError(error.code, error.message, 422);
        }
        throw error;
      }
    },
  );

  // POST /month-end/:periodId/close — Close the period (AC-5)
  fastify.post<{ Params: { periodId: string } }>(
    '/month-end/:periodId/close',
    {
      schema: {
        params: monthEndPeriodParamsSchema,
        response: { 200: checklistEnvelope },
      },
      preHandler: createPermissionGuard('finance.periods', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await closeMonthEnd(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.periodId,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (
          error instanceof DomainError &&
          ['STEPS_INCOMPLETE', 'INVALID_STATUS_TRANSITION'].includes(error.code)
        ) {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );
}

export const monthEndRoutesPlugin = monthEndRoutes;
