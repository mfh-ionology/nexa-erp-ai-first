import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockAiGateway, mockEventBus, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiConversation: {
      findUnique: vi.fn(),
    },
    aiMemorySettings: {
      findUnique: vi.fn(),
    },
    aiConversationSummary: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    aiMessage: {
      findMany: vi.fn(),
    },
  },
  mockAiGateway: {
    complete: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { ConversationSummaryService } from './conversation-summary.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultUserId = 'user-1';
const defaultCompanyId = 'company-1';
const defaultConvId = 'conv-1';

function createService() {
  return new ConversationSummaryService(
    mockPrisma as any,
    mockAiGateway as any,
    mockEventBus as any,
    mockLogger as any,
  );
}

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: defaultConvId,
    userId: defaultUserId,
    companyId: defaultCompanyId,
    status: 'completed',
    ...overrides,
  };
}

function makeMessage(role: string, content: string) {
  return {
    role,
    content,
    createdAt: new Date('2026-02-20T10:00:00.000Z'),
  };
}

function makeSummaryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'summary-1',
    userId: defaultUserId,
    companyId: defaultCompanyId,
    conversationId: defaultConvId,
    summary: 'User discussed quarterly AR review.',
    topics: ['AR', 'quarterly review'],
    decisionsCount: 2,
    actionsCount: 1,
    createdAt: new Date('2026-02-20T11:00:00.000Z'),
    ...overrides,
  };
}

