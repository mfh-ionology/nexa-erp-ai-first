import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import {
  bankImportParamsSchema,
  bankImportBodySchema,
  bankImportResultSchema,
} from './bank-import.schema.js';
import type { BankImportParams, BankImportBody } from './bank-import.schema.js';
import { importBankStatement } from './bank-import.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const bankImportResultEnvelope = successEnvelope(bankImportResultSchema);

// ---------------------------------------------------------------------------
// Bank Import routes plugin
// ---------------------------------------------------------------------------

async function bankImportRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /bank-accounts/:id/import — import bank statement (CSV/OFX/QIF)
  fastify.post<{ Params: BankImportParams; Body: BankImportBody }>(
    '/bank-accounts/:id/import',
    {
      schema: {
        params: bankImportParamsSchema,
        body: bankImportBodySchema,
        response: { 200: bankImportResultEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await importBankStatement(
        prisma,
        ctx.companyId,
        request.params.id,
        request.body.content,
        request.body.format,
      );
      return sendSuccess(reply, result);
    },
  );
}

export const bankImportRoutesPlugin = bankImportRoutes;
