import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockRedis, mockLogger, mockEventBus, mockAiGateway, mockPromptManager, mockResponseParser } = vi.hoisted(() => ({
  mockPrisma: {
    aiAgent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    aiMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    aiConversation: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
  },
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
  },
  mockAiGateway: {
    complete: vi.fn(),
    stream: vi.fn(),
  },
  mockPromptManager: {
    loadPrompt: vi.fn(),
    resolveParameters: vi.fn(),
  },
  mockResponseParser: {
    parse: vi.fn(),
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

import { AiOrchestrator } from './orchestrator.js';
import type { AiAgentNotFoundError as _AiAgentNotFoundError } from './ai.errors.js';
import {
  AiQuotaExceededError,
  ProviderUnavailableError,
  ProviderError,
} from '@nexa/ai-gateway';
import type { AiRequest, AiResponse } from './ai.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createOrchestrator() {
  return new AiOrchestrator(
    mockAiGateway as any,
    mockPromptManager as any,
    mockResponseParser as any,
    mockPrisma as any,
    mockRedis as any,
    mockEventBus as any,
    mockLogger as any,
  );
}

const baseContext = {
  userId: 'user-1',
  companyId: 'company-1',
  tenantId: 'tenant-1',
  locale: 'en-GB',
  currentPage: '/ar/invoices',
};

function makeRequest(overrides: Partial<AiRequest> = {}): AiRequest {
  return {
    intent: 'chat',
    userMessage: 'Hello, can you help me?',
    context: baseContext,
    ...overrides,
  };
}

const mockAgent = {
  id: 'agent-1',
  name: 'chat-router',
  displayName: 'Chat Router',
  routingTags: ['standard'],
  promptId: 'prompt-1',
  tools: [],
  guardrails: {},
  triggerConfig: {},
  maxTurns: 10,
  isActive: true,
  prompt: {
    id: 'prompt-1',
    name: 'chat-router-prompt',
    systemPrompt: 'You are a helpful ERP assistant.',
    userTemplate: '{{message}}',
    parameters: {},
    isActive: true,
    activeVersion: 1,
  },
  model: {
    id: 'model-1',
    name: 'claude-sonnet-4-5',
    maxInputTokens: 200000,
  },
};

const mockInvoiceAgent = {
  ...mockAgent,
  id: 'agent-2',
  name: 'invoice-agent',
  triggerConfig: { keywords: ['invoice', 'billing'] },
  prompt: {
    ...mockAgent.prompt,
    name: 'invoice-prompt',
  },
};

const mockLoadedPrompt = {
  systemPrompt: 'You are a helpful ERP assistant.',
  userPrompt: 'Hello, can you help me?',
  promptId: 'prompt-1',
  promptVersion: 1,
  prompt: mockAgent.prompt,
};

const mockGatewayResponse = {
  content: 'Sure, I can help you with that!',
  usage: {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
  },
  model: 'claude-sonnet-4-5',
  provider: 'anthropic',
  finishReason: 'stop' as const,
  requestId: 'gw-req-1',
  latencyMs: 450,
  fallbackUsed: false,
  isByok: false,
  quotaPct: 25,
};

const mockParsedResponse: AiResponse = {
  type: 'text',
  messageId: 'parsed-msg-1',
  content: 'Sure, I can help you with that!',
  usage: { inputTokens: 100, outputTokens: 50, latencyMs: 0 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiOrchestrator', () => {
  let orchestrator: AiOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    orchestrator = createOrchestrator();

    // Default mocks for happy path
    mockPrisma.aiAgent.findUnique.mockResolvedValue(mockAgent);
    mockPromptManager.loadPrompt.mockResolvedValue(mockLoadedPrompt);
    mockPromptManager.resolveParameters.mockResolvedValue({
      systemPrompt: 'You are a helpful ERP assistant.',
      userPrompt: 'Hello, can you help me?',
    });
    mockAiGateway.complete.mockResolvedValue(mockGatewayResponse);
    mockResponseParser.parse.mockReturnValue({ ...mockParsedResponse });
    mockPrisma.aiConversation.create.mockResolvedValue({ id: 'conv-1' });
    mockPrisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    mockPrisma.aiMessage.create.mockResolvedValue({ id: 'msg-1' });
  });

  // ─── Happy Path ──────────────────────────────────────────────────────────

  describe('process() — happy path', () => {
    it('resolves agent, builds prompt, calls gateway, parses response, and persists messages', async () => {
      const request = makeRequest({ agentName: 'chat-router' });

      const result = await orchestrator.process(request);

      // 1. Agent resolved
      expect(mockPrisma.aiAgent.findUnique).toHaveBeenCalledWith({
        where: { name: 'chat-router' },
        include: { prompt: true, model: true },
      });

      // 2. Prompt loaded
      expect(mockPromptManager.loadPrompt).toHaveBeenCalledWith('chat-router-prompt');

      // 3. Parameters resolved
      expect(mockPromptManager.resolveParameters).toHaveBeenCalledWith(
        mockAgent.prompt,
        baseContext,
        'Hello, can you help me?',
      );

      // 6. Gateway called
      expect(mockAiGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          featureKey: 'ai.chat',
          stream: false,
        }),
      );

      // 7. Response parsed
      expect(mockResponseParser.parse).toHaveBeenCalledWith(
        mockGatewayResponse,
        'chat',
      );

      // 8. Messages persisted (conversation created + 2 messages)
      expect(mockPrisma.aiConversation.create).toHaveBeenCalled();
      expect(mockPrisma.aiMessage.create).toHaveBeenCalledTimes(2);

      // 9. Response returned
      expect(result.type).toBe('text');
      expect(result.content).toBe('Sure, I can help you with that!');
    });

    it('sets latencyMs on response from gateway', async () => {
      const parsedWithUsage: AiResponse = {
        type: 'text',
        messageId: 'msg-1',
        content: 'response',
        usage: { inputTokens: 100, outputTokens: 50, latencyMs: 0 },
      };
      mockResponseParser.parse.mockReturnValue(parsedWithUsage);

      const result = await orchestrator.process(makeRequest({ agentName: 'chat-router' }));

      expect(result.usage?.latencyMs).toBe(450);
    });

    it('uses existing conversationId when provided', async () => {
      const request = makeRequest({
        agentName: 'chat-router',
        conversationId: 'existing-conv-1',
      });

      mockPrisma.aiMessage.findMany.mockResolvedValue([]);

      await orchestrator.process(request);

      // Should NOT create a new conversation
      expect(mockPrisma.aiConversation.create).not.toHaveBeenCalled();

      // Messages persisted with existing conversationId
      expect(mockPrisma.aiMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ conversationId: 'existing-conv-1' }),
        }),
      );
    });
  });

  // ─── Agent Resolution ────────────────────────────────────────────────────

  describe('agent resolution', () => {
    it('resolves agent by explicit name', async () => {
      const request = makeRequest({ agentName: 'chat-router' });

      await orchestrator.process(request);

      expect(mockPrisma.aiAgent.findUnique).toHaveBeenCalledWith({
        where: { name: 'chat-router' },
        include: { prompt: true, model: true },
      });
      // Should not scan all agents
      expect(mockPrisma.aiAgent.findMany).not.toHaveBeenCalled();
    });

    it('resolves agent by intent keywords when no agentName provided', async () => {
      const request = makeRequest({ userMessage: 'Create an invoice for Bob' });

      mockPrisma.aiAgent.findMany.mockResolvedValue([mockInvoiceAgent]);

      await orchestrator.process(request);

      expect(mockPrisma.aiAgent.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { prompt: true, model: true },
      });
      expect(mockPromptManager.loadPrompt).toHaveBeenCalledWith('invoice-prompt');
    });

    it('falls back to chat-router when no agent matches keywords', async () => {
      const request = makeRequest({ userMessage: 'What is the weather today?' });

      // No keyword match
      mockPrisma.aiAgent.findMany.mockResolvedValue([mockInvoiceAgent]);
      // Fallback lookup
      mockPrisma.aiAgent.findUnique.mockResolvedValue(mockAgent);

      await orchestrator.process(request);

      // First call: findMany for intent matching, then findUnique for chat-router fallback
      expect(mockPrisma.aiAgent.findUnique).toHaveBeenCalledWith({
        where: { name: 'chat-router' },
        include: { prompt: true, model: true },
      });
    });

    it('returns error when explicit agent not found', async () => {
      mockPrisma.aiAgent.findUnique.mockResolvedValue(null);

      const request = makeRequest({ agentName: 'nonexistent-agent' });
      const result = await orchestrator.process(request);

      expect(result.type).toBe('error');
      expect(result.content).toBe('The requested AI agent is not available.');
    });

    it('returns error when explicit agent is inactive', async () => {
      mockPrisma.aiAgent.findUnique.mockResolvedValue({ ...mockAgent, isActive: false });

      const request = makeRequest({ agentName: 'chat-router' });
      const result = await orchestrator.process(request);

      expect(result.type).toBe('error');
    });

    it('returns error when chat-router fallback is missing', async () => {
      const request = makeRequest({ userMessage: 'no match here' });

      mockPrisma.aiAgent.findMany.mockResolvedValue([]); // no keyword agents
      mockPrisma.aiAgent.findUnique.mockResolvedValue(null); // no chat-router

      const result = await orchestrator.process(request);

      expect(result.type).toBe('error');
      expect(result.content).toBe('The requested AI agent is not available.');
    });
  });

  // ─── Multi-turn Conversation History ──────────────────────────────────────

  describe('conversation history', () => {
    it('loads previous messages for multi-turn conversation', async () => {
      const historyMessages = [
        { role: 'user', content: 'Hello', createdAt: new Date('2026-01-01T10:00:00Z') },
        { role: 'assistant', content: 'Hi there!', createdAt: new Date('2026-01-01T10:00:01Z') },
      ];

      mockPrisma.aiMessage.findMany.mockResolvedValue(historyMessages);

      const request = makeRequest({
        agentName: 'chat-router',
        conversationId: 'conv-existing',
      });

      await orchestrator.process(request);

      // History loaded
      expect(mockPrisma.aiMessage.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-existing' },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      // Gateway called with history in messages
      expect(mockAiGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ]),
        }),
      );
    });

    it('builds gateway messages with system prompt + history + user prompt', async () => {
      const historyMessages = [
        { role: 'user', content: 'Previous message', createdAt: new Date() },
        { role: 'assistant', content: 'Previous reply', createdAt: new Date() },
      ];

      mockPrisma.aiMessage.findMany.mockResolvedValue(historyMessages);

      const request = makeRequest({
        agentName: 'chat-router',
        conversationId: 'conv-1',
      });

      await orchestrator.process(request);

      const gatewayCall = mockAiGateway.complete.mock.calls[0]![0];
      expect(gatewayCall.messages).toEqual([
        { role: 'system', content: 'You are a helpful ERP assistant.' },
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous reply' },
        { role: 'user', content: 'Hello, can you help me?' },
      ]);
    });

    it('skips history loading when no conversationId', async () => {
      const request = makeRequest({ agentName: 'chat-router' });

      await orchestrator.process(request);

      expect(mockPrisma.aiMessage.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── Token Limit Trimming ─────────────────────────────────────────────────

  describe('token limit trimming', () => {
    it('trims oldest messages when history exceeds token budget', async () => {
      // Create a large history that will exceed budget
      // Agent model has maxInputTokens: 200000, budget = 160000 tokens
      // Each message ~250 chars = ~63 tokens. 3000 messages ~= 189000 tokens > 160000
      // But let's use a smaller example with a model that has low maxInputTokens
      const smallModelAgent = {
        ...mockAgent,
        model: { name: 'small-model', maxInputTokens: 100 }, // very small for testing
      };
      mockPrisma.aiAgent.findUnique.mockResolvedValue(smallModelAgent);

      // Create messages that will exceed 80 token budget (100 * 0.8 = 80 tokens = 320 chars)
      // Each message is ~100 chars = ~25 tokens
      const historyMessages = [
        { role: 'user', content: 'A'.repeat(100), createdAt: new Date('2026-01-01T10:00:00Z') },
        { role: 'assistant', content: 'B'.repeat(100), createdAt: new Date('2026-01-01T10:00:01Z') },
        { role: 'user', content: 'C'.repeat(100), createdAt: new Date('2026-01-01T10:00:02Z') },
        { role: 'assistant', content: 'D'.repeat(100), createdAt: new Date('2026-01-01T10:00:03Z') },
        { role: 'user', content: 'E'.repeat(100), createdAt: new Date('2026-01-01T10:00:04Z') },
      ];
      // 5 messages × 25 tokens each = 125 tokens > 80 budget

      mockPrisma.aiMessage.findMany.mockResolvedValue(historyMessages);

      const request = makeRequest({
        agentName: 'chat-router',
        conversationId: 'conv-1',
      });

      await orchestrator.process(request);

      // Should log trimming
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ original: 5 }),
        'Trimmed conversation history to fit token budget',
      );

      // Gateway should still include the last 2 user messages
      const gatewayCall = mockAiGateway.complete.mock.calls[0]![0];
      const userMessages = gatewayCall.messages.filter((m: any) => m.role === 'user');
      // Last 2 user messages from history should be preserved (C and E)
      // Plus the current user prompt from resolvedPrompt
      expect(userMessages.length).toBeGreaterThanOrEqual(2);
    });

    it('does not trim when within token budget', async () => {
      const historyMessages = [
        { role: 'user', content: 'Short message', createdAt: new Date() },
        { role: 'assistant', content: 'Short reply', createdAt: new Date() },
      ];

      mockPrisma.aiMessage.findMany.mockResolvedValue(historyMessages);

      const request = makeRequest({
        agentName: 'chat-router',
        conversationId: 'conv-1',
      });

      await orchestrator.process(request);

      // No trimming logged
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        'Trimmed conversation history to fit token budget',
      );
    });
  });

  // ─── Graceful Degradation ─────────────────────────────────────────────────

  describe('graceful degradation', () => {
    it('returns error response on gateway quota exceeded', async () => {
      mockAiGateway.complete.mockRejectedValue(
        new AiQuotaExceededError(95.5, 100),
      );

      const request = makeRequest({ agentName: 'chat-router' });
      const result = await orchestrator.process(request);

      expect(result.type).toBe('error');
      expect(result.content).toContain('quota exceeded');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        'AI request blocked by quota',
      );
      // Quota errors don't emit ai.degraded
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('returns error response and emits ai.degraded on provider unavailable', async () => {
      const primaryError = new Error('Anthropic API timeout');
      mockAiGateway.complete.mockRejectedValue(
        new ProviderUnavailableError(primaryError),
      );

      const request = makeRequest({ agentName: 'chat-router' });
      const result = await orchestrator.process(request);

      expect(result.type).toBe('error');
      expect(result.content).toContain('temporarily unavailable');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.degraded', {
        errorCode: 'PROVIDER_UNAVAILABLE',
        errorMessage: expect.stringContaining('Anthropic API timeout'),
        userId: 'user-1',
        tenantId: 'tenant-1',
        intent: 'chat',
      });
    });

    it('returns error response and emits ai.degraded on provider error', async () => {
      mockAiGateway.complete.mockRejectedValue(
        new ProviderError('anthropic', 'Rate limit exceeded', {
          statusCode: 429,
          isRetryable: true,
        }),
      );

      const request = makeRequest({ agentName: 'chat-router' });
      const result = await orchestrator.process(request);

      expect(result.type).toBe('error');
      expect(result.content).toContain('encountered an error');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.degraded', {
        errorCode: 'PROVIDER_ERROR',
        errorMessage: expect.stringContaining('Rate limit exceeded'),
        userId: 'user-1',
        tenantId: 'tenant-1',
        intent: 'chat',
      });
    });

    it('returns error response on unexpected error and emits ai.degraded', async () => {
      mockAiGateway.complete.mockRejectedValue(new Error('Unexpected DB error'));

      const request = makeRequest({ agentName: 'chat-router' });
      const result = await orchestrator.process(request);

      expect(result.type).toBe('error');
      expect(result.content).toContain('unexpected error');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.degraded', {
        errorCode: 'AI_SERVICE_ERROR',
        errorMessage: 'Unexpected DB error',
        userId: 'user-1',
        tenantId: 'tenant-1',
        intent: 'chat',
      });

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('never throws from process() — always returns AiResponse', async () => {
      // Even if everything fails internally
      mockPrisma.aiAgent.findUnique.mockRejectedValue(new Error('DB connection lost'));

      const request = makeRequest({ agentName: 'chat-router' });
      const result = await orchestrator.process(request);

      // Should not throw
      expect(result).toBeDefined();
      expect(result.type).toBe('error');
      expect(result.messageId).toBeDefined();
    });
  });

  // ─── Message Persistence ──────────────────────────────────────────────────

  describe('message persistence', () => {
    it('persists user message and assistant response after successful processing', async () => {
      const request = makeRequest({ agentName: 'chat-router' });

      await orchestrator.process(request);

      // Should create conversation
      expect(mockPrisma.aiConversation.create).toHaveBeenCalled();

      // Two messages: user + assistant
      expect(mockPrisma.aiMessage.create).toHaveBeenCalledTimes(2);

      // User message
      const userCall = mockPrisma.aiMessage.create.mock.calls[0]![0];
      expect(userCall.data.role).toBe('user');
      expect(userCall.data.content).toBe('Hello, can you help me?');

      // Assistant message
      const assistantCall = mockPrisma.aiMessage.create.mock.calls[1]![0];
      expect(assistantCall.data.role).toBe('assistant');
      expect(assistantCall.data.inputTokens).toBe(100);
      expect(assistantCall.data.outputTokens).toBe(50);
      expect(assistantCall.data.latencyMs).toBe(450);
    });

    it('does not persist messages on error', async () => {
      mockAiGateway.complete.mockRejectedValue(
        new ProviderUnavailableError(new Error('down')),
      );

      const request = makeRequest({ agentName: 'chat-router' });
      await orchestrator.process(request);

      // No messages persisted on error
      expect(mockPrisma.aiMessage.create).not.toHaveBeenCalled();
    });
  });

  // ─── Gateway Request Building ─────────────────────────────────────────────

  describe('gateway request building', () => {
    it('sets featureKey from intent', async () => {
      const request = makeRequest({
        agentName: 'chat-router',
        intent: 'create_invoice',
      });

      await orchestrator.process(request);

      expect(mockAiGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          featureKey: 'ai.create_invoice',
        }),
      );
    });

    it('uses request routingTags over agent routingTags', async () => {
      const request = makeRequest({
        agentName: 'chat-router',
        routingTags: ['reasoning', 'complex'],
      });

      await orchestrator.process(request);

      expect(mockAiGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          routingTags: ['reasoning', 'complex'],
        }),
      );
    });

    it('falls back to agent routingTags when request has none', async () => {
      const request = makeRequest({ agentName: 'chat-router' });

      await orchestrator.process(request);

      expect(mockAiGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          routingTags: ['standard'],
        }),
      );
    });

    it('sets modelName from agent when available', async () => {
      const request = makeRequest({ agentName: 'chat-router' });

      await orchestrator.process(request);

      expect(mockAiGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'claude-sonnet-4-5',
        }),
      );
    });

    it('passes agent tools to gateway', async () => {
      const agentWithTools = {
        ...mockAgent,
        tools: [{ name: 'create_invoice', description: 'Create invoice', inputSchema: {} }],
      };
      mockPrisma.aiAgent.findUnique.mockResolvedValue(agentWithTools);

      const request = makeRequest({ agentName: 'chat-router' });
      await orchestrator.process(request);

      expect(mockAiGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [{ name: 'create_invoice', description: 'Create invoice', inputSchema: {} }],
        }),
      );
    });
  });

  // ─── processStream ───────────────────────────────────────────────────────

  describe('processStream()', () => {
    /** Helper to create a mock async generator from an array of chunks */
    function createMockStreamGenerator(chunks: any[]) {
      return async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      };
    }

    it('yields content_delta chunks from gateway stream and done at end', async () => {
      const streamChunks = [
        { type: 'content_delta', content: 'Hello' },
        { type: 'content_delta', content: ', world!' },
        { type: 'usage', usage: { promptTokens: 20, completionTokens: 10 } },
        { type: 'done', finishReason: 'stop' },
      ];
      mockAiGateway.stream.mockReturnValue(createMockStreamGenerator(streamChunks)());

      const request = makeRequest({ agentName: 'chat-router' });

      const chunks: any[] = [];
      for await (const chunk of orchestrator.processStream(request)) {
        chunks.push(chunk);
      }

      // content_delta(Hello) + content_delta(, world!) + done
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ type: 'content_delta', content: 'Hello' });
      expect(chunks[1]).toEqual({ type: 'content_delta', content: ', world!' });
      expect(chunks[2].type).toBe('done');
      expect(chunks[2].finishReason).toBe('stop');
      expect(chunks[2].usage).toMatchObject({ inputTokens: 20, outputTokens: 10 });
      expect(chunks[2].usage.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('calls aiGateway.stream() with stream: true', async () => {
      const streamChunks = [
        { type: 'content_delta', content: 'Test' },
        { type: 'usage', usage: { promptTokens: 5, completionTokens: 3 } },
        { type: 'done', finishReason: 'stop' },
      ];
      mockAiGateway.stream.mockReturnValue(createMockStreamGenerator(streamChunks)());

      const request = makeRequest({ agentName: 'chat-router' });

      // Consume the stream
      for await (const _chunk of orchestrator.processStream(request)) {
        // consume
      }

      expect(mockAiGateway.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          tenantId: 'tenant-1',
          featureKey: 'ai.chat',
        }),
      );
    });

    it('persists accumulated content after stream completes', async () => {
      const streamChunks = [
        { type: 'content_delta', content: 'Accumulated ' },
        { type: 'content_delta', content: 'content here' },
        { type: 'usage', usage: { promptTokens: 15, completionTokens: 8 } },
        { type: 'done', finishReason: 'stop' },
      ];
      mockAiGateway.stream.mockReturnValue(createMockStreamGenerator(streamChunks)());

      const request = makeRequest({ agentName: 'chat-router' });

      for await (const _chunk of orchestrator.processStream(request)) {
        // consume
      }

      // Conversation created + 2 messages (user + assistant)
      expect(mockPrisma.aiConversation.create).toHaveBeenCalled();
      expect(mockPrisma.aiMessage.create).toHaveBeenCalledTimes(2);

      // User message
      const userCall = mockPrisma.aiMessage.create.mock.calls[0]![0];
      expect(userCall.data.role).toBe('user');
      expect(userCall.data.content).toBe('Hello, can you help me?');

      // Assistant message with accumulated content
      const assistantCall = mockPrisma.aiMessage.create.mock.calls[1]![0];
      expect(assistantCall.data.role).toBe('assistant');
      expect(assistantCall.data.content).toBe('Accumulated content here');
      expect(assistantCall.data.inputTokens).toBe(15);
      expect(assistantCall.data.outputTokens).toBe(8);
    });

    it('yields error chunk on gateway stream failure', async () => {
      mockAiGateway.stream.mockImplementation(async function* () {
        throw new ProviderError('anthropic', 'Stream connection lost', {
          statusCode: 500,
          isRetryable: true,
        });
      });

      const request = makeRequest({ agentName: 'chat-router' });

      const chunks: any[] = [];
      for await (const chunk of orchestrator.processStream(request)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].error).toBeDefined();
    });

    it('yields error chunk on quota exceeded during stream', async () => {
      mockAiGateway.stream.mockImplementation(async function* () {
        throw new AiQuotaExceededError(95.5, 100);
      });

      const request = makeRequest({ agentName: 'chat-router' });

      const chunks: any[] = [];
      for await (const chunk of orchestrator.processStream(request)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].error).toContain('quota exceeded');
    });

    it('forwards tool_use_delta chunks from gateway stream', async () => {
      const streamChunks = [
        { type: 'tool_use_delta', toolCall: { id: 'tool-1', name: 'create_invoice' } },
        { type: 'tool_use_delta', toolCall: { input: '{"amount": 100}' } },
        { type: 'usage', usage: { promptTokens: 30, completionTokens: 15 } },
        { type: 'done', finishReason: 'tool_use' },
      ];
      mockAiGateway.stream.mockReturnValue(createMockStreamGenerator(streamChunks)());

      const request = makeRequest({ agentName: 'chat-router' });

      const chunks: any[] = [];
      for await (const chunk of orchestrator.processStream(request)) {
        chunks.push(chunk);
      }

      // tool_use_delta(start) + tool_use_delta(input) + done
      expect(chunks).toHaveLength(3);
      expect(chunks[0].type).toBe('tool_use_delta');
      expect(chunks[1].type).toBe('tool_use_delta');
      expect(chunks[2].type).toBe('done');
      expect(chunks[2].finishReason).toBe('tool_use');
    });
  });
});
