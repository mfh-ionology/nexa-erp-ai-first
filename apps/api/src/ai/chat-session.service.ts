import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AiConversationSummary {
  id: string;
  title: string | null;
  status: string;
  channel: string;
  startedAt: string;
  lastMessageAt: string | null;
  messageCount: number;
}

export interface AiConversationDetail {
  id: string;
  title: string | null;
  status: string;
  channel: string;
  agentId: string | null;
  startedAt: string;
  endedAt: string | null;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    confidence: number | null;
    createdAt: string;
  }>;
  nextMessageCursor: string | null;
}

export interface AiConversationWithMeta {
  id: string;
  status: string;
  channel: string;
  startedAt: string;
  title: string | null;
}

// ─── Service ────────────────────────────────────────────────────────────────

export type SessionEndCallback = (conversationId: string) => void | Promise<void>;

export class ChatSessionService {
  private onSessionEndCallbacks: SessionEndCallback[] = [];

  constructor(
    private db: PrismaClient,
    private logger: Logger,
  ) {}

  /**
   * Register a callback to be invoked when a session ends.
   * Used by ConversationSummaryService to trigger summarisation.
   * Callbacks are fire-and-forget — failures are logged but do not block session end.
   */
  onSessionEnd(callback: SessionEndCallback): void {
    this.onSessionEndCallbacks.push(callback);
  }

  /**
   * Create a new chat session (AiConversation).
   */
  async createSession(params: {
    userId: string;
    companyId: string;
    channel: string;
    agentId?: string;
  }): Promise<AiConversationWithMeta> {
    const now = new Date();
    const conversation = await this.db.aiConversation.create({
      data: {
        id: randomUUID(),
        userId: params.userId,
        companyId: params.companyId,
        channel: params.channel,
        agentId: params.agentId ?? null,
        status: 'active',
        startedAt: now,
      },
    });

    this.logger.info(
      { conversationId: conversation.id, userId: params.userId, companyId: params.companyId },
      'Chat session created',
    );

    return {
      id: conversation.id,
      status: conversation.status,
      channel: conversation.channel,
      startedAt: conversation.startedAt.toISOString(),
      title: conversation.title ?? null,
    };
  }

