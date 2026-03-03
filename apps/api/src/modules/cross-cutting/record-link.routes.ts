import type { FastifyInstance } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import {
  createRecordLinkSchema,
  recordLinkListQuerySchema,
  recordLinkParamsSchema,
  recordLinkResponseSchema,
  recordLinkListResponseSchema,
} from './record-link.schema.js';
import type {
  CreateRecordLinkInput,
  RecordLinkListQuery,
  RecordLinkParams,
} from './record-link.schema.js';
import { createRecordLink, listRecordLinks, deleteRecordLink } from './record-link.service.js';
import { createRbacGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Record-link CRUD routes plugin
//
// Route layout:
//   POST   /record-links        — create record link (STAFF)
//   GET    /record-links        — list record links for entity (VIEWER)
//   DELETE /record-links/:id    — delete record link (STAFF; MANAGER for system links)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function recordLinkRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /record-links — create record link (AC: #1, #7, #8)
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateRecordLinkInput }>(
    '/record-links',
    {
      schema: {
        body: createRecordLinkSchema,
        response: { 201: successEnvelope(recordLinkResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createRecordLink(ctx, prisma, request.body);
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // GET /record-links — list record links for entity (AC: #3, #4)
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: RecordLinkListQuery }>(
    '/record-links',
    {
      schema: {
        querystring: recordLinkListQuerySchema,
        response: { 200: successEnvelope(recordLinkListResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await listRecordLinks(ctx, prisma, request.query);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /record-links/:id — delete record link (AC: #5, #6)
  // STAFF can delete manual links; service layer rejects STAFF for system
  // links (requires MANAGER+).
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: RecordLinkParams }>(
    '/record-links/:id',
    {
      schema: {
        params: recordLinkParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await deleteRecordLink(ctx, prisma, request.params.id);
      return reply.code(204).send();
    },
  );
}

export const recordLinkRoutesPlugin = recordLinkRoutes;
