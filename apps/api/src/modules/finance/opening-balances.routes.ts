import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import {
  importCsvBodySchema,
  importManualBodySchema,
  openingBalanceResultSchema,
} from './opening-balances.schema.js';
import type { ImportCsvBody, ImportManualBody } from './opening-balances.schema.js';
import { parseOpeningBalancesCsv, importOpeningBalances } from './opening-balances.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const openingBalanceResultEnvelope = successEnvelope(openingBalanceResultSchema);

// ---------------------------------------------------------------------------
// Opening Balances routes plugin
// ---------------------------------------------------------------------------

async function openingBalancesRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /opening-balances/import — AC-1: CSV import
  fastify.post<{ Body: ImportCsvBody }>(
    '/opening-balances/import',
    {
      schema: {
        body: importCsvBodySchema,
        response: { 200: openingBalanceResultEnvelope },
      },
      preHandler: createPermissionGuard('finance.accounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);

      // Parse CSV into lines
      const lines = parseOpeningBalancesCsv(request.body.csv);

      const result = await importOpeningBalances(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        ctx.userId,
        lines,
        request.body.transactionDate,
        request.body.description,
      );

      return sendSuccess(reply, result);
    },
  );

  // POST /opening-balances/manual — AC-2: Manual entry
  fastify.post<{ Body: ImportManualBody }>(
    '/opening-balances/manual',
    {
      schema: {
        body: importManualBodySchema,
        response: { 200: openingBalanceResultEnvelope },
      },
      preHandler: createPermissionGuard('finance.accounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);

      const result = await importOpeningBalances(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        ctx.userId,
        request.body.lines,
        request.body.transactionDate,
        request.body.description,
      );

      return sendSuccess(reply, result);
    },
  );
}

export const openingBalancesRoutesPlugin = openingBalancesRoutes;
