import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import {
  createCompanyProfileRequestSchema,
  updateCompanyProfileRequestSchema,
  companyProfileResponseSchema,
  exportDefaultsResponseSchema,
  importDefaultsRequestSchema,
  importDefaultsResponseSchema,
} from './company-profile.schema.js';
import type {
  CreateCompanyProfileRequest,
  UpdateCompanyProfileRequest,
  ImportDefaultsRequest,
} from './company-profile.schema.js';
import {
  getCompanyProfile,
  createCompanyProfile,
  updateCompanyProfile,
  exportPermissionConfig,
  importPermissionConfig,
} from './company-profile.service.js';
import { createPermissionGuard, filterFieldsByPermission } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Company Profile routes plugin
// ---------------------------------------------------------------------------

async function companyProfileRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /company-profile — get current company profile
  // -------------------------------------------------------------------------
  fastify.get(
    '/company-profile',
    {
      schema: {
        response: { 200: successEnvelope(companyProfileResponseSchema) },
      },
      preHandler: createPermissionGuard('system.company-profile.detail', 'view'),
      onSend: filterFieldsByPermission('system.company-profile.detail'),
    },
    async (request, reply) => {
      const profile = await getCompanyProfile(prisma, request.companyId);
      return sendSuccess(reply, profile);
    },
  );

  // -------------------------------------------------------------------------
  // POST /company-profile — create new company
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateCompanyProfileRequest }>(
    '/company-profile',
    {
      schema: {
        body: createCompanyProfileRequestSchema,
        response: { 201: successEnvelope(companyProfileResponseSchema) },
      },
      preHandler: createPermissionGuard('system.company-profile.detail', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const profile = await createCompanyProfile(prisma, request.body, ctx);
      return sendSuccess(reply, profile, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /company-profile — update current company profile
  // -------------------------------------------------------------------------
  fastify.patch<{ Body: UpdateCompanyProfileRequest }>(
    '/company-profile',
    {
      schema: {
        body: updateCompanyProfileRequestSchema,
        response: { 200: successEnvelope(companyProfileResponseSchema) },
      },
      preHandler: createPermissionGuard('system.company-profile.detail', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const profile = await updateCompanyProfile(prisma, request.companyId, request.body, ctx);
      return sendSuccess(reply, profile);
    },
  );

  // -------------------------------------------------------------------------
  // GET /company-profile/export-defaults — export permission config as JSON
  // -------------------------------------------------------------------------
  fastify.get(
    '/company-profile/export-defaults',
    {
      schema: {
        response: { 200: successEnvelope(exportDefaultsResponseSchema) },
      },
      preHandler: createPermissionGuard('system.company-profile.detail', 'edit'),
    },
    async (request, reply) => {
      const exported = await exportPermissionConfig(prisma, request.companyId);
      const dateStr = new Date().toISOString().slice(0, 10);
      void reply.header(
        'Content-Disposition',
        `attachment; filename="company-defaults-${dateStr}.json"`,
      );
      return sendSuccess(reply, exported);
    },
  );

  // -------------------------------------------------------------------------
  // POST /company-profile/import-defaults — import permission config from JSON
  // -------------------------------------------------------------------------
  fastify.post<{ Body: ImportDefaultsRequest }>(
    '/company-profile/import-defaults',
    {
      schema: {
        body: importDefaultsRequestSchema,
        response: { 200: successEnvelope(importDefaultsResponseSchema) },
      },
      preHandler: createPermissionGuard('system.company-profile.detail', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await importPermissionConfig(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        request.body,
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );
}

export const companyProfileRoutesPlugin = companyProfileRoutes;
