import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import { dashboardQuerySchema, dashboardResponseSchema } from './dashboard.schema.js';
import type { DashboardQuery } from './dashboard.schema.js';
import { getDashboard } from './dashboard.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

const dashboardEnvelope = successEnvelope(dashboardResponseSchema);

// ---------------------------------------------------------------------------
// Finance Dashboard routes plugin
// ---------------------------------------------------------------------------

async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /dashboard — aggregated financial metrics (AC-1, AC-2, AC-3)
  fastify.get<{ Querystring: DashboardQuery }>(
    '/dashboard',
    {
      schema: {
        querystring: dashboardQuerySchema,
        response: { 200: dashboardEnvelope },
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getDashboard(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, result);
    },
  );
}

export const dashboardRoutesPlugin = dashboardRoutes;
