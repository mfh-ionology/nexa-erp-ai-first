// ---------------------------------------------------------------------------
// Document-to-Email Routes — E10-3 Task 3.2
//
// Route layout:
//   POST /documents/email          — send document as email (STAFF+)
//   POST /documents/email/preview  — preview email without sending (STAFF+)
//
// Batch statement route is registered separately via batchStatementEmailRoutesPlugin.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { UserRole } from '@nexa/db';

import {
  sendDocumentEmailBodySchema,
  documentEmailPreviewBodySchema,
  sendDocumentEmailResponseSchema,
  documentEmailPreviewResponseSchema,
  batchStatementEmailBodySchema,
  batchStatementEmailResponseSchema,
} from './document-email.schema.js';
import type {
  SendDocumentEmailBody,
  DocumentEmailPreviewBody,
  BatchStatementEmailBody,
} from './document-email.schema.js';
import { AppError } from '../../../core/errors/index.js';
import { createRbacGuard } from '../../../core/rbac/index.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { successEnvelope } from '../../../core/schemas/envelope.js';
import { extractRequestContext } from '../../../core/types/request-context.js';

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function documentEmailRoutes(fastify: FastifyInstance): Promise<void> {
  // Use the shared DocumentEmailService decorated by the communications module plugin.
  const documentEmailService = fastify.documentEmailService;

  // ---------------------------------------------------------------------------
  // POST /documents/email — send document as email (AC #6)
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: SendDocumentEmailBody }>(
    '/documents/email',
    {
      schema: {
        body: sendDocumentEmailBodySchema,
        response: { 200: successEnvelope(sendDocumentEmailResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await documentEmailService.sendDocumentEmail(ctx, request.body);
      return sendSuccess(reply, {
        emailMessageId: result.emailMessage.id,
        queueStatus: result.queueStatus,
        recipientEmail: result.recipientEmail,
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /documents/email/preview — preview email without sending (AC #6)
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: DocumentEmailPreviewBody }>(
    '/documents/email/preview',
    {
      schema: {
        body: documentEmailPreviewBodySchema,
        response: { 200: successEnvelope(documentEmailPreviewResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const preview = await documentEmailService.previewDocumentEmail(ctx, request.body);
      return sendSuccess(reply, preview);
    },
  );
}

// ---------------------------------------------------------------------------
// Batch Statement Email Route — E10-3 Task 4.4
// POST /ar/reports/statements/batch — registered separately under AR prefix
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function batchStatementEmailRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: BatchStatementEmailBody }>(
    '/ar/reports/statements/batch',
    {
      schema: {
        body: batchStatementEmailBodySchema,
        response: { 200: successEnvelope(batchStatementEmailResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.MANAGER }),
    },
    async (request, reply) => {
      const batchStatementService = fastify.batchStatementEmailService;
      if (!batchStatementService?.getQueue()) {
        throw new AppError(
          'BATCH_EMAIL_UNAVAILABLE',
          'Batch statement email service is not available. Ensure Redis is configured.',
          503,
          undefined,
          'errors.documentEmail.batchUnavailable',
        );
      }
      const ctx = extractRequestContext(request);
      const result = await batchStatementService.triggerBatchStatementEmail(ctx, request.body);
      return sendSuccess(reply, result);
    },
  );
}

export const documentEmailRoutesPlugin = documentEmailRoutes;
export const batchStatementEmailRoutesPlugin = batchStatementEmailRoutes;
