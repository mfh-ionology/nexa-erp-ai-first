import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

/** POST /ai/chat/sessions — create new session */
export const createSessionBodySchema = z.object({
  channel: z.enum(['web_chat', 'mobile_chat', 'api']).default('web_chat'),
  agentId: z.string().uuid().optional(),
});

/** GET /ai/chat/history — list conversations */
export const listSessionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET /ai/chat/history/:sessionId — params */
export const getSessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

/** GET /ai/chat/history/:sessionId — query */
export const getSessionQuerySchema = z.object({
  messageLimit: z.coerce.number().int().min(1).max(200).default(50),
  messageCursor: z.string().optional(),
});

/** POST /ai/chat/sessions/:sessionId/end — params */
export const endSessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const sessionSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  status: z.string(),
  channel: z.string(),
  startedAt: z.string(),
  lastMessageAt: z.string().nullable(),
  messageCount: z.number(),
});

export const sessionDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  status: z.string(),
  channel: z.string(),
  agentId: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  messages: z.array(z.object({
    id: z.string().uuid(),
    role: z.string(),
    content: z.string(),
    confidence: z.number().nullable(),
    createdAt: z.string(),
  })),
  nextMessageCursor: z.string().nullable(),
});

export const sessionCreatedSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  channel: z.string(),
  startedAt: z.string(),
  title: z.string().nullable(),
});
