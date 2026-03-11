// ---------------------------------------------------------------------------
// Print Preference Routes — E13-1 Task 3.2
// GET  /print-preferences                 — resolved preferences for current user
// PUT  /print-preferences                 — update user preferences
// GET  /print-preferences/company-defaults — company-level defaults (STAFF+ read)
// PUT  /print-preferences/company-defaults — update company defaults (ADMIN)
// DELETE /print-preferences/reset          — reset user preferences to defaults
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import { prisma } from '@nexa/db';

import {
  updateUserPreferencesBodySchema,
  type UpdateUserPreferencesBody,
  updateCompanyDefaultsBodySchema,
  type UpdateCompanyDefaultsBody,
  getPreferencesResponseSchema,
  getCompanyDefaultsResponseSchema,
} from '../schemas/print-preference.schema.js';
import { createRbacGuard } from '../../../core/rbac/index.js';
import {
  PrintPreferenceService,
  type PreferenceInput,
} from '../services/print-preference.service.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function printPreferenceRoutes(fastify: FastifyInstance): Promise<void> {
  const log = fastify.log as Logger;
  const service = new PrintPreferenceService(prisma, log);

  // -------------------------------------------------------------------------
  // GET /print-preferences — resolved preferences for current user (STAFF+)
  // -------------------------------------------------------------------------
  fastify.get(
    '/print-preferences',
    {
      schema: {
        response: { 200: getPreferencesResponseSchema },
      },
      preHandler: createRbacGuard({ minimumRole: 'STAFF' as const }),
    },
    async (request, reply) => {
      const preferences = await service.getPreferences(request.companyId, request.userId);
      return reply.send(preferences);
    },
  );

  // -------------------------------------------------------------------------
  // PUT /print-preferences — update user preferences (STAFF+)
  // -------------------------------------------------------------------------
  fastify.put<{ Body: UpdateUserPreferencesBody }>(
    '/print-preferences',
    {
      schema: {
        body: updateUserPreferencesBodySchema,
        response: { 200: getPreferencesResponseSchema },
      },
      preHandler: createRbacGuard({ minimumRole: 'STAFF' as const }),
    },
    async (request, reply) => {
      await service.updateUserPreferences(
        request.companyId,
        request.userId,
        request.body.preferences as PreferenceInput[],
      );
      const updated = await service.getPreferences(request.companyId, request.userId);
      return reply.send(updated);
    },
  );

  // -------------------------------------------------------------------------
  // GET /print-preferences/company-defaults — company defaults (STAFF+, read-only)
  // -------------------------------------------------------------------------
  fastify.get(
    '/print-preferences/company-defaults',
    {
      schema: {
        response: { 200: getCompanyDefaultsResponseSchema },
      },
      preHandler: createRbacGuard({ minimumRole: 'STAFF' as const }),
    },
    async (request, reply) => {
      const defaults = await service.getCompanyDefaults(request.companyId);
      return reply.send(defaults);
    },
  );

  // -------------------------------------------------------------------------
  // PUT /print-preferences/company-defaults — update company defaults (ADMIN+)
  // -------------------------------------------------------------------------
  fastify.put<{ Body: UpdateCompanyDefaultsBody }>(
    '/print-preferences/company-defaults',
    {
      schema: {
        body: updateCompanyDefaultsBodySchema,
        response: { 200: getCompanyDefaultsResponseSchema },
      },
      preHandler: createRbacGuard({ minimumRole: 'ADMIN' as const }),
    },
    async (request, reply) => {
      await service.updateCompanyDefaults(
        request.companyId,
        request.body.defaults as PreferenceInput[],
      );
      const updated = await service.getCompanyDefaults(request.companyId);
      return reply.send(updated);
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /print-preferences/reset — reset user preferences to defaults (STAFF+)
  // -------------------------------------------------------------------------
  fastify.delete(
    '/print-preferences/reset',
    {
      schema: {
        response: { 200: getPreferencesResponseSchema },
      },
      preHandler: createRbacGuard({ minimumRole: 'STAFF' as const }),
    },
    async (request, reply) => {
      await service.resetUserPreferences(request.companyId, request.userId);
      const preferences = await service.getPreferences(request.companyId, request.userId);
      return reply.send(preferences);
    },
  );
}

export const printPreferenceRoutesPlugin = printPreferenceRoutes;
