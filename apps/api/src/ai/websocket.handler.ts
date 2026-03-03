import { randomUUID } from 'node:crypto';
import { Server as SocketServer, type Socket } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import { z } from 'zod';
import { prisma as tenantPrisma, resolveUserRole } from '@nexa/db';

import { verifyAccessToken } from '../core/auth/auth.service.js';
import { permissionService } from '../core/rbac/index.js';
import type { AiOrchestrator } from './orchestrator.js';
import type { ChatSessionService } from './chat-session.service.js';
import type { ActionPlanner } from './action-planner.js';
import type { AiRequest, AiStreamChunk, IActionExecutor } from './ai.types.js';
import { AiActionNotFoundError, AiActionForbiddenError } from './ai.errors.js';

// UUID v4 format validation (matches company-context middleware)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Client → Server message schemas (AC #1, #2) ────────────────────────────

/** Shared fields across all client message types */
const baseFields = {
  sessionId: z.string().default(''),
};

const chatMessageSchema = z.object({
  ...baseFields,
  type: z.literal('message'),
  content: z.string().min(1).max(10_000),
  // Client-provided page context for context-aware AI
  currentPage: z.string().max(500).optional(),
  currentEntityType: z.string().max(100).optional(),
  currentEntityId: z.string().max(100).optional(),
  // Structured entity references from inline entity mentions (E5b-7)
  entityMentions: z
    .array(
      z.object({
        type: z.string().min(1).max(100),
        id: z.string().min(1).max(200),
        name: z.string().min(1).max(500),
      }),
    )
    .max(20)
    .optional(),
});

const actionConfirmSchema = z.object({
  ...baseFields,
  type: z.literal('action_confirm'),
  content: z.string().optional(),
  actionId: z.string().min(1),
  currentPage: z.string().max(500).optional(),
  currentEntityType: z.string().max(100).optional(),
  currentEntityId: z.string().max(100).optional(),
});

const actionRejectSchema = z.object({
  ...baseFields,
  type: z.literal('action_reject'),
  content: z.string().optional(),
  actionId: z.string().min(1),
  currentPage: z.string().max(500).optional(),
  currentEntityType: z.string().max(100).optional(),
  currentEntityId: z.string().max(100).optional(),
});

const aiChatClientMessageSchema = z.discriminatedUnion('type', [
  chatMessageSchema,
  actionConfirmSchema,
  actionRejectSchema,
]);

type AiChatMessage = z.infer<typeof chatMessageSchema>;

// ─── Server → Client message types (AC #2) ──────────────────────────────────

export interface AiChatServerMessage {
  type: 'text' | 'action_proposal' | 'record_created' | 'error' | 'stream_chunk' | 'stream_end';
  sessionId: string;
  messageId: string;
  content?: string;
  messageKey?: string; // i18n translation key for content (used on text messages)
  action?: {
    id: string;
    type: string;
    description: string;
    entityType: string;
    previewData: Record<string, unknown>;
    confidence: number;
  };
  record?: {
    entityType: string;
    entityId: string;
    displayRef: string;
  };
  error?: {
    code: string;
    message: string;
    messageKey?: string;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  };
}

// ─── Authenticated socket data ──────────────────────────────────────────────

interface AuthenticatedSocketData {
  userId: string;
  companyId: string;
  tenantId: string;
  userRole: string;
  enabledModules: string[];
}

// ─── WebSocket Handler ──────────────────────────────────────────────────────

export class AiWebSocketHandler {
  private io: SocketServer | null = null;

  /** Track in-flight AbortControllers per socket for cancellation on disconnect.
   *  Uses a Set per socket to support multiple concurrent requests. */
  private inflightRequests = new Map<string, Set<AbortController>>();

  /** Per-socket message timestamps for rate limiting (sliding window). */
  private messageTimestamps = new Map<string, number[]>();

  /** ActionPlanner for staging/retrieving action proposals (nullable for graceful degradation) */
  private actionPlanner: ActionPlanner | null = null;

