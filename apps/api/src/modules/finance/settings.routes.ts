import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import { updateFinanceSettingsSchema, financeSettingsResponseSchema } from './settings.schema.js';
import type { UpdateFinanceSettingsInput } from './settings.schema.js';
import {
  getFinanceSettings,
  updateFinanceSettings,
  resetFinanceSettings,
} from './settings.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const financeSettingsEnvelope = successEnvelope(financeSettingsResponseSchema);

// ---------------------------------------------------------------------------
// Finance settings routes plugin
// ---------------------------------------------------------------------------

async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /settings — return all FINANCE category settings grouped by tab (AC-1)
  fastify.get(
    '/settings',
    {
      schema: {
        response: { 200: financeSettingsEnvelope },
      },
      preHandler: createPermissionGuard('finance.settings', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const settings = await getFinanceSettings(prisma, ctx.companyId);
      return sendSuccess(reply, settings);
    },
  );

  // PUT /settings — update finance settings with tab-grouped JSON payload (AC-2)
  fastify.put<{ Body: UpdateFinanceSettingsInput }>(
    '/settings',
    {
      schema: {
        body: updateFinanceSettingsSchema,
        response: { 200: financeSettingsEnvelope },
      },
      preHandler: createPermissionGuard('finance.settings', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const updated = await updateFinanceSettings(prisma, ctx.companyId, request.body, ctx.userId);
      return sendSuccess(reply, updated);
    },
  );

  // POST /settings/reset — reset finance settings to defaults (AC-3)
  fastify.post(
    '/settings/reset',
    {
      schema: {
        response: { 200: financeSettingsEnvelope },
      },
      preHandler: createPermissionGuard('finance.settings', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const defaults = await resetFinanceSettings(prisma, ctx.companyId);
      return sendSuccess(reply, defaults);
    },
  );
}

export const settingsRoutesPlugin = settingsRoutes;
