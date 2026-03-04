// ---------------------------------------------------------------------------
// Email Template Routes — E10-2 Task 6.2
//
// Route layout:
//   GET    /email/templates           — list templates with filters (ADMIN)
//   GET    /email/templates/:id       — get single template (ADMIN)
//   POST   /email/templates           — create template (ADMIN)
//   PATCH  /email/templates/:id       — update template (ADMIN)
//   DELETE /email/templates/:id       — soft-delete template (ADMIN)
//   POST   /email/templates/:id/preview — render with sample data (ADMIN)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import {
  listTemplatesQuerySchema,
  templateIdParamsSchema,
  createTemplateBodySchema,
  updateTemplateBodySchema,
  templateResponseSchema,
  templateListResponseSchema,
  templatePreviewResponseSchema,
  deleteTemplateResponseSchema,
} from './email-template.schema.js';
import type {
  ListTemplatesQuery,
  TemplateIdParams,
  CreateTemplateBody,
  UpdateTemplateBody,
} from './email-template.schema.js';
import { EmailTemplateService } from './email-template.service.js';
import { EmailTemplateEngineService } from './email-template-engine.service.js';
import { createRbacGuard } from '../../../core/rbac/index.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { successEnvelope } from '../../../core/schemas/envelope.js';
import { extractRequestContext } from '../../../core/types/request-context.js';
import { NotFoundError } from '../../../core/errors/index.js';

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function emailTemplateRoutes(fastify: FastifyInstance): Promise<void> {
  const engine = new EmailTemplateEngineService(fastify.log);
  const templateService = new EmailTemplateService(prisma, fastify.log, engine);

  // ---------------------------------------------------------------------------
  // GET /email/templates — list templates (AC #6)
  // ---------------------------------------------------------------------------
  fastify.get<{ Querystring: ListTemplatesQuery }>(
    '/email/templates',
    {
      schema: {
        querystring: listTemplatesQuerySchema,
        response: { 200: successEnvelope(templateListResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const result = await templateService.listTemplates(request.query);
      return sendSuccess(reply, result);
    },
  );

  // ---------------------------------------------------------------------------
  // GET /email/templates/:id — get single template (AC #6)
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: TemplateIdParams }>(
    '/email/templates/:id',
    {
      schema: {
        params: templateIdParamsSchema,
        response: { 200: successEnvelope(templateResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const template = await templateService.getTemplate(request.params.id);
      if (!template) {
        throw new NotFoundError(
          'EMAIL_TEMPLATE_NOT_FOUND',
          'Email template not found',
          'errors.emailTemplate.notFound',
        );
      }
      return sendSuccess(reply, template);
    },
  );

  // ---------------------------------------------------------------------------
  // POST /email/templates — create template (AC #6)
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: CreateTemplateBody }>(
    '/email/templates',
    {
      schema: {
        body: createTemplateBodySchema,
        response: { 201: successEnvelope(templateResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const template = await templateService.createTemplate(ctx.userId, request.body);
      return sendSuccess(reply, template, undefined, 201);
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /email/templates/:id — update template (AC #6)
  // ---------------------------------------------------------------------------
  fastify.patch<{ Params: TemplateIdParams; Body: UpdateTemplateBody }>(
    '/email/templates/:id',
    {
      schema: {
        params: templateIdParamsSchema,
        body: updateTemplateBodySchema,
        response: { 200: successEnvelope(templateResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const template = await templateService.updateTemplate(
        request.params.id,
        ctx.userId,
        request.body,
      );
      if (!template) {
        throw new NotFoundError(
          'EMAIL_TEMPLATE_NOT_FOUND',
          'Email template not found',
          'errors.emailTemplate.notFound',
        );
      }
      return sendSuccess(reply, template);
    },
  );

  // ---------------------------------------------------------------------------
  // DELETE /email/templates/:id — soft-delete (AC #6)
  // ---------------------------------------------------------------------------
  fastify.delete<{ Params: TemplateIdParams }>(
    '/email/templates/:id',
    {
      schema: {
        params: templateIdParamsSchema,
        response: { 200: successEnvelope(deleteTemplateResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const deleted = await templateService.deleteTemplate(request.params.id);
      if (!deleted) {
        throw new NotFoundError(
          'EMAIL_TEMPLATE_NOT_FOUND',
          'Email template not found',
          'errors.emailTemplate.notFound',
        );
      }
      return sendSuccess(reply, { deleted: true });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /email/templates/:id/preview — render with sample data (AC #6)
  // ---------------------------------------------------------------------------
  fastify.post<{ Params: TemplateIdParams }>(
    '/email/templates/:id/preview',
    {
      schema: {
        params: templateIdParamsSchema,
        response: { 200: successEnvelope(templatePreviewResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const result = await templateService.previewTemplate(request.params.id);
      if (!result) {
        throw new NotFoundError(
          'EMAIL_TEMPLATE_NOT_FOUND',
          'Email template not found',
          'errors.emailTemplate.notFound',
        );
      }
      return sendSuccess(reply, result);
    },
  );
}

export const emailTemplateRoutesPlugin = emailTemplateRoutes;