  /** ActionExecutor for executing confirmed actions (nullable for graceful degradation) */
  private actionExecutor: IActionExecutor | null = null;

  /** Max messages per socket within the rate limit window. */
  private static readonly RATE_LIMIT_MAX = 10;
  /** Rate limit window in milliseconds (60 seconds). */
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000;

  constructor(
    private fastify: FastifyInstance,
    private logger: Logger,
  ) {}

  /** Set the ActionPlanner instance (called during plugin initialization) */
  setActionPlanner(planner: ActionPlanner): void {
    this.actionPlanner = planner;
  }

  /** Set the ActionExecutor instance (called during plugin initialization) */
  setActionExecutor(executor: IActionExecutor): void {
    this.actionExecutor = executor;
  }

  /**
   * Attach Socket.io to the Fastify HTTP server.
   * Configures the /ai/chat namespace with JWT auth middleware.
   */
  attach(httpServer: any): void {
    // Derive CORS origin from env to match Fastify CORS config
    const corsOrigin = process.env.CORS_ORIGIN ?? '*';

    this.io = new SocketServer(httpServer, {
      cors: {
        origin: corsOrigin === '*' ? true : corsOrigin.split(','),
        credentials: corsOrigin !== '*',
      },
      path: '/api/v1/ai/chat',
      transports: ['websocket', 'polling'],
    });

    // Set up /ai/chat namespace with auth middleware
    const chatNs = this.io.of('/ai/chat');
    chatNs.use((socket, next) => this.authenticateSocket(socket, next));
    chatNs.on('connection', (socket) => this.handleConnection(socket));

    this.logger.info('WebSocket handler attached at /ai/chat namespace');
  }

