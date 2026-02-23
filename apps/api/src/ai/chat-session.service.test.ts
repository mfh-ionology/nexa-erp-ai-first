import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiConversation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    aiMessage: {
      findMany: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock crypto.randomUUID for deterministic IDs
let uuidCounter = 0;
vi.mock('node:crypto', () => ({
  randomUUID: () => `test-uuid-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { ChatSessionService, truncateAtWordBoundary } from './chat-session.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new ChatSessionService(
    mockPrisma as any,
    mockLogger as any,
  );
}

const defaultUserId = 'user-1';
const defaultCompanyId = 'company-1';

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv-1',
    userId: defaultUserId,
    companyId: defaultCompanyId,
    agentId: null,
    channel: 'web_chat',
    status: 'active',
    title: null,
    startedAt: new Date('2026-02-20T10:00:00.000Z'),
    endedAt: null,
    createdAt: new Date('2026-02-20T10:00:00.000Z'),
    updatedAt: new Date('2026-02-20T10:00:00.000Z'),
    ...overrides,
  };
}

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'Hello there',
    confidence: null,
    createdAt: new Date('2026-02-20T10:01:00.000Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatSessionService', () => {
  let service: ChatSessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    service = createService();
  });

  // ─── createSession ──────────────────────────────────────────────────────

  describe('createSession()', () => {
    it('creates an AiConversation with correct userId, companyId, channel', async () => {
      const created = makeConversation();
      mockPrisma.aiConversation.create.mockResolvedValue(created);

      const result = await service.createSession({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        channel: 'web_chat',
      });

      expect(mockPrisma.aiConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'test-uuid-1',
          userId: defaultUserId,
          companyId: defaultCompanyId,
          channel: 'web_chat',
          status: 'active',
          agentId: null,
        }),
      });

      expect(result.id).toBe('conv-1');
      expect(result.status).toBe('active');
      expect(result.channel).toBe('web_chat');
      expect(result.startedAt).toBe('2026-02-20T10:00:00.000Z');
      expect(result.title).toBeNull();
    });

    it('passes agentId when provided', async () => {
      const created = makeConversation({ agentId: 'agent-1' });
      mockPrisma.aiConversation.create.mockResolvedValue(created);

      await service.createSession({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        channel: 'web_chat',
        agentId: 'agent-1',
      });

      expect(mockPrisma.aiConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentId: 'agent-1',
        }),
      });
    });

    it('logs session creation', async () => {
      mockPrisma.aiConversation.create.mockResolvedValue(makeConversation());

      await service.createSession({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        channel: 'web_chat',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-1',
          userId: defaultUserId,
          companyId: defaultCompanyId,
        }),
        'Chat session created',
      );
    });
  });

  // ─── listSessions ──────────────────────────────────────────────────────

  describe('listSessions()', () => {
    it('returns conversations in descending startedAt order', async () => {
      const conv1 = makeConversation({
        id: 'conv-1',
        startedAt: new Date('2026-02-20T10:00:00.000Z'),
        _count: { messages: 3 },
        messages: [{ createdAt: new Date('2026-02-20T10:05:00.000Z') }],
      });
      const conv2 = makeConversation({
        id: 'conv-2',
        startedAt: new Date('2026-02-19T10:00:00.000Z'),
        _count: { messages: 1 },
        messages: [{ createdAt: new Date('2026-02-19T10:02:00.000Z') }],
      });

      mockPrisma.aiConversation.findMany.mockResolvedValue([conv1, conv2]);

      const result = await service.listSessions({
        userId: defaultUserId,
        companyId: defaultCompanyId,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]!.id).toBe('conv-1');
      expect(result.data[1]!.id).toBe('conv-2');
      expect(result.nextCursor).toBeNull();
    });

    it('only returns conversations for the requesting user + company', async () => {
      mockPrisma.aiConversation.findMany.mockResolvedValue([]);

      await service.listSessions({
        userId: defaultUserId,
        companyId: defaultCompanyId,
      });

      expect(mockPrisma.aiConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: defaultUserId,
            companyId: defaultCompanyId,
            status: { not: 'abandoned' },
          }),
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });

    it('returns summary with lastMessageAt and messageCount', async () => {
      const conv = makeConversation({
        _count: { messages: 5 },
        messages: [{ createdAt: new Date('2026-02-20T11:00:00.000Z') }],
      });
      mockPrisma.aiConversation.findMany.mockResolvedValue([conv]);

      const result = await service.listSessions({
        userId: defaultUserId,
        companyId: defaultCompanyId,
      });

      expect(result.data[0]!.messageCount).toBe(5);
      expect(result.data[0]!.lastMessageAt).toBe('2026-02-20T11:00:00.000Z');
    });

    it('returns null lastMessageAt when no messages exist', async () => {
      const conv = makeConversation({
        _count: { messages: 0 },
        messages: [],
      });
      mockPrisma.aiConversation.findMany.mockResolvedValue([conv]);

      const result = await service.listSessions({
        userId: defaultUserId,
        companyId: defaultCompanyId,
      });

      expect(result.data[0]!.lastMessageAt).toBeNull();
      expect(result.data[0]!.messageCount).toBe(0);
    });

    it('cursor pagination returns compound cursor (startedAt|id)', async () => {
      // Simulate limit=2, with 3 results → hasMore=true
      const convs = [
        makeConversation({
          id: 'conv-1',
          startedAt: new Date('2026-02-22T10:00:00.000Z'),
          _count: { messages: 2 },
          messages: [{ createdAt: new Date('2026-02-22T10:05:00.000Z') }],
        }),
        makeConversation({
          id: 'conv-2',
          startedAt: new Date('2026-02-21T10:00:00.000Z'),
          _count: { messages: 1 },
          messages: [{ createdAt: new Date('2026-02-21T10:02:00.000Z') }],
        }),
        makeConversation({
          id: 'conv-3',
          startedAt: new Date('2026-02-20T10:00:00.000Z'),
          _count: { messages: 0 },
          messages: [],
        }),
      ];
      mockPrisma.aiConversation.findMany.mockResolvedValue(convs);

      const result = await service.listSessions({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        limit: 2,
      });

      expect(result.data).toHaveLength(2);
      // Compound cursor: startedAt|id
      expect(result.nextCursor).toBe('2026-02-21T10:00:00.000Z|conv-2');

      // Verify it fetched limit+1
      expect(mockPrisma.aiConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3, // limit + 1
        }),
      );
    });

    it('applies compound cursor condition when cursor provided', async () => {
      mockPrisma.aiConversation.findMany.mockResolvedValue([]);

      await service.listSessions({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        cursor: '2026-02-21T10:00:00.000Z|conv-2',
      });

      expect(mockPrisma.aiConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { startedAt: { lt: new Date('2026-02-21T10:00:00.000Z') } },
              { startedAt: new Date('2026-02-21T10:00:00.000Z'), id: { lt: 'conv-2' } },
            ],
          }),
        }),
      );
    });

    it('uses default limit of 20', async () => {
      mockPrisma.aiConversation.findMany.mockResolvedValue([]);

      await service.listSessions({
        userId: defaultUserId,
        companyId: defaultCompanyId,
      });

      expect(mockPrisma.aiConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 21, // 20 + 1
        }),
      );
    });
  });

  // ─── getSession ─────────────────────────────────────────────────────────

  describe('getSession()', () => {
    it('returns conversation with messages', async () => {
      const conv = makeConversation();
      mockPrisma.aiConversation.findFirst.mockResolvedValue(conv);

      const messages = [
        makeMessage({
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date('2026-02-20T10:01:00.000Z'),
        }),
        makeMessage({
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          confidence: 0.95,
          createdAt: new Date('2026-02-20T10:01:01.000Z'),
        }),
      ];
      mockPrisma.aiMessage.findMany.mockResolvedValue(messages);

      const result = await service.getSession({
        sessionId: 'conv-1',
        userId: defaultUserId,
        companyId: defaultCompanyId,
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe('conv-1');
      expect(result!.status).toBe('active');
      expect(result!.messages).toHaveLength(2);
      expect(result!.messages[0]!.role).toBe('user');
      expect(result!.messages[0]!.content).toBe('Hello');
      expect(result!.messages[1]!.role).toBe('assistant');
      expect(result!.messages[1]!.confidence).toBe(0.95);
      expect(result!.nextMessageCursor).toBeNull();
    });

    it('returns null for non-existent conversation', async () => {
      mockPrisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await service.getSession({
        sessionId: 'nonexistent',
        userId: defaultUserId,
        companyId: defaultCompanyId,
      });

      expect(result).toBeNull();
    });

    it('returns null for other user\'s conversation (security)', async () => {
      mockPrisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await service.getSession({
        sessionId: 'conv-1',
        userId: 'other-user',
        companyId: defaultCompanyId,
      });

      expect(result).toBeNull();

      // Verify query includes both userId and companyId
      expect(mockPrisma.aiConversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-1',
          userId: 'other-user',
          companyId: defaultCompanyId,
        },
      });
    });

    it('returns null for other company\'s conversation (tenant isolation)', async () => {
      mockPrisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await service.getSession({
        sessionId: 'conv-1',
        userId: defaultUserId,
        companyId: 'other-company',
      });

      expect(result).toBeNull();
    });

    it('paginates messages using cursor', async () => {
      const conv = makeConversation();
      mockPrisma.aiConversation.findFirst.mockResolvedValue(conv);
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);

      await service.getSession({
        sessionId: 'conv-1',
        userId: defaultUserId,
        companyId: defaultCompanyId,
        messageCursor: '2026-02-20T10:01:00.000Z',
        messageLimit: 10,
      });

      expect(mockPrisma.aiMessage.findMany).toHaveBeenCalledWith({
        where: {
          conversationId: 'conv-1',
          createdAt: { gt: new Date('2026-02-20T10:01:00.000Z') },
        },
        orderBy: { createdAt: 'asc' },
        take: 11, // messageLimit + 1
      });
    });

    it('returns nextMessageCursor when more messages available', async () => {
      const conv = makeConversation();
      mockPrisma.aiConversation.findFirst.mockResolvedValue(conv);

      // 3 messages returned for limit=2 → has next page
      const messages = [
        makeMessage({ id: 'msg-1', createdAt: new Date('2026-02-20T10:01:00.000Z') }),
        makeMessage({ id: 'msg-2', createdAt: new Date('2026-02-20T10:02:00.000Z') }),
        makeMessage({ id: 'msg-3', createdAt: new Date('2026-02-20T10:03:00.000Z') }),
      ];
      mockPrisma.aiMessage.findMany.mockResolvedValue(messages);

      const result = await service.getSession({
        sessionId: 'conv-1',
        userId: defaultUserId,
        companyId: defaultCompanyId,
        messageLimit: 2,
      });

      expect(result!.messages).toHaveLength(2);
      expect(result!.nextMessageCursor).toBe('2026-02-20T10:02:00.000Z');
    });

    it('defaults to 50 message limit', async () => {
      const conv = makeConversation();
      mockPrisma.aiConversation.findFirst.mockResolvedValue(conv);
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);

      await service.getSession({
        sessionId: 'conv-1',
        userId: defaultUserId,
        companyId: defaultCompanyId,
      });

      expect(mockPrisma.aiMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 51, // 50 + 1
        }),
      );
    });
  });

  // ─── generateTitle ──────────────────────────────────────────────────────

  describe('generateTitle()', () => {
    it('generates title from short message with userId/companyId scoping', async () => {
      mockPrisma.aiConversation.updateMany.mockResolvedValue({ count: 1 });

      const title = await service.generateTitle('conv-1', 'Hello there', defaultUserId, defaultCompanyId);

      expect(title).toBe('Hello there');
      expect(mockPrisma.aiConversation.updateMany).toHaveBeenCalledWith({
        where: { id: 'conv-1', userId: defaultUserId, companyId: defaultCompanyId },
        data: { title: 'Hello there' },
      });
    });

    it('truncates long messages at word boundary', async () => {
      mockPrisma.aiConversation.updateMany.mockResolvedValue({ count: 1 });

      // Create a message longer than 100 chars
      const longMessage = 'This is a very long message that exceeds the maximum allowed title length of one hundred characters and should be truncated';
      const title = await service.generateTitle('conv-1', longMessage, defaultUserId, defaultCompanyId);

      expect(title.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(title).toMatch(/\.\.\.$/);
      // Should end with a complete word followed by "..." (not a partial word)
      // The word before "..." should be a full dictionary word from the original text
      expect(title).toMatch(/\s\w+\.\.\.$/); // Space + word + ellipsis
    });
  });

  // ─── endSession ─────────────────────────────────────────────────────────

  describe('endSession()', () => {
    it('sets status to completed and endedAt', async () => {
      mockPrisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.aiConversation.update.mockResolvedValue(makeConversation({
        status: 'completed',
        endedAt: new Date(),
      }));

      await service.endSession('conv-1', defaultUserId, defaultCompanyId);

      expect(mockPrisma.aiConversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: {
          status: 'completed',
          endedAt: expect.any(Date),
        },
      });
    });

    it('verifies ownership before ending session', async () => {
      mockPrisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.aiConversation.update.mockResolvedValue(makeConversation());

      await service.endSession('conv-1', defaultUserId, defaultCompanyId);

      expect(mockPrisma.aiConversation.findFirst).toHaveBeenCalledWith({
        where: { id: 'conv-1', userId: defaultUserId, companyId: defaultCompanyId },
        select: { id: true },
      });
    });

    it('does not update if conversation not found or not owned', async () => {
      mockPrisma.aiConversation.findFirst.mockResolvedValue(null);

      await service.endSession('conv-1', 'other-user', defaultCompanyId);

      expect(mockPrisma.aiConversation.update).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'conv-1' }),
        'Cannot end session: not found or not owned by user',
      );
    });

    it('logs session end', async () => {
      mockPrisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.aiConversation.update.mockResolvedValue(makeConversation());

      await service.endSession('conv-1', defaultUserId, defaultCompanyId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'conv-1',
          userId: defaultUserId,
          companyId: defaultCompanyId,
        }),
        'Chat session ended',
      );
    });
  });
});

// ─── truncateAtWordBoundary (exported helper) ──────────────────────────────

describe('truncateAtWordBoundary()', () => {
  it('returns short text unchanged', () => {
    expect(truncateAtWordBoundary('Hello', 100)).toBe('Hello');
  });

  it('truncates at word boundary for long text', () => {
    const text = 'The quick brown fox jumps over the lazy dog and continues running';
    const result = truncateAtWordBoundary(text, 30);
    expect(result).toBe('The quick brown fox jumps...');
    expect(result.length).toBeLessThanOrEqual(33); // 30 + "..."
  });

  it('appends ellipsis when truncated', () => {
    const text = 'A'.repeat(200);
    const result = truncateAtWordBoundary(text, 100);
    expect(result).toMatch(/\.\.\.$/);
  });

  it('handles text exactly at maxLength', () => {
    const text = 'A'.repeat(100);
    const result = truncateAtWordBoundary(text, 100);
    expect(result).toBe(text); // No truncation needed
  });

  it('trims whitespace', () => {
    expect(truncateAtWordBoundary('  Hello  ', 100)).toBe('Hello');
  });

  it('cuts at maxLength when no space found', () => {
    const text = 'A'.repeat(200); // No spaces
    const result = truncateAtWordBoundary(text, 50);
    expect(result).toBe('A'.repeat(50) + '...');
  });
});
