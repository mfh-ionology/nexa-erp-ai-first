import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  setMandatoryDimensionsSchema,
  bulkAssignMandatoryDimensionsSchema,
  accountIdParamsSchema,
} from './account-mandatory-dimensions.schema.js';
import {
  listMandatoryDimensionsByAccount,
  setMandatoryDimensions,
  bulkAssignMandatoryDimensions,
} from './account-mandatory-dimensions.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// AccountMandatoryDimension routes plugin
// ---------------------------------------------------------------------------

async function accountMandatoryDimensionsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /accounts/:id/mandatory-dimensions — list mandatory dimension types for one account
  fastify.get<{ Params: { id: string } }>(
    '/accounts/:id/mandatory-dimensions',
    {
      schema: {
        params: accountIdParamsSchema,
      },
      preHandler: createPermissionGuard('finance.accounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const data = await listMandatoryDimensionsByAccount(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, data);
    },
  );

  // PUT /accounts/:id/mandatory-dimensions — replace all mandatory dimension types for one account
  fastify.put<{ Params: { id: string } }>(
    '/accounts/:id/mandatory-dimensions',
    {
      schema: {
        params: accountIdParamsSchema,
        body: setMandatoryDimensionsSchema,
      },
      preHandler: createPermissionGuard('finance.accounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const body = request.body as z.infer<typeof setMandatoryDimensionsSchema>;
      const data = await setMandatoryDimensions(
        prisma,
        ctx.companyId,
        request.params.id,
        body.dimensionTypeIds,
      );
      return sendSuccess(reply, data);
    },
  );

  // POST /mandatory-dimensions/bulk-assign — bulk assign dimension types to multiple accounts
  fastify.post(
    '/mandatory-dimensions/bulk-assign',
    {
      schema: {
        body: bulkAssignMandatoryDimensionsSchema,
      },
      preHandler: createPermissionGuard('finance.dimensions', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const body = request.body as z.infer<typeof bulkAssignMandatoryDimensionsSchema>;
      const result = await bulkAssignMandatoryDimensions(
        prisma,
        ctx.companyId,
        body.dimensionTypeIds,
        body.accountIds,
        body.accountRange,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );
}

export const accountMandatoryDimensionsRoutesPlugin = accountMandatoryDimensionsRoutes;
