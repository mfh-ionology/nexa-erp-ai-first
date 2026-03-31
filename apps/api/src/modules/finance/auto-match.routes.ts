import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import { autoMatchBankTransactions } from './auto-match.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const bankAccountIdParamsSchema = z.object({
  id: z.uuid(),
});

const autoMatchResultSchema = z.object({
  total: z.number(),
  autoMatched: z.number(),
  suggested: z.number(),
  unmatched: z.number(),
  matches: z.array(
    z.object({
      bankTransactionId: z.uuid(),
      journalLineId: z.string().nullable(),
      matchType: z.string(),
      confidence: z.number(),
    }),
  ),
});

const autoMatchEnvelope = successEnvelope(autoMatchResultSchema);

// ---------------------------------------------------------------------------
// Auto-match routes plugin
// ---------------------------------------------------------------------------

async function autoMatchRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /bank-accounts/:id/auto-match — trigger AI auto-matching (AC-1)
  fastify.post<{ Params: { id: string } }>(
    '/bank-accounts/:id/auto-match',
    {
      schema: {
        params: bankAccountIdParamsSchema,
        response: { 200: autoMatchEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await autoMatchBankTransactions(
        prisma,
        ctx.companyId,
        request.params.id,
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );
}

export const autoMatchRoutesPlugin = autoMatchRoutes;
