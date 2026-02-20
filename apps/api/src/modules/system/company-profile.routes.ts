import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import {
  createCompanyProfileRequestSchema,
  updateCompanyProfileRequestSchema,
  companyProfileResponseSchema,
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
  exportDefaults,
  importDefaults,
} from './company-profile.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Company Profile routes plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
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
      preHandler: createPermissionGuard('system.company-profile', 'view'),
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
      preHandler: createPermissionGuard('system.company-profile', 'new'),
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
      preHandler: createPermissionGuard('system.company-profile', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const profile = await updateCompanyProfile(prisma, request.companyId, request.body, ctx);
      return sendSuccess(reply, profile);
    },
  );

  // -------------------------------------------------------------------------
  // GET /company-profile/export-defaults — export access groups as JSON
  // -------------------------------------------------------------------------
  fastify.get(
    '/company-profile/export-defaults',
    {
      preHandler: createPermissionGuard('system.company-profile', 'edit'),
    },
    async (request, reply) => {
      const data = await exportDefaults(prisma, request.companyId);
      return sendSuccess(reply, data);
    },
  );

  // -------------------------------------------------------------------------
  // POST /company-profile/import-defaults — import access groups (upsert)
  // -------------------------------------------------------------------------
  fastify.post<{ Body: ImportDefaultsRequest }>(
    '/company-profile/import-defaults',
    {
      schema: {
        body: importDefaultsRequestSchema,
        response: { 200: successEnvelope(importDefaultsResponseSchema) },
      },
      preHandler: createPermissionGuard('system.company-profile', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await importDefaults(prisma, request.companyId, request.body, ctx);
      return sendSuccess(reply, result);
    },
  );
}

export const companyProfileRoutesPlugin = companyProfileRoutes;
