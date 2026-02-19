import type { FastifyInstance } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import {
  createCompanyProfileRequestSchema,
  updateCompanyProfileRequestSchema,
  companyProfileResponseSchema,
} from './company-profile.schema.js';
import type {
  CreateCompanyProfileRequest,
  UpdateCompanyProfileRequest,
} from './company-profile.schema.js';
import {
  getCompanyProfile,
  createCompanyProfile,
  updateCompanyProfile,
} from './company-profile.service.js';
import { createRbacGuard } from '../../core/rbac/index.js';
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
      preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }),
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
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
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
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const profile = await updateCompanyProfile(prisma, request.companyId, request.body, ctx);
      return sendSuccess(reply, profile);
    },
  );
}

export const companyProfileRoutesPlugin = companyProfileRoutes;
