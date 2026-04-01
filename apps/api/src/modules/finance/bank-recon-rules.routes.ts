import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createRuleSchema,
  updateRuleSchema,
  listRulesQuerySchema,
  ruleParamsSchema,
  ruleResponseSchema,
  applyRulesParamsSchema,
  ruleSuggestionSchema,
  createJournalFromRuleSchema,
  createJournalFromRuleParamsSchema,
} from './bank-recon-rules.schema.js';
import type { ListRulesQuery, CreateJournalFromRuleInput } from './bank-recon-rules.schema.js';
import {
  listRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  matchRulesToTransactions,
  createJournalFromRule,
} from './bank-recon-rules.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const ruleEnvelope = successEnvelope(ruleResponseSchema);
const suggestionsEnvelope = successEnvelope(z.array(ruleSuggestionSchema));

// ---------------------------------------------------------------------------
// Bank Reconciliation Rules routes plugin
// ---------------------------------------------------------------------------

async function bankReconRulesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /bank-recon-rules — list rules
  fastify.get<{ Querystring: ListRulesQuery }>(
    '/bank-recon-rules',
    {
      schema: {
        querystring: listRulesQuerySchema,
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listRules(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /bank-recon-rules/:id — get rule detail
  fastify.get<{ Params: { id: string } }>(
    '/bank-recon-rules/:id',
    {
      schema: {
        params: ruleParamsSchema,
        response: { 200: ruleEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getRuleById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /bank-recon-rules — create rule
  fastify.post(
    '/bank-recon-rules',
    {
      schema: {
        body: createRuleSchema,
        response: { 201: ruleEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createRule(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof createRuleSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /bank-recon-rules/:id — update rule
  fastify.patch<{ Params: { id: string } }>(
    '/bank-recon-rules/:id',
    {
      schema: {
        params: ruleParamsSchema,
        body: updateRuleSchema,
        response: { 200: ruleEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateRule(
        prisma,
        ctx.companyId,
        request.params.id,
        request.body as z.infer<typeof updateRuleSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );

  // DELETE /bank-recon-rules/:id — delete rule
  fastify.delete<{ Params: { id: string } }>(
    '/bank-recon-rules/:id',
    {
      schema: {
        params: ruleParamsSchema,
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'delete'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await deleteRule(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, { success: true });
    },
  );

  // POST /bank-accounts/:id/apply-rules — run matchRulesToTransactions
  fastify.post<{ Params: { id: string } }>(
    '/bank-accounts/:id/apply-rules',
    {
      schema: {
        params: applyRulesParamsSchema,
        response: { 200: suggestionsEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const suggestions = await matchRulesToTransactions(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, suggestions);
    },
  );

  // POST /bank-accounts/:id/create-journal-from-rule — create journal from rule match
  fastify.post<{ Params: { id: string } }>(
    '/bank-accounts/:id/create-journal-from-rule',
    {
      schema: {
        params: createJournalFromRuleParamsSchema,
        body: createJournalFromRuleSchema,
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createJournalFromRule(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        request.params.id,
        request.body as CreateJournalFromRuleInput,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );
}

export const bankReconRulesRoutesPlugin = bankReconRulesRoutes;
