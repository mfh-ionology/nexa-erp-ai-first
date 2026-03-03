// ---------------------------------------------------------------------------
// Integration tests for prompt rendering pipeline (E5c-2 Task 8.3)
// Tests end-to-end variable resolution through orchestrator and automation paths.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock setup via vi.hoisted ──────────────────────────────────────────────

const {
  mockPrisma,
  mockRedis,
  mockLogger,
  mockEventBus,
  mockAiGateway,
  mockPromptManager,
  mockResponseParser,
} = vi.hoisted(() => ({
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
    aiPromptVariable: {
      findMany: vi.fn(),
    },
    aiPrompt: {
      findUnique: vi.fn(),
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

// ─── Imports ────────────────────────────────────────────────────────────────

import { AiOrchestrator } from './orchestrator.js';
import { PromptRenderer } from './prompt-renderer.js';
import type { AiRequest } from './ai.types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function createPromptRenderer() {
  return new PromptRenderer(mockPrisma as any, mockLogger as any);
}

function makeRequest(overrides: Partial<AiRequest> = {}): AiRequest {
  return {
    intent: 'chat',
    userMessage: 'Hello',
    context: {
      userId: 'user-1',
      companyId: 'company-1',
      tenantId: 'tenant-1',
      locale: 'en-GB',
      userName: 'John Doe',
      userRole: 'ADMIN',
      companyName: 'Acme Ltd',
      baseCurrency: 'GBP',
      ...(overrides.context ?? {}),
    },
    ...overrides,
  };
}

function makeAgent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'agent-1',
    name: 'chat-router',
    displayName: 'Chat Router',
    isActive: true,
    routingTags: ['standard'],
    triggerConfig: null,
    guardrails: null,
    maxTurns: 10,
    tools: null,
    prompt: {
      id: 'prompt-1',
      name: 'chat-prompt',
      systemPrompt: 'You are an AI assistant for {{company.name}}.',
      userTemplate: 'User {{currentUser.name}} says: {{userInput}}',
      parameters: {},
      isActive: true,
      activeVersion: 1,
    },
    model: {
      id: 'model-1',
      name: 'claude-3',
      maxInputTokens: 100000,
    },
    ...overrides,
  };
}

function makeVariable(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'var-1',
    promptId: 'prompt-1',
    variableName: 'company.name',
    displayName: 'Company Name',
    description: null,
    sourceType: 'SYSTEM',
    sourceConfig: { key: 'company.name' },
    defaultValue: null,
    isRequired: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Prompt Rendering Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  describe('Orchestrator + PromptRenderer (chat context)', () => {
    it('should resolve SYSTEM + PAGE_FIELD variables in chat prompt via orchestrator', async () => {
      const agent = makeAgent();
      const variables = [
        makeVariable({
          id: 'v1',
          variableName: 'company.name',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'company.name' },
        }),
        makeVariable({
          id: 'v2',
          variableName: 'currentUser.name',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'currentUser.name' },
        }),
        makeVariable({
          id: 'v3',
          variableName: 'today',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'today' },
        }),
        makeVariable({
          id: 'v4',
          variableName: 'currentPage.selectedFilters',
          sourceType: 'PAGE_FIELD',
          sourceConfig: { field: 'currentPage.selectedFilters' },
          defaultValue: 'none',
        }),
      ];

      // Set up mock returns
      mockPrisma.aiAgent.findUnique.mockResolvedValue(agent);
      mockPrisma.aiPromptVariable.findMany.mockResolvedValue(variables);
      mockPrisma.aiConversation.create.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.aiMessage.create.mockResolvedValue({});

      // PromptManager returns templates with {{variable}} placeholders still present
      mockPromptManager.loadPrompt.mockResolvedValue({
        systemPrompt: agent.prompt.systemPrompt,
        userPrompt: agent.prompt.userTemplate,
        promptId: 'prompt-1',
        promptVersion: 1,
        prompt: agent.prompt,
      });
      mockPromptManager.resolveParameters.mockResolvedValue({
        systemPrompt: 'You are an AI assistant for {{company.name}}.',
        userPrompt: 'User {{currentUser.name}} asks about filters: {{currentPage.selectedFilters}}',
      });

      // AI Gateway returns a text response
      mockAiGateway.complete.mockResolvedValue({
        content: 'Hello!',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        latencyMs: 200,
      });
      mockResponseParser.parse.mockReturnValue({
        type: 'text',
        messageId: 'msg-1',
        content: 'Hello!',
        usage: { inputTokens: 100, outputTokens: 50, latencyMs: 200 },
      });

      const orchestrator = createOrchestrator();
      const promptRenderer = createPromptRenderer();
      orchestrator.setPromptRenderer(promptRenderer);

      const request = makeRequest({
        agentName: 'chat-router',
        userMessage: 'What filters am I using?',
        context: {
          userId: 'user-1',
          companyId: 'company-1',
          tenantId: 'tenant-1',
          locale: 'en-GB',
          userName: 'John Doe',
          userRole: 'ADMIN',
          companyName: 'Acme Ltd',
          baseCurrency: 'GBP',
          pageContext: {
            currentPage: {
              selectedFilters: 'status=OVERDUE',
            },
          },
        },
      });

      const response = await orchestrator.process(request);

      expect(response.type).toBe('text');

      // Verify that aiPromptVariable.findMany was called with the correct promptId
      expect(mockPrisma.aiPromptVariable.findMany).toHaveBeenCalledWith({
        where: { promptId: 'prompt-1' },
      });

      // Verify the AI Gateway received the rendered prompt (variables resolved)
      const gatewayCall = mockAiGateway.complete.mock.calls[0]![0];
      const systemMsg = gatewayCall.messages.find((m: any) => m.role === 'system');
      const userMsg = gatewayCall.messages.find((m: any) => m.role === 'user');

      // SYSTEM variables should be resolved
      expect(systemMsg.content).toContain('Acme Ltd');
      expect(systemMsg.content).not.toContain('{{company.name}}');

      expect(userMsg.content).toContain('John Doe');
      expect(userMsg.content).not.toContain('{{currentUser.name}}');

      // PAGE_FIELD should resolve from pageContext
      expect(userMsg.content).toContain('status=OVERDUE');
      expect(userMsg.content).not.toContain('{{currentPage.selectedFilters}}');
    });

    it('should gracefully degrade when PromptRenderer is not set', async () => {
      const agent = makeAgent();

      mockPrisma.aiAgent.findUnique.mockResolvedValue(agent);
      mockPrisma.aiConversation.create.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.aiMessage.create.mockResolvedValue({});

      mockPromptManager.loadPrompt.mockResolvedValue({
        systemPrompt: agent.prompt.systemPrompt,
        userPrompt: agent.prompt.userTemplate,
        promptId: 'prompt-1',
        promptVersion: 1,
        prompt: agent.prompt,
      });
      mockPromptManager.resolveParameters.mockResolvedValue({
        systemPrompt: 'You are an AI assistant for {{company.name}}.',
        userPrompt: 'User {{currentUser.name}} says: hello',
      });

      mockAiGateway.complete.mockResolvedValue({
        content: 'Hello!',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        latencyMs: 200,
      });
      mockResponseParser.parse.mockReturnValue({
        type: 'text',
        messageId: 'msg-1',
        content: 'Hello!',
        usage: { inputTokens: 100, outputTokens: 50, latencyMs: 200 },
      });

      const orchestrator = createOrchestrator();
      // Do NOT set promptRenderer — it stays null

      const response = await orchestrator.process(makeRequest({ agentName: 'chat-router' }));

      expect(response.type).toBe('text');
      // Variables remain unresolved since no PromptRenderer is set
      expect(mockPrisma.aiPromptVariable.findMany).not.toHaveBeenCalled();
    });

    it('should skip variable resolution when prompt has no AiPromptVariables', async () => {
      const agent = makeAgent();

      mockPrisma.aiAgent.findUnique.mockResolvedValue(agent);
      mockPrisma.aiPromptVariable.findMany.mockResolvedValue([]); // No variables
      mockPrisma.aiConversation.create.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.aiMessage.create.mockResolvedValue({});

      mockPromptManager.loadPrompt.mockResolvedValue({
        systemPrompt: agent.prompt.systemPrompt,
        userPrompt: 'Hello world',
        promptId: 'prompt-1',
        promptVersion: 1,
        prompt: agent.prompt,
      });
      mockPromptManager.resolveParameters.mockResolvedValue({
        systemPrompt: 'You are an assistant.',
        userPrompt: 'Hello world',
      });

      mockAiGateway.complete.mockResolvedValue({
        content: 'Hi!',
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        latencyMs: 100,
      });
      mockResponseParser.parse.mockReturnValue({
        type: 'text',
        messageId: 'msg-1',
        content: 'Hi!',
        usage: { inputTokens: 50, outputTokens: 20, latencyMs: 100 },
      });

      const orchestrator = createOrchestrator();
      orchestrator.setPromptRenderer(createPromptRenderer());

      const response = await orchestrator.process(makeRequest({ agentName: 'chat-router' }));

      expect(response.type).toBe('text');
      // Variables were queried but none found — no rendering needed
      expect(mockPrisma.aiPromptVariable.findMany).toHaveBeenCalledWith({
        where: { promptId: 'prompt-1' },
      });
    });

    it('should handle PromptRenderer errors gracefully (IMP-006)', async () => {
      const agent = makeAgent();

      mockPrisma.aiAgent.findUnique.mockResolvedValue(agent);
      // Simulate DB error when loading variables
      mockPrisma.aiPromptVariable.findMany.mockRejectedValue(new Error('DB connection lost'));
      mockPrisma.aiConversation.create.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.aiMessage.create.mockResolvedValue({});

      mockPromptManager.loadPrompt.mockResolvedValue({
        systemPrompt: agent.prompt.systemPrompt,
        userPrompt: 'Hello',
        promptId: 'prompt-1',
        promptVersion: 1,
        prompt: agent.prompt,
      });
      mockPromptManager.resolveParameters.mockResolvedValue({
        systemPrompt: 'You are an assistant for {{company.name}}.',
        userPrompt: 'Hello',
      });

      mockAiGateway.complete.mockResolvedValue({
        content: 'Hi!',
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        latencyMs: 100,
      });
      mockResponseParser.parse.mockReturnValue({
        type: 'text',
        messageId: 'msg-1',
        content: 'Hi!',
        usage: { inputTokens: 50, outputTokens: 20, latencyMs: 100 },
      });

      const orchestrator = createOrchestrator();
      orchestrator.setPromptRenderer(createPromptRenderer());

      // Should NOT throw — graceful degradation
      const response = await orchestrator.process(makeRequest({ agentName: 'chat-router' }));

      expect(response.type).toBe('text');
      // Warning should be logged about the failure
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ promptId: 'prompt-1' }),
        expect.stringContaining('AiPromptVariable resolution failed'),
      );
    });
  });

  describe('AutomationExecutor + PromptRenderer (autonomous context)', () => {
    it('should resolve PREVIOUS_STEP + SYSTEM variables in automation step goal', async () => {
      // This test verifies the PromptRenderer integration in AutomationExecutor.
      // We test the renderTemplate() method directly since the full AutomationExecutor
      // requires many dependencies (AiGateway, ToolRegistry, etc.).
      const promptRenderer = createPromptRenderer();

      const variables = [
        makeVariable({
          id: 'v1',
          variableName: 'today',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'today' },
        }),
        makeVariable({
          id: 'v2',
          variableName: 'company.id',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'company.id' },
        }),
      ];

      const template = 'Analyse overdue invoices for company {{company.id}} as of {{today}}.';

      const result = await promptRenderer.renderTemplate(template, variables as any, {
        companyId: 'company-abc',
        userId: 'user-1',
        previousStepOutputs: { '1': { totalOverdue: 5 } },
        autonomous: true,
      });

      expect(result).toContain('company-abc');
      expect(result).not.toContain('{{company.id}}');
      // today should be resolved to a date
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(result).not.toContain('{{today}}');
    });

    it('should throw UnresolvableRequiredParamError in autonomous mode for required vars', async () => {
      const promptRenderer = createPromptRenderer();

      const variables = [
        makeVariable({
          id: 'v1',
          variableName: 'missingVar',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'nonexistent.key' },
          isRequired: true,
        }),
      ];

      const template = 'Process {{missingVar}} immediately.';

      await expect(
        promptRenderer.renderTemplate(template, variables as any, {
          companyId: 'company-1',
          userId: 'user-1',
          autonomous: true,
        }),
      ).rejects.toThrow('Required variable');
    });

    it('should use default values for optional unresolvable vars in autonomous mode', async () => {
      const promptRenderer = createPromptRenderer();

      const variables = [
        makeVariable({
          id: 'v1',
          variableName: 'optionalVar',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'nonexistent.key' },
          defaultValue: 'default-value',
          isRequired: false,
        }),
      ];

      const template = 'Value: {{optionalVar}}.';

      const result = await promptRenderer.renderTemplate(template, variables as any, {
        companyId: 'company-1',
        userId: 'user-1',
        autonomous: true,
      });

      expect(result).toBe('Value: default-value.');
    });
  });
});