  /**
   * JWT authentication middleware for Socket.io.
   * Extracts JWT from handshake auth or query, verifies, and attaches user context.
   */
  private async authenticateSocket(socket: Socket, next: (err?: Error) => void): Promise<void> {
    try {
      // Extract JWT from auth object or query parameter
      const token =
        ((socket.handshake.auth as Record<string, unknown>)?.token as string | undefined) ??
        (socket.handshake.query?.token as string | undefined);

      if (!token) {
        const err = new Error('Authentication required');
        (err as any).data = {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
          messageKey: 'auth.error.required',
        };
        return next(err);
      }

      // Verify JWT using same logic as jwt-verify.hook.ts
      const payload = await verifyAccessToken(token);

      // Validate required claims
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new Error('Missing or invalid sub claim');
      }
      if (typeof payload.tenantId !== 'string' || payload.tenantId.length === 0) {
        throw new Error('Missing or invalid tenantId claim');
      }
      if (typeof payload.role !== 'string' || payload.role.length === 0) {
        throw new Error('Missing or invalid role claim');
      }
      if (!Array.isArray(payload.enabledModules)) {
        throw new Error('Missing or invalid enabledModules claim');
      }

      // ── Validate companyId (mirrors company-context middleware) ─────────
      // companyId comes from the client handshake auth (required for multi-company)
      const rawCompanyId =
        ((socket.handshake.auth as Record<string, unknown>)?.companyId as string | undefined) ??
        (socket.handshake.query?.companyId as string | undefined);

      if (!rawCompanyId) {
        const err = new Error('Company context required');
        (err as any).data = {
          message: 'Company context required',
          code: 'AUTH_REQUIRED',
          messageKey: 'auth.error.companyRequired',
        };
        return next(err);
      }

      // Validate UUID format
      if (!UUID_RE.test(rawCompanyId)) {
        const err = new Error('Invalid company ID format');
        (err as any).data = {
          message: 'Invalid company ID format',
          code: 'VALIDATION_ERROR',
          messageKey: 'validation.invalidUuid',
        };
        return next(err);
      }

      // Verify user is active
      const user = await tenantPrisma.user.findUnique({
        where: { id: payload.sub },
        select: { companyId: true, isActive: true },
      });

      if (!user || !user.isActive) {
        const err = new Error('Authentication required');
        (err as any).data = {
          message: 'User not found or inactive',
          code: 'AUTH_REQUIRED',
          messageKey: 'auth.error.required',
        };
        return next(err);
      }

      // Verify company exists and is active
      const company = await tenantPrisma.companyProfile.findUnique({
        where: { id: rawCompanyId },
        select: { isActive: true },
      });

      if (!company || !company.isActive) {
        const err = new Error('Company access denied');
        (err as any).data = {
          message: 'Company not found or inactive',
          code: 'FORBIDDEN',
          messageKey: 'auth.error.companyAccessDenied',
        };
        return next(err);
      }

      // Verify user has a role in the target company
      const resolvedRole = await resolveUserRole(tenantPrisma, payload.sub, rawCompanyId);
      if (!resolvedRole) {
        const err = new Error('Company access denied');
        (err as any).data = {
          message: 'No access to this company',
          code: 'FORBIDDEN',
          messageKey: 'auth.error.companyAccessDenied',
        };
        return next(err);
      }

      // Check ai.chat permission via PermissionService
      const hasPermission = await permissionService.hasPermission(
        tenantPrisma,
        payload.sub,
        rawCompanyId,
        resolvedRole,
        'ai.chat',
        'view',
      );

      if (!hasPermission) {
        const err = new Error('Insufficient permissions');
        (err as any).data = {
          message: 'Insufficient permissions for AI chat',
          code: 'FORBIDDEN',
          messageKey: 'auth.error.forbidden',
        };
        return next(err);
      }

      // Attach authenticated user context to socket.data
      const socketData: AuthenticatedSocketData = {
        userId: payload.sub,
        companyId: rawCompanyId,
        tenantId: payload.tenantId,
        userRole: resolvedRole,
        enabledModules: payload.enabledModules,
      };
      socket.data = socketData;

      next();
    } catch {
      const err = new Error('Authentication required');
      (err as any).data = {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
        messageKey: 'auth.error.required',
      };
      next(err);
    }
  }

  /**
   * Handle an authenticated client connection.
   * Joins user room and sets up event listeners.
   */
  private handleConnection(socket: Socket): void {
    const data = socket.data as AuthenticatedSocketData;

    this.logger.info(
      { userId: data.userId, companyId: data.companyId, socketId: socket.id },
      'WebSocket client connected',
    );

    // Join user-specific room for future targeted messages
    const room = `${data.userId}:${data.companyId}`;
    void socket.join(room);

    // Listen for chat messages
    socket.on('chat:message', (msg: unknown) => {
      void this.handleMessage(socket, msg);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      this.logger.info(
        { userId: data.userId, companyId: data.companyId, socketId: socket.id, reason },
        'WebSocket client disconnected',
      );

      // Cancel all in-flight AI requests for this socket
      const controllers = this.inflightRequests.get(socket.id);
      if (controllers) {
        for (const controller of controllers) {
          controller.abort();
        }
        this.inflightRequests.delete(socket.id);
      }

      // Clean up rate limit state
      this.messageTimestamps.delete(socket.id);
    });
  }

  /**
   * Handle an incoming client chat message.
   * Validates, routes to orchestrator, and streams response back.
   */
  private async handleMessage(socket: Socket, raw: unknown): Promise<void> {
    const data = socket.data as AuthenticatedSocketData;

    // Rate limiting: sliding window per socket
    const now = Date.now();
    const timestamps = this.messageTimestamps.get(socket.id) ?? [];
    const windowStart = now - AiWebSocketHandler.RATE_LIMIT_WINDOW_MS;
    const recentTimestamps = timestamps.filter((t) => t > windowStart);

    if (recentTimestamps.length >= AiWebSocketHandler.RATE_LIMIT_MAX) {
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: '',
        messageId: randomUUID(),
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many messages. Please wait before sending another.',
          messageKey: 'ai.error.rateLimited',
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    recentTimestamps.push(now);
    this.messageTimestamps.set(socket.id, recentTimestamps);

    // Validate incoming message
    const parsed = aiChatClientMessageSchema.safeParse(raw);
    if (!parsed.success) {
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: '',
        messageId: randomUUID(),
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid message format',
          messageKey: 'ai.error.validationError',
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    const msg = parsed.data;

    // Route by message type
    switch (msg.type) {
      case 'message':
        await this.handleChatMessage(socket, data, msg);
        break;

      case 'action_confirm':
        await this.handleActionConfirm(socket, data, msg);
        break;

      case 'action_reject':
        await this.handleActionReject(socket, data, msg);
        break;
    }
  }

  /**
   * Handle a chat message: resolve/create session, call orchestrator.processStream(),
   * and forward chunks.
   *
   * Task 7.1: Auto-creates a session when sessionId is empty/missing.
   * Task 7.2: Verifies session ownership when sessionId is provided.
   * Task 7.3: Passes current page context through AiRequestContext.
   *
   * Wrapped in try/finally to ensure message persistence even on client disconnect (ISSUE #12).
   */
  private async handleChatMessage(
    socket: Socket,
    authData: AuthenticatedSocketData,
    msg: AiChatMessage,
  ): Promise<void> {
    const orchestrator = this.fastify.aiOrchestrator as AiOrchestrator | null;
    const chatSessionService = this.fastify.chatSessionService as ChatSessionService | null;

    if (!orchestrator) {
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: msg.sessionId,
        messageId: randomUUID(),
        error: {
          code: 'AI_DEGRADED',
          message: 'AI service is not available',
          messageKey: 'ai.error.degraded',
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    // content is guaranteed non-empty by discriminated union schema for type='message'

    // ── Task 7.1 + 7.2: Resolve or create the session ──────────────────────
    let sessionId = msg.sessionId;
    let isNewSession = false;

    if (!sessionId) {
      // 7.1: No sessionId provided — auto-create a new AiConversation
      if (!chatSessionService) {
        const errorMsg: AiChatServerMessage = {
          type: 'error',
          sessionId: '',
          messageId: randomUUID(),
          error: {
            code: 'AI_DEGRADED',
            message: 'Chat session service is not available',
            messageKey: 'ai.error.degraded',
          },
        };
        socket.emit('chat:response', errorMsg);
        return;
      }

      try {
        const session = await chatSessionService.createSession({
          userId: authData.userId,
          companyId: authData.companyId,
          channel: 'web_chat',
        });
        sessionId = session.id;
        isNewSession = true;

        this.logger.info(
          { sessionId, userId: authData.userId, companyId: authData.companyId },
          'Auto-created chat session for WebSocket message',
        );
      } catch (error) {
        this.logger.error(
          { error: (error as Error).message, userId: authData.userId },
          'Failed to auto-create chat session',
        );
        const errorMsg: AiChatServerMessage = {
          type: 'error',
          sessionId: '',
          messageId: randomUUID(),
          error: {
            code: 'SESSION_CREATE_FAILED',
            message: 'Failed to create chat session',
            messageKey: 'ai.error.sessionCreateFailed',
          },
        };
        socket.emit('chat:response', errorMsg);
        return;
      }
    } else {
      // 7.2: sessionId provided — verify it belongs to this user + company
      if (chatSessionService) {
        const existingSession = await chatSessionService.getSession({
          sessionId,
          userId: authData.userId,
          companyId: authData.companyId,
          messageLimit: 0, // We only need to verify ownership, not load messages
        });

        if (!existingSession) {
          const errorMsg: AiChatServerMessage = {
            type: 'error',
            sessionId,
            messageId: randomUUID(),
            error: {
              code: 'SESSION_NOT_FOUND',
              message: 'Chat session not found or access denied',
              messageKey: 'ai.error.sessionNotFound',
            },
          };
          socket.emit('chat:response', errorMsg);
          return;
        }

        // Reject messages to completed or abandoned conversations
        if (existingSession.status !== 'active') {
          const errorMsg: AiChatServerMessage = {
            type: 'error',
            sessionId,
            messageId: randomUUID(),
            error: {
              code: 'SESSION_CLOSED',
              message: 'Chat session is no longer active',
              messageKey: 'ai.error.sessionClosed',
            },
          };
          socket.emit('chat:response', errorMsg);
          return;
        }
      }
    }

    // Set up abort controller for in-flight request tracking
    const abortController = new AbortController();
    let controllers = this.inflightRequests.get(socket.id);
    if (!controllers) {
      controllers = new Set();
      this.inflightRequests.set(socket.id, controllers);
    }
    controllers.add(abortController);

    const messageId = randomUUID();

    try {
      // 7.3: Build AI request with page context passed through AiRequestContext
      const aiRequest: AiRequest = {
        intent: 'chat',
        userMessage: msg.content,
        conversationId: sessionId,
        stream: true,
        context: {
          userId: authData.userId,
          companyId: authData.companyId,
          tenantId: authData.tenantId,
          currentPage: msg.currentPage,
          currentEntityType: msg.currentEntityType,
          currentEntityId: msg.currentEntityId,
          locale: socket.handshake.headers['accept-language']?.split(',')[0]?.trim() || 'en-GB',
        },
        entityMentions: msg.entityMentions,
      };

      // Stream response chunks from orchestrator
      for await (const chunk of orchestrator.processStream(aiRequest)) {
        // Check if request was aborted (client disconnect)
        if (abortController.signal.aborted) {
          this.logger.info(
            { socketId: socket.id, userId: authData.userId },
            'Streaming aborted due to client disconnect — message persistence handled by orchestrator',
          );
          break;
        }

        this.forwardChunk(socket, sessionId, messageId, chunk);
      }

      // 7.1: Auto-generate title from first message for new sessions
      if (isNewSession && chatSessionService && msg.content) {
        try {
          await chatSessionService.generateTitle(
            sessionId,
            msg.content,
            authData.userId,
            authData.companyId,
          );
        } catch (error) {
          // Title generation failure is non-critical — log and continue
          this.logger.warn(
            { error: (error as Error).message, sessionId },
            'Failed to auto-generate session title',
          );
        }
      }
    } catch (error) {
      // IMP-006: AI failure must not crash the socket — send error message
      this.logger.error(
        { error: (error as Error).message, userId: authData.userId, socketId: socket.id },
        'Error processing WebSocket chat message',
      );

      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId,
        messageId,
        error: {
          code: 'AI_SERVICE_ERROR',
          message: 'An unexpected error occurred with the AI service',
          messageKey: 'ai.error.serviceError',
        },
      };
      socket.emit('chat:response', errorMsg);
    } finally {
      // Clean up this specific controller from in-flight tracking
      const activeControllers = this.inflightRequests.get(socket.id);
      if (activeControllers) {
        activeControllers.delete(abortController);
        if (activeControllers.size === 0) {
          this.inflightRequests.delete(socket.id);
        }
      }
    }
  }

  /**
   * Forward an AiStreamChunk from the orchestrator as a server message.
   */
  private forwardChunk(
    socket: Socket,
    sessionId: string,
    messageId: string,
    chunk: AiStreamChunk,
  ): void {
    switch (chunk.type) {
      case 'content_delta': {
        const streamChunk: AiChatServerMessage = {
          type: 'stream_chunk',
          sessionId,
          messageId,
          content: chunk.content ?? '',
        };
        socket.emit('chat:response', streamChunk);
        break;
      }

      case 'done': {
        const streamEnd: AiChatServerMessage = {
          type: 'stream_end',
          sessionId,
          messageId,
          usage: chunk.usage,
        };
        socket.emit('chat:response', streamEnd);
        break;
      }

      case 'error': {
        const errorMsg: AiChatServerMessage = {
          type: 'error',
          sessionId,
          messageId,
          error: {
            code: 'AI_SERVICE_ERROR',
            message: chunk.error ?? 'AI processing error',
            messageKey: 'ai.error.serviceError',
          },
        };
        socket.emit('chat:response', errorMsg);
        break;
      }

      case 'action_proposal': {
        const proposalMsg: AiChatServerMessage = {
          type: 'action_proposal',
          sessionId,
          messageId,
          action: chunk.action
            ? {
                id: chunk.action.id,
                type: chunk.action.type,
                description: chunk.action.description,
                entityType: chunk.action.entityType,
                previewData: chunk.action.previewData,
                confidence: chunk.action.confidence,
              }
            : undefined,
        };
        socket.emit('chat:response', proposalMsg);
        break;
      }

      // tool_use_delta — not forwarded to client (internal orchestrator concern)
    }
  }

  /**
   * Handle action_confirm messages (BR-COM-013, IMP-005).
   * Looks up the staged proposal, verifies ownership, and executes via ActionExecutor.
   */
  private async handleActionConfirm(
    socket: Socket,
    authData: AuthenticatedSocketData,
    msg: { sessionId: string; actionId: string; content?: string },
  ): Promise<void> {
    if (!this.actionPlanner) {
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: msg.sessionId,
        messageId: randomUUID(),
        error: {
          code: 'AI_DEGRADED',
          message: 'Action execution is not available',
          messageKey: 'ai.error.degraded',
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    // Verify proposal exists first (non-destructive lookup)
    const peeked = this.actionPlanner.getProposal(msg.actionId);
    if (!peeked) {
      const err = new AiActionNotFoundError(msg.actionId);
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: msg.sessionId,
        messageId: randomUUID(),
        error: {
          code: err.code,
          message: err.message,
          messageKey: err.messageKey,
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    // Verify ownership BEFORE removing — proposal must belong to the requesting user's session and user
    if (peeked.conversationId !== msg.sessionId || peeked.userId !== authData.userId) {
      const err = new AiActionForbiddenError();
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: msg.sessionId,
        messageId: randomUUID(),
        error: {
          code: err.code,
          message: err.message,
          messageKey: err.messageKey,
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    // Now atomically take the proposal (get + remove) to prevent double-confirm race conditions
    const proposalResult = this.actionPlanner.takeProposal(msg.actionId);
    if (!proposalResult) {
      // Race: another request confirmed/rejected between peek and take
      const err = new AiActionNotFoundError(msg.actionId);
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: msg.sessionId,
        messageId: randomUUID(),
        error: {
          code: err.code,
          message: err.message,
          messageKey: err.messageKey,
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    if (!this.actionExecutor) {
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: msg.sessionId,
        messageId: randomUUID(),
        error: {
          code: 'AI_DEGRADED',
          message: 'Action execution service is not available',
          messageKey: 'ai.error.degraded',
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    try {
      const result = await this.actionExecutor.execute({
        proposal: proposalResult.proposal,
        conversationId: proposalResult.conversationId,
        agentId: proposalResult.agentId,
        userId: authData.userId,
        companyId: authData.companyId,
      });

      if (result.success) {
        const successMsg: AiChatServerMessage = {
          type: 'record_created',
          sessionId: msg.sessionId,
          messageId: randomUUID(),
          record: {
            entityType: result.entityType!,
            entityId: result.entityId!,
            displayRef: result.displayRef!,
          },
        };
        socket.emit('chat:response', successMsg);

        // Persist confirmation in conversation history (best-effort)
        await this.persistActionMessage(
          msg.sessionId,
          'user',
          `Confirmed action: ${proposalResult.proposal.description}`,
        );
      } else {
        const errorMsg: AiChatServerMessage = {
          type: 'error',
          sessionId: msg.sessionId,
          messageId: randomUUID(),
          error: {
            code: result.error?.code ?? 'ACTION_FAILED',
            message: result.error?.message ?? 'Action execution failed',
            messageKey: 'ai.error.actionFailed',
          },
        };
        socket.emit('chat:response', errorMsg);
      }
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message, actionId: msg.actionId, userId: authData.userId },
        'Error executing confirmed action',
      );

      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: msg.sessionId,
        messageId: randomUUID(),
        error: {
          code: 'AI_SERVICE_ERROR',
          message: 'An error occurred while executing the action',
          messageKey: 'ai.error.serviceError',
        },
      };
      socket.emit('chat:response', errorMsg);
    }
  }

  /**
   * Handle action_reject messages.
   * Removes the proposal from staging, acknowledges, and persists the rejection.
   */
  private async handleActionReject(
    socket: Socket,
    authData: AuthenticatedSocketData,
    msg: { sessionId: string; actionId: string; content?: string },
  ): Promise<void> {
    if (!this.actionPlanner) {
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: msg.sessionId,
        messageId: randomUUID(),
        error: {
          code: 'AI_DEGRADED',
          message: 'Action execution is not available',
          messageKey: 'ai.error.degraded',
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    // Verify proposal exists first (non-destructive lookup)
    const peeked = this.actionPlanner.getProposal(msg.actionId);
    if (!peeked) {
      const err = new AiActionNotFoundError(msg.actionId);
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: msg.sessionId,
        messageId: randomUUID(),
        error: {
          code: err.code,
          message: err.message,
          messageKey: err.messageKey,
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    // Verify ownership BEFORE removing — proposal must belong to the requesting user's session and user
    if (peeked.conversationId !== msg.sessionId || peeked.userId !== authData.userId) {
      const err = new AiActionForbiddenError();
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: msg.sessionId,
        messageId: randomUUID(),
        error: {
          code: err.code,
          message: err.message,
          messageKey: err.messageKey,
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    // Now atomically take the proposal (get + remove) to prevent race conditions
    const proposalResult = this.actionPlanner.takeProposal(msg.actionId);
    if (!proposalResult) {
      // Race: another request confirmed/rejected between peek and take
      const err = new AiActionNotFoundError(msg.actionId);
      const errorMsg: AiChatServerMessage = {
        type: 'error',
        sessionId: msg.sessionId,
        messageId: randomUUID(),
        error: {
          code: err.code,
          message: err.message,
          messageKey: err.messageKey,
        },
      };
      socket.emit('chat:response', errorMsg);
      return;
    }

    // Acknowledge rejection
    const ackMsg: AiChatServerMessage = {
      type: 'text',
      sessionId: msg.sessionId,
      messageId: randomUUID(),
      content: 'Action cancelled. No changes were made.',
      messageKey: 'ai.action.rejectionAcknowledged',
    };
    socket.emit('chat:response', ackMsg);

    // Persist rejection in conversation history (best-effort)
    const reason = msg.content ? ` Reason: ${msg.content}` : '';
    await this.persistActionMessage(
      msg.sessionId,
      'user',
      `Rejected action: ${proposalResult.proposal.description}.${reason}`,
    );

    this.logger.info(
      {
        actionId: msg.actionId,
        actionType: proposalResult.proposal.type,
        userId: authData.userId,
        reason: msg.content ?? '',
      },
      'Action proposal rejected by user',
    );
  }

  /**
   * Persist an action confirmation/rejection as an AiMessage in the conversation.
   * Best-effort — errors are logged but not propagated (per NFR22).
   */
  private async persistActionMessage(
    conversationId: string,
    role: string,
    content: string,
  ): Promise<void> {
    try {
      await tenantPrisma.aiMessage.create({
        data: {
          id: randomUUID(),
          conversationId,
          role,
          content,
        },
      });
    } catch (error) {
      this.logger.warn(
        { error: (error as Error).message, conversationId },
        'Failed to persist action message (best-effort)',
      );
    }
  }

  /**
   * Graceful shutdown — disconnect all sockets and close the server.
   */
  async close(): Promise<void> {
    if (!this.io) return;

    // Abort all in-flight AI requests
    for (const [, controllers] of this.inflightRequests) {
      for (const controller of controllers) {
        controller.abort();
      }
    }
    this.inflightRequests.clear();

    // Clear rate-limit state to prevent stale data across restarts
    this.messageTimestamps.clear();

    // Stop ActionPlanner cleanup timer
    if (this.actionPlanner) {
      this.actionPlanner.destroy();
    }

    await new Promise<void>((resolve) => {
      this.io!.close(() => {
        this.logger.info('WebSocket server closed');
        resolve();
      });
    });

    this.io = null;
  }

  /** Expose the Socket.io server instance for testing */
  getServer(): SocketServer | null {
    return this.io;
  }
}
