import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { createPermissionGuard } from '../core/rbac/index.js';
import { sendSuccess } from '../core/utils/response.js';
import { successEnvelope } from '../core/schemas/envelope.js';
import type { AiOrchestrator } from './orchestrator.js';
import type { ChatSessionService } from './chat-session.service.js';
import {
  createSessionBodySchema,
  listSessionsQuerySchema,
  getSessionParamsSchema,
  getSessionQuerySchema,
  endSessionParamsSchema,
  sessionSummarySchema,
  sessionDetailSchema,
  sessionCreatedSchema,
} from './chat-session.schema.js';

// ---------------------------------------------------------------------------
// Request / response schemas
// ---------------------------------------------------------------------------

const chatMessageBodySchema = z.object({
  sessionId: z.string().min(1),
  content: z.string().min(1).max(10_000),
  currentPage: z.string().max(500).optional(),
  currentEntityType: z.string().max(100).optional(),
  currentEntityId: z.string().max(100).optional(),
});

const aiResponseSchema = z.object({
  type: z.enum(['text', 'action_proposal', 'record_created', 'error']),
  messageId: z.string(),
  content: z.string().optional(),
  action: z.object({
    id: z.string(),
    type: z.string(),
    description: z.string(),
    entityType: z.string(),
    previewData: z.record(z.string(), z.unknown()),
    confidence: z.number(),
  }).optional(),
  record: z.object({
    entityType: z.string(),
    entityId: z.string(),
    displayRef: z.string(),
  }).optional(),
  confidence: z.number().optional(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    latencyMs: z.number(),
  }).optional(),
});

// ---------------------------------------------------------------------------
// AI chat routes plugin
// ---------------------------------------------------------------------------

async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /chat/message — HTTP fallback for non-streaming AI requests
  // -------------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof chatMessageBodySchema> }>(
    '/chat/message',
    {
      schema: {
        body: chatMessageBodySchema,
        response: { 200: successEnvelope(aiResponseSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      const orchestrator = fastify.aiOrchestrator as AiOrchestrator | undefined;

      if (!orchestrator) {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'AI_DEGRADED',
            message: 'AI service is not available',
            messageKey: 'ai.error.degraded',
          },
        });
      }

      const aiResponse = await orchestrator.process({
        intent: 'chat',
        userMessage: request.body.content,
        conversationId: request.body.sessionId,
        context: {
          userId: request.userId,
          companyId: request.companyId,
          tenantId: request.tenantId,
          currentPage: request.body.currentPage,
          currentEntityType: request.body.currentEntityType,
          currentEntityId: request.body.currentEntityId,
          locale: request.headers['accept-language']?.split(',')[0]?.trim() || 'en-GB',
        },
      });

      // Map orchestrator error responses to appropriate HTTP status codes
      if (aiResponse.type === 'error') {
        if (aiResponse.errorCode === 'AI_QUOTA_EXCEEDED') {
          return reply.status(429).send({
            success: false,
            error: {
              code: 'AI_QUOTA_EXCEEDED',
              message: aiResponse.content ?? 'AI usage quota exceeded',
              messageKey: 'ai.error.quotaExceeded',
            },
          });
        }
        return reply.status(503).send({
          success: false,
          error: {
            code: aiResponse.errorCode ?? 'AI_DEGRADED',
            message: aiResponse.content ?? 'AI service is temporarily unavailable',
            messageKey: 'ai.error.degraded',
          },
        });
      }

      return sendSuccess(reply, aiResponse);
    },
  );

  // -------------------------------------------------------------------------
  // POST /chat/sessions — Create a new chat session
  // -------------------------------------------------------------------------
  fastify.post<{ Body: z.infer<typeof createSessionBodySchema> }>(
    '/chat/sessions',
    {
      schema: {
        body: createSessionBodySchema,
        response: { 201: successEnvelope(sessionCreatedSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      const sessionService = fastify.chatSessionService as ChatSessionService | undefined;

      if (!sessionService) {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'AI_DEGRADED',
            message: 'AI service is not available',
            messageKey: 'ai.error.degraded',
          },
        });
      }

      const session = await sessionService.createSession({
        userId: request.userId,
        companyId: request.companyId,
        channel: request.body.channel,
        agentId: request.body.agentId,
      });

      return sendSuccess(reply, session, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // GET /chat/history — List user's conversations (most recent first)
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof listSessionsQuerySchema> }>(
    '/chat/history',
    {
      schema: {
        querystring: listSessionsQuerySchema,
        response: { 200: successEnvelope(z.array(sessionSummarySchema)) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      const sessionService = fastify.chatSessionService as ChatSessionService | undefined;

      if (!sessionService) {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'AI_DEGRADED',
            message: 'AI service is not available',
            messageKey: 'ai.error.degraded',
          },
        });
      }

      const result = await sessionService.listSessions({
        userId: request.userId,
        companyId: request.companyId,
        cursor: request.query.cursor,
        limit: request.query.limit,
      });

      return sendSuccess(reply, result.data, {
        cursor: result.nextCursor,
        hasMore: result.nextCursor !== null,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /chat/history/:sessionId — Get single conversation with messages
  // -------------------------------------------------------------------------
  fastify.get<{
    Params: z.infer<typeof getSessionParamsSchema>;
    Querystring: z.infer<typeof getSessionQuerySchema>;
  }>(
    '/chat/history/:sessionId',
    {
      schema: {
        params: getSessionParamsSchema,
        querystring: getSessionQuerySchema,
        response: { 200: successEnvelope(sessionDetailSchema) },
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      const sessionService = fastify.chatSessionService as ChatSessionService | undefined;

      if (!sessionService) {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'AI_DEGRADED',
            message: 'AI service is not available',
            messageKey: 'ai.error.degraded',
          },
        });
      }

      const session = await sessionService.getSession({
        sessionId: request.params.sessionId,
        userId: request.userId,
        companyId: request.companyId,
        messageLimit: request.query.messageLimit,
        messageCursor: request.query.messageCursor,
      });

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
            messageKey: 'ai.error.sessionNotFound',
          },
        });
      }

      return sendSuccess(reply, session);
    },
  );

  // -------------------------------------------------------------------------
  // POST /chat/sessions/:sessionId/end — End a chat session
  // -------------------------------------------------------------------------
  fastify.post<{
    Params: z.infer<typeof endSessionParamsSchema>;
  }>(
    '/chat/sessions/:sessionId/end',
    {
      schema: {
        params: endSessionParamsSchema,
      },
      preHandler: createPermissionGuard('ai.chat', 'view'),
    },
    async (request, reply) => {
      const sessionService = fastify.chatSessionService as ChatSessionService | undefined;

      if (!sessionService) {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'AI_DEGRADED',
            message: 'AI service is not available',
            messageKey: 'ai.error.degraded',
          },
        });
      }

      await sessionService.endSession(
        request.params.sessionId,
        request.userId,
        request.companyId,
      );

      return sendSuccess(reply, { sessionId: request.params.sessionId, status: 'completed' });
    },
  );
}

export const aiRoutesPlugin = aiRoutes;
