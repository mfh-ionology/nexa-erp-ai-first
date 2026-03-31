import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createBankAccountSchema,
  updateBankAccountSchema,
  listBankAccountsQuerySchema,
  searchBankAccountsQuerySchema,
  bankAccountParamsSchema,
  bankAccountDetailSchema,
  bankAccountListItemSchema,
} from './bank-accounts.schema.js';
import type { ListBankAccountsQuery, SearchBankAccountsQuery } from './bank-accounts.schema.js';
import {
  listBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  searchBankAccounts,
} from './bank-accounts.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const bankAccountDetailEnvelope = successEnvelope(bankAccountDetailSchema);

const bankAccountSearchEnvelope = z.object({
  success: z.literal(true),
  data: z.array(bankAccountListItemSchema),
});

// ---------------------------------------------------------------------------
// Bank Accounts routes plugin
// ---------------------------------------------------------------------------

async function bankAccountsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /bank-accounts/search — text search on name, sort code, account number, GL code
  // Registered BEFORE /:id to avoid path conflict
  fastify.get<{ Querystring: SearchBankAccountsQuery }>(
    '/bank-accounts/search',
    {
      schema: {
        querystring: searchBankAccountsQuerySchema,
        response: { 200: bankAccountSearchEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const data = await searchBankAccounts(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, data);
    },
  );

  // GET /bank-accounts — list bank accounts with pagination and filters (AC-1)
  fastify.get<{ Querystring: ListBankAccountsQuery }>(
    '/bank-accounts',
    {
      schema: {
        querystring: listBankAccountsQuerySchema,
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listBankAccounts(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /bank-accounts/:id — bank account detail with GL account summary (AC-1, AC-3)
  fastify.get<{ Params: { id: string } }>(
    '/bank-accounts/:id',
    {
      schema: {
        params: bankAccountParamsSchema,
        response: { 200: bankAccountDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getBankAccountById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /bank-accounts — create bank account (AC-1, AC-2)
  fastify.post(
    '/bank-accounts',
    {
      schema: {
        body: createBankAccountSchema,
        response: { 201: bankAccountDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createBankAccount(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof createBankAccountSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /bank-accounts/:id — update bank account (AC-1, AC-2)
  fastify.patch<{ Params: { id: string } }>(
    '/bank-accounts/:id',
    {
      schema: {
        params: bankAccountParamsSchema,
        body: updateBankAccountSchema,
        response: { 200: bankAccountDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateBankAccount(
        prisma,
        ctx.companyId,
        request.params.id,
        request.body as z.infer<typeof updateBankAccountSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );
}

export const bankAccountsRoutesPlugin = bankAccountsRoutes;
