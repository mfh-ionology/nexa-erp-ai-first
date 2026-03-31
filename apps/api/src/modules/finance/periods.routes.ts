import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createFiscalYearSchema,
  periodParamsSchema,
  listPeriodsQuerySchema,
  periodSchema,
  fiscalYearGroupSchema,
} from './periods.schema.js';
import type { ListPeriodsQuery } from './periods.schema.js';
import {
  createFiscalYear,
  listPeriods,
  closePeriod,
  reopenPeriod,
  lockPeriod,
} from './periods.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError, DomainError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const periodsListEnvelope = successEnvelope(z.array(fiscalYearGroupSchema));
const periodDetailEnvelope = successEnvelope(periodSchema);
const periodsCreatedEnvelope = successEnvelope(z.array(periodSchema));

// ---------------------------------------------------------------------------
// Financial Periods routes plugin
// ---------------------------------------------------------------------------

async function periodsRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /periods/year — Create fiscal year periods (AC-1)
  fastify.post(
    '/periods/year',
    {
      schema: {
        body: createFiscalYearSchema,
        response: { 201: periodsCreatedEnvelope },
      },
      preHandler: createPermissionGuard('finance.periods', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const body = request.body as z.infer<typeof createFiscalYearSchema>;
      const result = await createFiscalYear(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        body.fiscalYear,
        body.includeP13,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // GET /periods — List periods grouped by fiscal year (AC-2)
  fastify.get<{ Querystring: ListPeriodsQuery }>(
    '/periods',
    {
      schema: {
        querystring: listPeriodsQuerySchema,
        response: { 200: periodsListEnvelope },
      },
      preHandler: createPermissionGuard('finance.periods', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await listPeriods(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, result);
    },
  );

  // POST /periods/:id/close — Close an OPEN period (AC-3)
  fastify.post<{ Params: { id: string } }>(
    '/periods/:id/close',
    {
      schema: {
        params: periodParamsSchema,
        response: { 200: periodDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.periods', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await closePeriod(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'INVALID_STATUS_TRANSITION') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // POST /periods/:id/reopen — Reopen a CLOSED period (AC-4)
  fastify.post<{ Params: { id: string } }>(
    '/periods/:id/reopen',
    {
      schema: {
        params: periodParamsSchema,
        response: { 200: periodDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.periods', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await reopenPeriod(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (
          error instanceof DomainError &&
          ['PERIOD_LOCKED', 'INVALID_STATUS_TRANSITION'].includes(error.code)
        ) {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // POST /periods/:id/lock — Lock a CLOSED period (AC-5, BR-FIN-016)
  fastify.post<{ Params: { id: string } }>(
    '/periods/:id/lock',
    {
      schema: {
        params: periodParamsSchema,
        response: { 200: periodDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.periods', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await lockPeriod(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (
          error instanceof DomainError &&
          ['PERIOD_ALREADY_LOCKED', 'CANNOT_LOCK_OPEN_PERIOD'].includes(error.code)
        ) {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );
}

export const periodsRoutesPlugin = periodsRoutes;
