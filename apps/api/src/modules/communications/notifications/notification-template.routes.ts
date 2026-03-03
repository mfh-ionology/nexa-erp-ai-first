import type { FastifyInstance } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import {
  createTemplateSchema,
  updateTemplateSchema,
  templateListQuerySchema,
  templateParamsSchema,
  templateResponseSchema,
  templateListResponseSchema,
} from './notification-template.schema.js';
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateListQuery,
  TemplateParams,
} from './notification-template.schema.js';
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  getTemplateById,
} from './notification-template.service.js';
import { createRbacGuard } from '../../../core/rbac/index.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { successEnvelope } from '../../../core/schemas/envelope.js';
import { extractRequestContext } from '../../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Notification Template CRUD routes plugin (ADMIN only)
//
// Route layout:
//   GET    /notifications/templates      — list templates
//   GET    /notifications/templates/:id  — get template by id
//   POST   /notifications/templates      — create template
//   PATCH  /notifications/templates/:id  — update template
//   DELETE /notifications/templates/:id  — soft-delete template
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function notificationTemplateRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /notifications/templates — list templates
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: TemplateListQuery }>(
    '/notifications/templates',
    {
      schema: {
        querystring: templateListQuerySchema,
        response: { 200: successEnvelope(templateListResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await listTemplates(ctx, prisma, request.query);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // GET /notifications/templates/:id — get template by id
  // -------------------------------------------------------------------------
  fastify.get<{ Params: TemplateParams }>(
    '/notifications/templates/:id',
    {
      schema: {
        params: templateParamsSchema,
        response: { 200: successEnvelope(templateResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getTemplateById(ctx, prisma, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // POST /notifications/templates — create template
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateTemplateInput }>(
    '/notifications/templates',
    {
      schema: {
        body: createTemplateSchema,
        response: { 201: successEnvelope(templateResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createTemplate(ctx, prisma, request.body);
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /notifications/templates/:id — update template
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: TemplateParams; Body: UpdateTemplateInput }>(
    '/notifications/templates/:id',
    {
      schema: {
        params: templateParamsSchema,
        body: updateTemplateSchema,
        response: { 200: successEnvelope(templateResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateTemplate(ctx, prisma, request.params.id, request.body);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /notifications/templates/:id — soft-delete template
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: TemplateParams }>(
    '/notifications/templates/:id',
    {
      schema: {
        params: templateParamsSchema,
        response: { 200: successEnvelope(templateResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await deleteTemplate(ctx, prisma, request.params.id);
      return sendSuccess(reply, result);
    },
  );
}

export const notificationTemplateRoutesPlugin = notificationTemplateRoutes;
