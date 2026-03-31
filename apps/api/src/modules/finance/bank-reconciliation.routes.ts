import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createReconciliationSchema,
  createMatchSchema,
  bankAccountParamsSchema,
  reconciliationParamsSchema,
  matchBankAccountParamsSchema,
  bankTransactionParamsSchema,
  listReconciliationsQuerySchema,
  reconciliationListItemSchema,
  reconciliationDetailSchema,
  matchResponseSchema,
} from './bank-reconciliation.schema.js';
import type { ListReconciliationsQuery } from './bank-reconciliation.schema.js';
import {
  createReconciliation,
  getReconciliationById,
  listReconciliations,
  createMatch,
  unmatchTransaction,
  completeReconciliation,
} from './bank-reconciliation.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const reconciliationDetailEnvelope = successEnvelope(reconciliationDetailSchema);
const reconciliationListItemEnvelope = successEnvelope(reconciliationListItemSchema);
const matchEnvelope = successEnvelope(matchResponseSchema);

// ---------------------------------------------------------------------------
// Bank Reconciliation routes plugin
// ---------------------------------------------------------------------------

async function bankReconciliationRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /bank-accounts/:bankAccountId/reconciliations — create reconciliation session (AC-1)
  fastify.post<{ Params: { bankAccountId: string } }>(
    '/bank-accounts/:bankAccountId/reconciliations',
    {
      schema: {
        params: bankAccountParamsSchema,
        body: createReconciliationSchema,
        response: { 201: reconciliationListItemEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createReconciliation(
        prisma,
        ctx.companyId,
        request.params.bankAccountId,
        request.body as z.infer<typeof createReconciliationSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // GET /bank-accounts/:bankAccountId/reconciliations — list reconciliations (AC-6)
  fastify.get<{ Params: { bankAccountId: string }; Querystring: ListReconciliationsQuery }>(
    '/bank-accounts/:bankAccountId/reconciliations',
    {
      schema: {
        params: bankAccountParamsSchema,
        querystring: listReconciliationsQuerySchema,
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listReconciliations(
        prisma,
        ctx.companyId,
        request.params.bankAccountId,
        request.query,
      );
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /bank-accounts/:bankAccountId/reconciliations/:id — reconciliation detail (AC-2)
  fastify.get<{ Params: { bankAccountId: string; id: string } }>(
    '/bank-accounts/:bankAccountId/reconciliations/:id',
    {
      schema: {
        params: reconciliationParamsSchema,
        response: { 200: reconciliationDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getReconciliationById(
        prisma,
        ctx.companyId,
        request.params.bankAccountId,
        request.params.id,
      );
      return sendSuccess(reply, result);
    },
  );

  // POST /bank-accounts/:bankAccountId/reconciliations/:id/complete — complete reconciliation (AC-5)
  fastify.post<{ Params: { bankAccountId: string; id: string } }>(
    '/bank-accounts/:bankAccountId/reconciliations/:id/complete',
    {
      schema: {
        params: reconciliationParamsSchema,
        response: { 200: reconciliationListItemEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await completeReconciliation(
        prisma,
        ctx.companyId,
        request.params.bankAccountId,
        request.params.id,
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );

  // POST /bank-accounts/:id/match — create manual match (AC-3)
  fastify.post<{ Params: { id: string } }>(
    '/bank-accounts/:id/match',
    {
      schema: {
        params: matchBankAccountParamsSchema,
        body: createMatchSchema,
        response: { 201: matchEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createMatch(
        prisma,
        ctx.companyId,
        request.params.id,
        request.body as z.infer<typeof createMatchSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // POST /bank-transactions/:id/unmatch — remove a match (AC-4)
  fastify.post<{ Params: { id: string } }>(
    '/bank-transactions/:id/unmatch',
    {
      schema: {
        params: bankTransactionParamsSchema,
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await unmatchTransaction(prisma, ctx.companyId, request.params.id, ctx.userId);
      return sendSuccess(reply, result);
    },
  );
}

export const bankReconciliationRoutesPlugin = bankReconciliationRoutes;