const validLlmResponse = JSON.stringify({
  summary: 'User discussed quarterly AR review and approved write-offs.',
  topics: ['AR', 'quarterly review', 'write-offs'],
  decisionsCount: 2,
  actionsCount: 1,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConversationSummaryService', () => {
  let service: ConversationSummaryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();

    // Default happy-path mocks
    mockPrisma.aiConversation.findUnique.mockResolvedValue(makeConversation());
    mockPrisma.aiMemorySettings.findUnique.mockResolvedValue(null); // no settings → enabled by default
    mockPrisma.aiConversationSummary.findFirst.mockResolvedValue(null); // no existing summary
    mockPrisma.aiMessage.findMany.mockResolvedValue([
      makeMessage('user', 'Show me overdue invoices'),
      makeMessage('assistant', 'Here are 5 overdue invoices...'),
    ]);
    mockAiGateway.complete.mockResolvedValue({ content: validLlmResponse });
    mockPrisma.aiConversationSummary.create.mockResolvedValue(makeSummaryRecord());
  });

  // ─── Happy path ────────────────────────────────────────────────────────

  describe('summariseConversation() — happy path', () => {
    it('creates a summary from conversation messages', async () => {
      const result = await service.summariseConversation(defaultConvId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('summary-1');
      expect(result!.summary).toBe('User discussed quarterly AR review.');
      expect(result!.topics).toEqual(['AR', 'quarterly review']);
    });

    it('calls AI Gateway with correct prompt and routing tags', async () => {
      await service.summariseConversation(defaultConvId);

      expect(mockAiGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: defaultCompanyId,
          userId: defaultUserId,
          featureKey: 'ai.memory_management',
          routingTags: ['cheap'],
          maxOutputTokens: 600,
          temperature: 0.3,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        }),
      );
    });

    it('stores the summary in the database', async () => {
      await service.summariseConversation(defaultConvId);

      expect(mockPrisma.aiConversationSummary.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: defaultUserId,
          companyId: defaultCompanyId,
          conversationId: defaultConvId,
          summary: 'User discussed quarterly AR review and approved write-offs.',
          topics: ['AR', 'quarterly review', 'write-offs'],
          decisionsCount: 2,
          actionsCount: 1,
        }),
      });
    });

    it('emits ai.conversation.summarised event', async () => {
      await service.summariseConversation(defaultConvId);

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.conversation.summarised', {
        summaryId: 'summary-1',
        conversationId: defaultConvId,
        userId: defaultUserId,
        companyId: defaultCompanyId,
      });
    });
  });

  // ─── Memory settings (disabled) ────────────────────────────────────────

  describe('memory settings — disabled', () => {
    it('skips summarisation when memory is disabled', async () => {
      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue({
        isEnabled: false,
      });

      const result = await service.summariseConversation(defaultConvId);

      expect(result).toBeNull();
      expect(mockAiGateway.complete).not.toHaveBeenCalled();
      expect(mockPrisma.aiConversationSummary.create).not.toHaveBeenCalled();
    });

    it('proceeds when memory settings exist and isEnabled is true', async () => {
      mockPrisma.aiMemorySettings.findUnique.mockResolvedValue({
        isEnabled: true,
      });

      const result = await service.summariseConversation(defaultConvId);

      expect(result).not.toBeNull();
    });
  });

  // ─── Guard conditions ─────────────────────────────────────────────────

  describe('guard conditions', () => {
    it('returns null when conversation not found', async () => {
      mockPrisma.aiConversation.findUnique.mockResolvedValue(null);

      const result = await service.summariseConversation('nonexistent');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'nonexistent' }),
        'Cannot summarise: conversation not found',
      );
    });

    it('returns null when summary already exists (idempotent)', async () => {
      mockPrisma.aiConversationSummary.findFirst.mockResolvedValue({
        id: 'existing-summary',
      });

      const result = await service.summariseConversation(defaultConvId);

      expect(result).toBeNull();
      expect(mockAiGateway.complete).not.toHaveBeenCalled();
    });

    it('returns null when conversation has no messages', async () => {
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);

      const result = await service.summariseConversation(defaultConvId);

      expect(result).toBeNull();
      expect(mockAiGateway.complete).not.toHaveBeenCalled();
    });
  });

  // ─── AI Gateway error handling ─────────────────────────────────────────

  describe('AI Gateway error handling', () => {
    it('returns null when AI Gateway throws', async () => {
      mockAiGateway.complete.mockRejectedValue(new Error('Provider unavailable'));

      const result = await service.summariseConversation(defaultConvId);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Provider unavailable' }),
        'AI Gateway summarisation call failed',
      );
    });

    it('returns null when LLM returns invalid JSON', async () => {
      mockAiGateway.complete.mockResolvedValue({ content: 'Not JSON at all' });

      const result = await service.summariseConversation(defaultConvId);

      expect(result).toBeNull();
      expect(mockPrisma.aiConversationSummary.create).not.toHaveBeenCalled();
    });

    it('returns null when LLM returns JSON without required summary field', async () => {
      mockAiGateway.complete.mockResolvedValue({
        content: JSON.stringify({ topics: ['test'] }),
      });

      const result = await service.summariseConversation(defaultConvId);

      expect(result).toBeNull();
    });

    it('handles LLM response wrapped in markdown code fences', async () => {
      mockAiGateway.complete.mockResolvedValue({
        content: '```json\n' + validLlmResponse + '\n```',
      });

      await service.summariseConversation(defaultConvId);

      expect(mockPrisma.aiConversationSummary.create).toHaveBeenCalled();
    });
  });

  // ─── Token budget enforcement ──────────────────────────────────────────

  describe('token budget enforcement', () => {
    it('truncates summary content longer than 2000 chars', async () => {
      const longSummary = 'A'.repeat(3000);
      mockAiGateway.complete.mockResolvedValue({
        content: JSON.stringify({
          summary: longSummary,
          topics: ['test'],
          decisionsCount: 0,
          actionsCount: 0,
        }),
      });

      await service.summariseConversation(defaultConvId);

      expect(mockPrisma.aiConversationSummary.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          summary: expect.any(String),
        }),
      });

      const createdData = mockPrisma.aiConversationSummary.create.mock.calls[0]![0].data;
      expect(createdData.summary.length).toBeLessThanOrEqual(2000);
    });

    it('caps topics to max 5', async () => {
      mockAiGateway.complete.mockResolvedValue({
        content: JSON.stringify({
          summary: 'Test summary',
          topics: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'],
          decisionsCount: 0,
          actionsCount: 0,
        }),
      });

      await service.summariseConversation(defaultConvId);

      const createdData = mockPrisma.aiConversationSummary.create.mock.calls[0]![0].data;
      expect(createdData.topics).toHaveLength(5);
    });
  });

  // ─── Parsing edge cases ────────────────────────────────────────────────

  describe('parsing edge cases', () => {
    it('defaults decisionsCount and actionsCount to 0 when not numbers', async () => {
      mockAiGateway.complete.mockResolvedValue({
        content: JSON.stringify({
          summary: 'Test',
          topics: [],
          decisionsCount: 'many',
          actionsCount: null,
        }),
      });

      await service.summariseConversation(defaultConvId);

      const createdData = mockPrisma.aiConversationSummary.create.mock.calls[0]![0].data;
      expect(createdData.decisionsCount).toBe(0);
      expect(createdData.actionsCount).toBe(0);
    });

    it('filters non-string topics', async () => {
      mockAiGateway.complete.mockResolvedValue({
        content: JSON.stringify({
          summary: 'Test',
          topics: ['valid', 123, null, 'also-valid'],
          decisionsCount: 0,
          actionsCount: 0,
        }),
      });

      await service.summariseConversation(defaultConvId);

      const createdData = mockPrisma.aiConversationSummary.create.mock.calls[0]![0].data;
      expect(createdData.topics).toEqual(['valid', 'also-valid']);
    });
  });
});
