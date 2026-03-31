import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import { yearEndCloseSchema, yearEndResultSchema } from './year-end.schema.js';
import { performYearEndClose } from './year-end.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const yearEndEnvelope = successEnvelope(yearEndResultSchema);

// ---------------------------------------------------------------------------
// Year-End Close routes plugin
// ---------------------------------------------------------------------------

async function yearEndRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /year-end/close — Trigger year-end close for a fiscal year (AC-1)
  fastify.post(
    '/year-end/close',
    {
      schema: {
        body: yearEndCloseSchema,
        response: { 200: yearEndEnvelope },
      },
      preHandler: createPermissionGuard('finance.periods', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const body = request.body as { fiscalYear: number };

      const result = await performYearEndClose(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        body.fiscalYear,
        ctx.userId,
      );

      return sendSuccess(reply, result);
    },
  );
}

export const yearEndRoutesPlugin = yearEndRoutes;
