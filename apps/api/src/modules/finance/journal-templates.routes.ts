import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createTemplateSchema,
  updateTemplateSchema,
  executeTemplateSchema,
  listTemplatesQuerySchema,
  templateParamsSchema,
  templateDetailSchema,
} from './journal-templates.schema.js';
import type { ListTemplatesQuery } from './journal-templates.schema.js';
import {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  executeTemplate,
} from './journal-templates.service.js';
import { journalDetailSchema } from './journals.schema.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const templateDetailEnvelope = successEnvelope(templateDetailSchema);
const journalDetailEnvelope = successEnvelope(journalDetailSchema);

// ---------------------------------------------------------------------------
// Journal Templates routes plugin
// ---------------------------------------------------------------------------

async function journalTemplatesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /templates — list templates with frequency and next due date (AC-1)
  fastify.get<{ Querystring: ListTemplatesQuery }>(
    '/templates',
    {
      schema: {
        querystring: listTemplatesQuerySchema,
      },
      preHandler: createPermissionGuard('finance.journals', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listTemplates(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /templates/:id — template detail
  fastify.get<{ Params: { id: string } }>(
    '/templates/:id',
    {
      schema: {
        params: templateParamsSchema,
        response: { 200: templateDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.journals', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getTemplateById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /templates — create template with lines JSON (AC-2)
  fastify.post(
    '/templates',
    {
      schema: {
        body: createTemplateSchema,
        response: { 201: templateDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.journals', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createTemplate(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof createTemplateSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /templates/:id — update template (AC-3)
  fastify.patch<{ Params: { id: string } }>(
    '/templates/:id',
    {
      schema: {
        params: templateParamsSchema,
        body: updateTemplateSchema,
        response: { 200: templateDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.journals', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateTemplate(
        prisma,
        ctx.companyId,
        request.params.id,
        request.body as z.infer<typeof updateTemplateSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result);
    },
  );

  // DELETE /templates/:id — soft-delete (isActive=false) (AC-4)
  fastify.delete<{ Params: { id: string } }>(
    '/templates/:id',
    {
      schema: {
        params: templateParamsSchema,
        response: { 200: templateDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.journals', 'delete'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await deleteTemplate(prisma, ctx.companyId, request.params.id, ctx.userId);
      return sendSuccess(reply, result);
    },
  );

  // POST /templates/:id/execute — create journal entry from template (AC-5, AC-6)
  fastify.post<{ Params: { id: string } }>(
    '/templates/:id/execute',
    {
      schema: {
        params: templateParamsSchema,
        body: executeTemplateSchema,
        response: { 201: journalDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.journals', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await executeTemplate(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        request.params.id,
        request.body as z.infer<typeof executeTemplateSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );
}

export const journalTemplatesRoutesPlugin = journalTemplatesRoutes;
