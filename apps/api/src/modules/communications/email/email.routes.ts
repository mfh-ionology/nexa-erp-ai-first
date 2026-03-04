// ---------------------------------------------------------------------------
// Email Routes — E10-1 Task 6.2
//
// Route layout:
//   GET    /email/messages           — list outbound emails (STAFF+)
//   GET    /email/messages/:id       — get single email with recipients (STAFF+)
//   POST   /email/messages           — create email message with recipients (STAFF+)
//   POST   /email/messages/:id/send  — queue for sending / re-queue FAILED (STAFF+)
//   PATCH  /email/messages/:id/read  — mark read/unread for current user (STAFF+)
//   DELETE /email/messages/:id       — soft-delete email for current user (STAFF+)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import {
  listEmailsQuerySchema,
  emailIdParamsSchema,
  createEmailBodySchema,
  emailResponseSchema,
  emailListResponseSchema,
  deleteEmailResponseSchema,
} from './email.schema.js';
import type { ListEmailsQuery, EmailIdParams, CreateEmailBody } from './email.schema.js';
import { EmailService } from './email.service.js';
import { EmailQueueService } from './email-queue.service.js';
import { createRbacGuard } from '../../../core/rbac/index.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { successEnvelope } from '../../../core/schemas/envelope.js';
import { extractRequestContext } from '../../../core/types/request-context.js';
import { NotFoundError } from '../../../core/errors/index.js';

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function emailRoutes(fastify: FastifyInstance): Promise<void> {
  const emailService = new EmailService(prisma, fastify.log, fastify.eventBus);
  const emailQueueService = new EmailQueueService(prisma, fastify.log);

  // ---------------------------------------------------------------------------
  // GET /email/messages — list emails (AC #8)
  // ---------------------------------------------------------------------------
  fastify.get<{ Querystring: ListEmailsQuery }>(
    '/email/messages',
    {
      schema: {
        querystring: listEmailsQuerySchema,
        response: { 200: successEnvelope(emailListResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await emailService.listEmails(ctx.companyId, request.query);
      return sendSuccess(reply, result);
    },
  );

  // ---------------------------------------------------------------------------
  // GET /email/messages/:id — get single email (AC #8)
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: EmailIdParams }>(
    '/email/messages/:id',
    {
      schema: {
        params: emailIdParamsSchema,
        response: { 200: successEnvelope(emailResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const email = await emailService.getEmail(request.params.id, ctx.companyId);
      if (!email) {
        throw new NotFoundError('EMAIL_NOT_FOUND', 'Email not found', 'errors.email.notFound');
      }
      return sendSuccess(reply, email);
    },
  );

  // ---------------------------------------------------------------------------
  // POST /email/messages — create email with recipients (AC #8)
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: CreateEmailBody }>(
    '/email/messages',
    {
      schema: {
        body: createEmailBodySchema,
        response: { 201: successEnvelope(emailResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const email = await emailService.createEmail(ctx.companyId, ctx.userId, request.body);
      return sendSuccess(reply, email, undefined, 201);
    },
  );

  // ---------------------------------------------------------------------------
  // POST /email/messages/:id/send — queue for sending or re-queue FAILED (AC #8)
  // ---------------------------------------------------------------------------
  fastify.post<{ Params: EmailIdParams }>(
    '/email/messages/:id/send',
    {
      schema: {
        params: emailIdParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);

      // Append signature before queuing (AC #7) — companyId scoped
      await emailService.appendSignature(request.params.id, ctx.companyId, ctx.userId);

      const queueEntry = await emailQueueService.queueEmail(request.params.id, ctx.companyId);
      return sendSuccess(reply, { emailMessageId: request.params.id, queueEntry });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /email/messages/:id/read — mark read/unread for current user (AC #8)
  // ---------------------------------------------------------------------------
  fastify.patch<{ Params: EmailIdParams }>(
    '/email/messages/:id/read',
    {
      schema: {
        params: emailIdParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);

      // Toggle read status — verify email belongs to caller's company via join
      const recipient = await prisma.emailRecipient.findFirst({
        where: {
          emailMessageId: request.params.id,
          userId: ctx.userId,
          emailMessage: { companyId: ctx.companyId },
        },
      });

      if (!recipient) {
        throw new NotFoundError(
          'EMAIL_RECIPIENT_NOT_FOUND',
          'Email recipient not found for current user',
          'errors.email.recipientNotFound',
        );
      }

      const isRead = recipient.status === 'READ';
      const updated = await prisma.emailRecipient.update({
        where: { id: recipient.id },
        data: {
          status: isRead ? 'UNREAD' : 'READ',
          readAt: isRead ? null : new Date(),
        },
      });

      return sendSuccess(reply, updated);
    },
  );

  // ---------------------------------------------------------------------------
  // DELETE /email/messages/:id — soft-delete for current user (AC #8)
  // ---------------------------------------------------------------------------
  fastify.delete<{ Params: EmailIdParams }>(
    '/email/messages/:id',
    {
      schema: {
        params: emailIdParamsSchema,
        response: { 200: successEnvelope(deleteEmailResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const deleted = await emailService.deleteEmail(request.params.id, ctx.companyId, ctx.userId);
      if (!deleted) {
        throw new NotFoundError('EMAIL_NOT_FOUND', 'Email not found', 'errors.email.notFound');
      }
      return sendSuccess(reply, { deleted: true });
    },
  );
}

export const emailRoutesPlugin = emailRoutes;
