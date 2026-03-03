import type { FastifyInstance } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import {
  presignRequestSchema,
  confirmRequestSchema,
  attachmentListQuerySchema,
  attachmentParamsSchema,
  presignResponseSchema,
  attachmentResponseSchema,
  downloadResponseSchema,
  attachmentListResponseSchema,
} from './attachment.schema.js';
import type {
  PresignRequest,
  ConfirmRequest,
  AttachmentListQuery,
  AttachmentParams,
} from './attachment.schema.js';
import {
  presignUpload,
  confirmUpload,
  getDownloadUrl,
  deleteAttachment,
  listAttachments,
} from './attachment.service.js';
import { createRbacGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Attachment CRUD routes plugin
//
// Route layout:
//   POST /attachments/presign           — get presigned upload URL (STAFF)
//   POST /attachments/confirm           — confirm upload completion (STAFF)
//   GET  /attachments/:id/download      — get presigned download URL (VIEWER)
//   DELETE /attachments/:id             — delete attachment (MANAGER)
//   GET  /attachments                   — list attachments for entity (VIEWER)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function attachmentRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /attachments/presign — get presigned upload URL (AC: #1, #2, #5)
  // -------------------------------------------------------------------------
  fastify.post<{ Body: PresignRequest }>(
    '/attachments/presign',
    {
      schema: {
        body: presignRequestSchema,
        response: { 200: successEnvelope(presignResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await presignUpload(prisma, ctx, request.body);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // POST /attachments/confirm — confirm upload completion (AC: #3)
  // -------------------------------------------------------------------------
  fastify.post<{ Body: ConfirmRequest }>(
    '/attachments/confirm',
    {
      schema: {
        body: confirmRequestSchema,
        response: { 201: successEnvelope(attachmentResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await confirmUpload(prisma, ctx, request.body);
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // GET /attachments/:id/download — get presigned download URL (AC: #4)
  // -------------------------------------------------------------------------
  fastify.get<{ Params: AttachmentParams }>(
    '/attachments/:id/download',
    {
      schema: {
        params: attachmentParamsSchema,
        response: { 200: successEnvelope(downloadResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getDownloadUrl(prisma, ctx, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /attachments/:id — delete attachment (AC: #6)
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: AttachmentParams }>(
    '/attachments/:id',
    {
      schema: {
        params: attachmentParamsSchema,
        response: { 200: successEnvelope(attachmentParamsSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.MANAGER }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await deleteAttachment(prisma, ctx, request.params.id);
      return sendSuccess(reply, { id: request.params.id });
    },
  );

  // -------------------------------------------------------------------------
  // GET /attachments — list attachments for entity (AC: #7)
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: AttachmentListQuery }>(
    '/attachments',
    {
      schema: {
        querystring: attachmentListQuerySchema,
        response: { 200: successEnvelope(attachmentListResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await listAttachments(
        prisma,
        ctx,
        request.query.entityType,
        request.query.entityId,
        request.query.limit,
        request.query.offset,
      );
      return sendSuccess(reply, result);
    },
  );
}

export const attachmentRoutesPlugin = attachmentRoutes;