  /**
   * List user's conversations (most recent first), with cursor pagination.
   *
   * Uses a compound cursor (startedAt|id) to guarantee no records are skipped
   * when multiple conversations share the same startedAt timestamp.
   * Returns summary info including the last message timestamp and message count.
   */
  async listSessions(params: {
    userId: string;
    companyId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ data: AiConversationSummary[]; nextCursor: string | null }> {
    const limit = params.limit ?? 20;

    // Build cursor condition using compound cursor (startedAt|id) for deterministic pagination.
    // For DESC ordering: fetch rows where (startedAt < cursorDate) OR (startedAt == cursorDate AND id < cursorId)
    let cursorCondition = {};
    if (params.cursor) {
      const parsed = parseCompoundCursor(params.cursor);
      if (!parsed) {
        // Invalid cursor — return empty result rather than query with invalid data
        return { data: [], nextCursor: null };
      }
      cursorCondition = {
        OR: [{ startedAt: { lt: parsed.date } }, { startedAt: parsed.date, id: { lt: parsed.id } }],
      };
    }

    const conversations = await this.db.aiConversation.findMany({
      where: {
        userId: params.userId,
        companyId: params.companyId,
        status: { not: 'abandoned' },
        ...cursorCondition,
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1, // Fetch one extra to determine if there's a next page
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    const hasMore = conversations.length > limit;
    const items = hasMore ? conversations.slice(0, limit) : conversations;

    const data: AiConversationSummary[] = items.map((conv: any) => ({
      id: conv.id,
      title: conv.title ?? null,
      status: conv.status,
      channel: conv.channel,
      startedAt: conv.startedAt.toISOString(),
      lastMessageAt: conv.messages[0]?.createdAt?.toISOString() ?? null,
      messageCount: conv._count.messages,
    }));

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? encodeCompoundCursor(lastItem.startedAt, lastItem.id) : null;

    return { data, nextCursor };
  }

  /**
   * Get a single conversation with its messages.
   *
   * Security: verifies the conversation belongs to the requesting userId
   * AND companyId to prevent cross-user/cross-tenant access.
   */
  async getSession(params: {
    sessionId: string;
    userId: string;
    companyId: string;
    messageLimit?: number;
    messageCursor?: string;
  }): Promise<AiConversationDetail | null> {
    const messageLimit = params.messageLimit ?? 50;

    // Verify ownership: must match both userId and companyId
    const conversation = await this.db.aiConversation.findFirst({
      where: {
        id: params.sessionId,
        userId: params.userId,
        companyId: params.companyId,
      },
    });

    if (!conversation) {
      return null;
    }

    // Build message cursor condition
    let messageCursorCondition = {};
    if (params.messageCursor) {
      const cursorDate = parseCursorDate(params.messageCursor);
      if (!cursorDate) {
        // Invalid cursor — return conversation with no messages rather than query with invalid date
        return {
          id: conversation.id,
          title: conversation.title ?? null,
          status: conversation.status,
          channel: conversation.channel,
          agentId: conversation.agentId,
          startedAt: conversation.startedAt.toISOString(),
          endedAt: conversation.endedAt?.toISOString() ?? null,
          messages: [],
          nextMessageCursor: null,
        };
      }
      messageCursorCondition = { createdAt: { gt: cursorDate } };
    }

    const messages = await this.db.aiMessage.findMany({
      where: {
        conversationId: params.sessionId,
        ...messageCursorCondition,
      },
      orderBy: { createdAt: 'asc' },
      take: messageLimit + 1, // Extra to check next page
    });

    const hasMoreMessages = messages.length > messageLimit;
    const messageItems = hasMoreMessages ? messages.slice(0, messageLimit) : messages;

    const nextMessageCursor = hasMoreMessages
      ? messageItems[messageItems.length - 1]!.createdAt.toISOString()
      : null;

    return {
      id: conversation.id,
      title: conversation.title ?? null,
      status: conversation.status,
      channel: conversation.channel,
      agentId: conversation.agentId,
      startedAt: conversation.startedAt.toISOString(),
      endedAt: conversation.endedAt?.toISOString() ?? null,
      messages: messageItems.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        confidence: m.confidence != null ? Number(m.confidence) : null,
        createdAt: m.createdAt.toISOString(),
      })),
      nextMessageCursor,
    };
  }

  /**
   * Auto-generate a title from the first user message.
   *
   * Truncates at word boundary (up to 100 chars), appends "..." if truncated.
   * Updates the conversation's title field.
   *
   * Security: uses updateMany with userId + companyId to prevent cross-tenant title overwrites.
   */
  async generateTitle(
    conversationId: string,
    firstMessage: string,
    userId: string,
    companyId: string,
  ): Promise<string> {
    const title = truncateAtWordBoundary(firstMessage, 100);

    await this.db.aiConversation.updateMany({
      where: { id: conversationId, userId, companyId },
      data: { title },
    });

    return title;
  }

  /**
   * End a conversation — set status to 'completed' and endedAt to now.
   *
   * Security: only allows if conversation belongs to requesting user + company.
   */
  async endSession(sessionId: string, userId: string, companyId: string): Promise<void> {
    const conversation = await this.db.aiConversation.findFirst({
      where: { id: sessionId, userId, companyId },
      select: { id: true },
    });

    if (!conversation) {
      this.logger.warn(
        { sessionId, userId, companyId },
        'Cannot end session: not found or not owned by user',
      );
      return;
    }

    await this.db.aiConversation.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        endedAt: new Date(),
      },
    });

    this.logger.info({ sessionId, userId, companyId }, 'Chat session ended');

    // Fire-and-forget: invoke session end callbacks (e.g., conversation summarisation)
    for (const callback of this.onSessionEndCallbacks) {
      try {
        const result = callback(sessionId);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err) => {
            this.logger.warn(
              { sessionId, error: (err as Error).message },
              'Session end callback failed (non-blocking)',
            );
          });
        }
      } catch (err) {
        this.logger.warn(
          { sessionId, error: (err as Error).message },
          'Session end callback threw (non-blocking)',
        );
      }
    }
  }
}

// ─── Cursor Helpers ──────────────────────────────────────────────────────────

/** Compound cursor separator */
const CURSOR_SEP = '|';

/**
 * Encode a compound cursor from startedAt + id.
 * Format: "ISO_DATE|UUID"
 */
function encodeCompoundCursor(startedAt: Date, id: string): string {
  return `${startedAt.toISOString()}${CURSOR_SEP}${id}`;
}

/**
 * Parse and validate a compound cursor string.
 * Returns { date, id } if valid, or null if the cursor is malformed.
 * Supports legacy single-date cursors for backwards compatibility.
 */
function parseCompoundCursor(value: string): { date: Date; id: string } | null {
  const sepIndex = value.indexOf(CURSOR_SEP);
  if (sepIndex === -1) {
    // Legacy single-date cursor — treat id as empty string (will match nothing with lt)
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return { date, id: '' };
  }

  const datePart = value.slice(0, sepIndex);
  const idPart = value.slice(sepIndex + 1);

  const date = new Date(datePart);
  if (isNaN(date.getTime()) || !idPart) return null;

  return { date, id: idPart };
}

/**
 * Parse and validate a cursor date string (used for message cursors).
 * Returns a Date if valid, or null if the string is not a valid ISO date.
 */
function parseCursorDate(value: string): Date | null {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Truncate text at word boundary, up to maxLength.
 * Appends "..." if truncated.
 */
export function truncateAtWordBoundary(text: string, maxLength: number): string {
  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  // Find last space before maxLength
  const truncated = trimmed.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  // If no space found, just cut at maxLength
  const cutPoint = lastSpace > 0 ? lastSpace : maxLength;

  return trimmed.slice(0, cutPoint) + '...';
}
