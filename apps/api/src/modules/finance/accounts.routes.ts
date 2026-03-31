import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createAccountSchema,
  updateAccountSchema,
  listAccountsQuerySchema,
  searchAccountsQuerySchema,
  accountParamsSchema,
  accountDetailSchema,
  accountListItemSchema,
} from './accounts.schema.js';
import type { ListAccountsQuery, SearchAccountsQuery } from './accounts.schema.js';
import {
  listAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  searchAccounts,
} from './accounts.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError, DomainError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const accountDetailEnvelope = successEnvelope(accountDetailSchema);

const accountSearchEnvelope = z.object({
  success: z.literal(true),
  data: z.array(accountListItemSchema),
});

// ---------------------------------------------------------------------------
// Chart of Accounts routes plugin
// ---------------------------------------------------------------------------

async function accountsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /accounts/search — text search on code and name (AC-5)
  // Registered BEFORE /:id to avoid path conflict
  fastify.get<{ Querystring: SearchAccountsQuery }>(
    '/accounts/search',
    {
      schema: {
        querystring: searchAccountsQuerySchema,
        response: { 200: accountSearchEnvelope },
      },
      preHandler: createPermissionGuard('finance.accounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const data = await searchAccounts(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, data);
    },
  );

  // GET /accounts — list accounts with pagination and filters (AC-1)
  fastify.get<{ Querystring: ListAccountsQuery }>(
    '/accounts',
    {
      schema: {
        querystring: listAccountsQuerySchema,
        // Response schema varies based on ?tree=true query; use union approach
        // We use the flat list envelope by default; tree uses its own envelope
      },
      preHandler: createPermissionGuard('finance.accounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listAccounts(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /accounts/:id — account detail with classification, balances, children (AC-2)
  fastify.get<{ Params: { id: string } }>(
    '/accounts/:id',
    {
      schema: {
        params: accountParamsSchema,
        response: { 200: accountDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.accounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getAccountById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /accounts — create account (AC-3)
  fastify.post(
    '/accounts',
    {
      schema: {
        body: createAccountSchema,
        response: { 201: accountDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.accounts', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createAccount(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        request.body as z.infer<typeof createAccountSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /accounts/:id — update account (AC-4, AC-6, AC-7)
  fastify.patch<{ Params: { id: string } }>(
    '/accounts/:id',
    {
      schema: {
        params: accountParamsSchema,
        body: updateAccountSchema,
        response: { 200: accountDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.accounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await updateAccount(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          request.body as z.infer<typeof updateAccountSchema>,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (
          error instanceof DomainError &&
          ['SYSTEM_ACCOUNT_PROTECTED', 'ACCOUNT_HAS_POSTINGS'].includes(error.code)
        ) {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );
}

export const accountsRoutesPlugin = accountsRoutes;
