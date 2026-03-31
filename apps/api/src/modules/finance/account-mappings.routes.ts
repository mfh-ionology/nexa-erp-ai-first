import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import {
  accountMappingsListSchema,
  batchUpdateAccountMappingsSchema,
} from './account-mappings.schema.js';
import type { BatchUpdateAccountMappingsInput } from './account-mappings.schema.js';
import {
  listAccountMappings,
  batchUpdateAccountMappings,
  resetAccountMappings,
} from './account-mappings.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const accountMappingsEnvelope = successEnvelope(accountMappingsListSchema);

// ---------------------------------------------------------------------------
// Account Mappings routes plugin
// ---------------------------------------------------------------------------

async function accountMappingsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /account-mappings — return all 27 mapping types with current GL account assignments (AC-1)
  fastify.get(
    '/account-mappings',
    {
      schema: {
        response: { 200: accountMappingsEnvelope },
      },
      preHandler: createPermissionGuard('finance.accountMappings', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const mappings = await listAccountMappings(prisma, ctx.companyId);
      return sendSuccess(reply, mappings);
    },
  );

  // PUT /account-mappings — batch update mappings (AC-2)
  fastify.put<{ Body: BatchUpdateAccountMappingsInput }>(
    '/account-mappings',
    {
      schema: {
        body: batchUpdateAccountMappingsSchema,
        response: { 200: accountMappingsEnvelope },
      },
      preHandler: createPermissionGuard('finance.accountMappings', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const updated = await batchUpdateAccountMappings(prisma, ctx.companyId, request.body);
      return sendSuccess(reply, updated);
    },
  );

  // POST /account-mappings/reset — restore FRS 102 default accounts (AC-3)
  fastify.post(
    '/account-mappings/reset',
    {
      schema: {
        response: { 200: accountMappingsEnvelope },
      },
      preHandler: createPermissionGuard('finance.accountMappings', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const defaults = await resetAccountMappings(prisma, ctx.companyId);
      return sendSuccess(reply, defaults);
    },
  );
}

export const accountMappingsRoutesPlugin = accountMappingsRoutes;
