import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiGateway } from '../ai-gateway.js';
import type {
  AiGatewayConfig,
  QuotaClient,
  UsageRecorder,
  FallbackHandler,
} from '../ai-gateway.js';
import { ProviderRegistry } from '../providers/provider-registry.js';
import { ModelRegistry } from '../model-registry.js';
import { CredentialResolver } from '../credentials/credential-resolver.js';
import type { ByokCredentialSource } from '../credentials/credential-resolver.js';
import {
  AiQuotaExceededError,
  ProviderError,
  ModelNotFoundError,
} from '../errors/index.js';
import type { LLMProvider } from '../providers/llm-provider.interface.js';
import type {
  AiGatewayRequest,
  AiModelConfig,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  Message,
  Tool,
  ProviderCapability,
  QuotaCheckResult,
  UsageRecord,
} from '../types/index.js';
import pino from 'pino';

// ─── Test Helpers ───────────────────────────────────────────────────────────

const SILENT_LOGGER = pino({ level: 'silent' });

const MOCK_LLM_RESPONSE: LLMResponse = {
  content: 'Hello, world!',
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  model: 'claude-sonnet-4-5',
  provider: 'anthropic',
  finishReason: 'stop',
};

const MOCK_MODELS: AiModelConfig[] = [
  {
    name: 'claude-sonnet-4-5',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-5',
    routingTags: ['standard', 'chat'],
    fallbackModelName: 'gpt-4o',
    isDefault: true,
    config: { timeout: 30000, maxTokens: 8192 },
  },
  {
    name: 'gpt-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    routingTags: ['structured_output'],
    fallbackModelName: 'claude-sonnet-4-5',
    isDefault: false,
    config: { timeout: 30000, maxTokens: 8192 },
  },
  {
    name: 'claude-haiku-4-5',
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5',
    routingTags: ['cheap', 'fast'],
    isDefault: false,
    config: { timeout: 15000, maxTokens: 4096 },
  },
];

function createStubProvider(id: string): LLMProvider {
  return {
    providerId: id,
    complete: vi.fn(async (_req: LLMRequest, _apiKey: string): Promise<LLMResponse> => ({
      ...MOCK_LLM_RESPONSE,
      provider: id,
    })),
    stream: async function* (_req: LLMRequest, _apiKey: string): AsyncIterable<LLMStreamChunk> {
      yield { type: 'done', finishReason: 'stop' };
    },
    capabilities: (): ProviderCapability[] => ['completion'],
    validateModel: (_modelId: string): boolean => true,
    estimateTokens: vi.fn(async (_msgs: Message[], _tools?: Tool[]): Promise<number> => 100),
  };
}

function createQuotaClient(overrides?: Partial<QuotaCheckResult>): QuotaClient {
  const result: QuotaCheckResult = {
    allowed: true,
    remainingTokens: 50000,
    quotaPct: 25,
    ...overrides,
  };
  return {
    check: vi.fn(async () => result),
  };
}

function createUsageRecorder(): UsageRecorder & { record: ReturnType<typeof vi.fn> } {
  return {
    record: vi.fn(),
  };
}

function createByokSource(): ByokCredentialSource {
  return {
    getCredential: vi.fn(async () => null),
  };
}

function createBaseConfig(overrides?: Partial<AiGatewayConfig>): AiGatewayConfig {
  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(createStubProvider('anthropic'));
  providerRegistry.register(createStubProvider('openai'));

  return {
    platformApiUrl: 'http://localhost:3001/api/v1',
    serviceToken: 'test-service-token',
    providerRegistry,
    credentialResolver: new CredentialResolver(
      createByokSource(),
      '0'.repeat(64), // 32-byte hex master key
      (key) => (key === 'ANTHROPIC_API_KEY' ? 'sk-ant-test' : key === 'OPENAI_API_KEY' ? 'sk-oai-test' : undefined),
    ),
    modelRegistry: new ModelRegistry({ models: MOCK_MODELS }),
    usageRecorder: createUsageRecorder(),
    quotaClient: createQuotaClient(),
    logger: SILENT_LOGGER,
    ...overrides,
  };
}

const BASE_REQUEST: AiGatewayRequest = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  featureKey: 'chat.general',
  messages: [{ role: 'user', content: 'Hello' }],
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AiGateway', () => {
  describe('complete() — happy path', () => {
    it('resolves model, checks quota, calls provider, records usage, and returns response', async () => {
      const usageRecorder = createUsageRecorder();
      const quotaClient = createQuotaClient();
      const config = createBaseConfig({ usageRecorder, quotaClient });
      const gateway = new AiGateway(config);

      const response = await gateway.complete(BASE_REQUEST);

      // Response structure
      expect(response.content).toBe('Hello, world!');
      expect(response.provider).toBe('anthropic');
      expect(response.model).toBe('claude-sonnet-4-5');
      expect(response.finishReason).toBe('stop');
      expect(response.usage.totalTokens).toBe(30);

      // Gateway-specific fields
      expect(response.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.fallbackUsed).toBe(false);
      expect(response.fallbackFrom).toBeUndefined();
      expect(response.isByok).toBe(false);
      expect(response.quotaPct).toBe(25);

      // Quota check was called
      expect(quotaClient.check).toHaveBeenCalledWith('tenant-1', 100, 'chat.general');

      // Usage was recorded
      expect(usageRecorder.record).toHaveBeenCalledOnce();
      const usageRecord = usageRecorder.record.mock.calls[0]![0] as UsageRecord;
      expect(usageRecord.tenantId).toBe('tenant-1');
      expect(usageRecord.userId).toBe('user-1');
      expect(usageRecord.featureKey).toBe('chat.general');
      expect(usageRecord.provider).toBe('anthropic');
      expect(usageRecord.model).toBe('claude-sonnet-4-5');
      expect(usageRecord.totalTokens).toBe(30);
      expect(usageRecord.isByok).toBe(false);
      expect(usageRecord.fallbackUsed).toBe(false);
      expect(usageRecord.requestId).toBe(response.requestId);
    });

    it('generates a unique requestId for each call', async () => {
      const config = createBaseConfig();
      const gateway = new AiGateway(config);

      const [r1, r2] = await Promise.all([
        gateway.complete(BASE_REQUEST),
        gateway.complete(BASE_REQUEST),
      ]);

      expect(r1.requestId).not.toBe(r2.requestId);
    });

    it('passes requestId through the entire flow to usage record', async () => {
      const usageRecorder = createUsageRecorder();
      const config = createBaseConfig({ usageRecorder });
      const gateway = new AiGateway(config);

      const response = await gateway.complete(BASE_REQUEST);

      const usageRecord = usageRecorder.record.mock.calls[0]![0] as UsageRecord;
      expect(usageRecord.requestId).toBe(response.requestId);
    });
  });

  // ─── Model Resolution ──────────────────────────────────────────────────

  describe('model resolution', () => {
    it('resolves by modelName when provided', async () => {
      const config = createBaseConfig();
      const gateway = new AiGateway(config);
      const anthropicProvider = config.providerRegistry.get('anthropic');

      await gateway.complete({ ...BASE_REQUEST, modelName: 'claude-haiku-4-5' });

      expect(anthropicProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-haiku-4-5' }),
        expect.any(String),
      );
    });

    it('resolves by routingTags when modelName not provided', async () => {
      const config = createBaseConfig();
      const gateway = new AiGateway(config);
      const openaiProvider = config.providerRegistry.get('openai');

      await gateway.complete({
        ...BASE_REQUEST,
        routingTags: ['structured_output'],
      });

      expect(openaiProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o' }),
        expect.any(String),
      );
    });

    it('resolves default model when neither modelName nor routingTags provided', async () => {
      const config = createBaseConfig();
      const gateway = new AiGateway(config);
      const anthropicProvider = config.providerRegistry.get('anthropic');

      await gateway.complete(BASE_REQUEST);

      // Default model is claude-sonnet-4-5
      expect(anthropicProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-5' }),
        expect.any(String),
      );
    });

    it('throws ModelNotFoundError for unknown modelName', async () => {
      const config = createBaseConfig();
      const gateway = new AiGateway(config);

      await expect(
        gateway.complete({ ...BASE_REQUEST, modelName: 'nonexistent-model' }),
      ).rejects.toThrow(ModelNotFoundError);
    });

    it('throws ModelNotFoundError for unmatched routingTags', async () => {
      const config = createBaseConfig();
      const gateway = new AiGateway(config);

      await expect(
        gateway.complete({ ...BASE_REQUEST, routingTags: ['nonexistent-tag'] }),
      ).rejects.toThrow(ModelNotFoundError);
    });
  });

  // ─── Quota Check ────────────────────────────────────────────────────────

  describe('quota check', () => {
    it('throws AiQuotaExceededError when quota check returns allowed: false', async () => {
      const quotaClient = createQuotaClient({
        allowed: false,
        remainingTokens: 0,
        quotaPct: 105,
      });
      const config = createBaseConfig({ quotaClient });
      const gateway = new AiGateway(config);

      await expect(gateway.complete(BASE_REQUEST)).rejects.toThrow(AiQuotaExceededError);
    });

    it('does NOT call the provider when quota is exceeded', async () => {
      const quotaClient = createQuotaClient({
        allowed: false,
        remainingTokens: 0,
        quotaPct: 105,
      });
      const config = createBaseConfig({ quotaClient });
      const anthropicProvider = config.providerRegistry.get('anthropic');
      const gateway = new AiGateway(config);

      try {
        await gateway.complete(BASE_REQUEST);
      } catch {
        // expected
      }

      expect(anthropicProvider.complete).not.toHaveBeenCalled();
    });

    it('includes warning from quota check in response when soft limit reached', async () => {
      const quotaClient = createQuotaClient({
        allowed: true,
        remainingTokens: 5000,
        quotaPct: 82,
        warning: 'Approaching AI quota limit (82%)',
      });
      const config = createBaseConfig({ quotaClient });
      const gateway = new AiGateway(config);

      const response = await gateway.complete(BASE_REQUEST);

      expect(response.warning).toBe('Approaching AI quota limit (82%)');
      expect(response.quotaPct).toBe(82);
    });

    it('passes estimatedTokens and featureKey to quota check', async () => {
      const quotaClient = createQuotaClient();
      const config = createBaseConfig({ quotaClient });
      const gateway = new AiGateway(config);

      await gateway.complete({
        ...BASE_REQUEST,
        featureKey: 'invoice.summary',
      });

      expect(quotaClient.check).toHaveBeenCalledWith('tenant-1', 100, 'invoice.summary');
    });
  });

  // ─── BYOK Credentials ──────────────────────────────────────────────────

  describe('BYOK credentials', () => {
    it('uses vendor key when no BYOK configured and sets isByok: false', async () => {
      const usageRecorder = createUsageRecorder();
      const config = createBaseConfig({ usageRecorder });
      const gateway = new AiGateway(config);

      const response = await gateway.complete(BASE_REQUEST);

      expect(response.isByok).toBe(false);
      const usageRecord = usageRecorder.record.mock.calls[0]![0] as UsageRecord;
      expect(usageRecord.isByok).toBe(false);
    });
  });

  // ─── Provider Error & Fallback ──────────────────────────────────────────

  describe('provider error and fallback', () => {
    it('re-throws non-retryable ProviderError without attempting fallback', async () => {
      const providerRegistry = new ProviderRegistry();
      const failingProvider = createStubProvider('anthropic');
      (failingProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ProviderError('anthropic', 'Bad request', {
          statusCode: 400,
          isRetryable: false,
        }),
      );
      providerRegistry.register(failingProvider);
      providerRegistry.register(createStubProvider('openai'));

      const fallbackHandler: FallbackHandler = {
        executeWithFallback: vi.fn(),
      };

      const config = createBaseConfig({
        providerRegistry,
        fallbackHandler,
      });
      const gateway = new AiGateway(config);

      await expect(gateway.complete(BASE_REQUEST)).rejects.toThrow(ProviderError);
      expect(fallbackHandler.executeWithFallback).not.toHaveBeenCalled();
    });

    it('attempts fallback on retryable ProviderError when fallbackHandler is configured', async () => {
      const providerRegistry = new ProviderRegistry();
      const failingProvider = createStubProvider('anthropic');
      (failingProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ProviderError('anthropic', 'Rate limited', {
          statusCode: 429,
          isRetryable: true,
        }),
      );
      providerRegistry.register(failingProvider);
      providerRegistry.register(createStubProvider('openai'));

      const fallbackResponse: LLMResponse = {
        content: 'Fallback response',
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
        model: 'gpt-4o',
        provider: 'openai',
        finishReason: 'stop',
      };

      const fallbackHandler: FallbackHandler = {
        executeWithFallback: vi.fn(async () => ({
          response: fallbackResponse,
          fallbackUsed: true,
          fallbackFrom: 'claude-sonnet-4-5',
        })),
      };

      const usageRecorder = createUsageRecorder();
      const config = createBaseConfig({
        providerRegistry,
        usageRecorder,
        fallbackHandler,
      });
      const gateway = new AiGateway(config);

      const response = await gateway.complete(BASE_REQUEST);

      expect(response.content).toBe('Fallback response');
      expect(response.fallbackUsed).toBe(true);
      expect(response.fallbackFrom).toBe('claude-sonnet-4-5');
      expect(response.provider).toBe('openai');
      expect(response.model).toBe('gpt-4o');

      // Usage record reflects fallback
      const usageRecord = usageRecorder.record.mock.calls[0]![0] as UsageRecord;
      expect(usageRecord.fallbackUsed).toBe(true);
      expect(usageRecord.fallbackFrom).toBe('claude-sonnet-4-5');
    });

    it('re-throws retryable ProviderError when no fallbackHandler configured', async () => {
      const providerRegistry = new ProviderRegistry();
      const failingProvider = createStubProvider('anthropic');
      (failingProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ProviderError('anthropic', 'Server error', {
          statusCode: 500,
          isRetryable: true,
        }),
      );
      providerRegistry.register(failingProvider);

      const config = createBaseConfig({
        providerRegistry,
        fallbackHandler: undefined,
      });
      const gateway = new AiGateway(config);

      await expect(gateway.complete(BASE_REQUEST)).rejects.toThrow(ProviderError);
    });
  });

  // ─── Usage Recording ────────────────────────────────────────────────────

  describe('usage recording', () => {
    it('records usage fire-and-forget — gateway returns even if recording fails', async () => {
      const usageRecorder = createUsageRecorder();
      usageRecorder.record.mockImplementation(() => {
        throw new Error('Recording infrastructure failure');
      });

      const config = createBaseConfig({ usageRecorder });
      const gateway = new AiGateway(config);

      // Should NOT throw even though recording throws
      const response = await gateway.complete(BASE_REQUEST);
      expect(response.content).toBe('Hello, world!');
      expect(usageRecorder.record).toHaveBeenCalledOnce();
    });

    it('populates all usage record fields correctly', async () => {
      const usageRecorder = createUsageRecorder();
      const config = createBaseConfig({ usageRecorder });
      const gateway = new AiGateway(config);

      const response = await gateway.complete({
        ...BASE_REQUEST,
        featureKey: 'sales.forecast',
      });

      const record = usageRecorder.record.mock.calls[0]![0] as UsageRecord;
      expect(record).toEqual(
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          featureKey: 'sales.forecast',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          isByok: false,
          fallbackUsed: false,
          requestId: response.requestId,
        }),
      );
      expect(record.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── LLM Request Building ──────────────────────────────────────────────

  describe('LLM request building', () => {
    it('passes messages, tools, and providerOptions from gateway request to provider', async () => {
      const config = createBaseConfig();
      const anthropicProvider = config.providerRegistry.get('anthropic');
      const gateway = new AiGateway(config);

      const tools: Tool[] = [
        { name: 'get_weather', description: 'Get weather', inputSchema: { type: 'object' } },
      ];

      await gateway.complete({
        ...BASE_REQUEST,
        tools,
        temperature: 0.5,
        providerOptions: { cache_control: true },
      });

      expect(anthropicProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5',
          messages: BASE_REQUEST.messages,
          tools,
          temperature: 0.5,
          providerOptions: { cache_control: true },
        }),
        expect.any(String),
      );
    });

    it('uses model maxTokens when request maxOutputTokens not specified', async () => {
      const config = createBaseConfig();
      const anthropicProvider = config.providerRegistry.get('anthropic');
      const gateway = new AiGateway(config);

      await gateway.complete(BASE_REQUEST);

      expect(anthropicProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({ maxOutputTokens: 8192 }),
        expect.any(String),
      );
    });

    it('uses request maxOutputTokens over model default when specified', async () => {
      const config = createBaseConfig();
      const anthropicProvider = config.providerRegistry.get('anthropic');
      const gateway = new AiGateway(config);

      await gateway.complete({ ...BASE_REQUEST, maxOutputTokens: 1000 });

      expect(anthropicProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({ maxOutputTokens: 1000 }),
        expect.any(String),
      );
    });
  });

  // ─── Latency Tracking ──────────────────────────────────────────────────

  describe('latency tracking', () => {
    it('measures latency in milliseconds', async () => {
      const config = createBaseConfig();
      const gateway = new AiGateway(config);

      const response = await gateway.complete(BASE_REQUEST);

      expect(typeof response.latencyMs).toBe('number');
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Streaming ──────────────────────────────────────────────────────────

  describe('stream()', () => {
    function createStreamingProvider(id: string, chunks: LLMStreamChunk[]): LLMProvider {
      return {
        providerId: id,
        complete: vi.fn(async (): Promise<LLMResponse> => MOCK_LLM_RESPONSE),
        stream: async function* (): AsyncIterable<LLMStreamChunk> {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
        capabilities: (): ProviderCapability[] => ['completion', 'streaming'],
        validateModel: (): boolean => true,
        estimateTokens: vi.fn(async (): Promise<number> => 100),
      };
    }

    it('yields content_delta chunks from provider stream', async () => {
      const chunks: LLMStreamChunk[] = [
        { type: 'content_delta', content: 'Hello' },
        { type: 'content_delta', content: ', world!' },
        { type: 'usage', usage: { promptTokens: 10, completionTokens: 5 } },
        { type: 'done', finishReason: 'stop' },
      ];

      const providerRegistry = new ProviderRegistry();
      providerRegistry.register(createStreamingProvider('anthropic', chunks));

      const config = createBaseConfig({ providerRegistry });
      const gateway = new AiGateway(config);

      const received: LLMStreamChunk[] = [];
      for await (const chunk of gateway.stream(BASE_REQUEST)) {
        received.push(chunk);
      }

      expect(received).toHaveLength(4);
      expect(received[0]).toEqual({ type: 'content_delta', content: 'Hello' });
      expect(received[1]).toEqual({ type: 'content_delta', content: ', world!' });
      expect(received[2]).toEqual({ type: 'usage', usage: { promptTokens: 10, completionTokens: 5 } });
      expect(received[3]).toEqual({ type: 'done', finishReason: 'stop' });
    });

    it('yields done chunk with usage at end of stream', async () => {
      const chunks: LLMStreamChunk[] = [
        { type: 'content_delta', content: 'Test' },
        { type: 'usage', usage: { promptTokens: 15, completionTokens: 8 } },
        { type: 'done', finishReason: 'stop' },
      ];

      const providerRegistry = new ProviderRegistry();
      providerRegistry.register(createStreamingProvider('anthropic', chunks));

      const config = createBaseConfig({ providerRegistry });
      const gateway = new AiGateway(config);

      const received: LLMStreamChunk[] = [];
      for await (const chunk of gateway.stream(BASE_REQUEST)) {
        received.push(chunk);
      }

      const doneChunk = received.find((c) => c.type === 'done');
      expect(doneChunk).toBeDefined();
      expect(doneChunk!.finishReason).toBe('stop');

      const usageChunk = received.find((c) => c.type === 'usage');
      expect(usageChunk).toBeDefined();
      expect(usageChunk!.usage?.promptTokens).toBe(15);
      expect(usageChunk!.usage?.completionTokens).toBe(8);
    });

    it('records usage after stream completion', async () => {
      const chunks: LLMStreamChunk[] = [
        { type: 'content_delta', content: 'Response' },
        { type: 'usage', usage: { promptTokens: 20, completionTokens: 10 } },
        { type: 'done', finishReason: 'stop' },
      ];

      const providerRegistry = new ProviderRegistry();
      providerRegistry.register(createStreamingProvider('anthropic', chunks));

      const usageRecorder = createUsageRecorder();
      const config = createBaseConfig({ providerRegistry, usageRecorder });
      const gateway = new AiGateway(config);

      // Consume the stream
      for await (const _chunk of gateway.stream(BASE_REQUEST)) {
        // consume
      }

      expect(usageRecorder.record).toHaveBeenCalledOnce();
      const record = usageRecorder.record.mock.calls[0]![0] as UsageRecord;
      expect(record.tenantId).toBe('tenant-1');
      expect(record.userId).toBe('user-1');
      expect(record.promptTokens).toBe(20);
      expect(record.completionTokens).toBe(10);
      expect(record.totalTokens).toBe(30);
      expect(record.fallbackUsed).toBe(false);
    });

    it('handles provider errors gracefully by propagating', async () => {
      const failingProvider: LLMProvider = {
        providerId: 'anthropic',
        complete: vi.fn(async (): Promise<LLMResponse> => MOCK_LLM_RESPONSE),
        stream: async function* (): AsyncIterable<LLMStreamChunk> {
          throw new ProviderError('anthropic', 'Stream failed', {
            statusCode: 500,
            isRetryable: true,
          });
        },
        capabilities: (): ProviderCapability[] => ['completion', 'streaming'],
        validateModel: (): boolean => true,
        estimateTokens: vi.fn(async (): Promise<number> => 100),
      };

      const providerRegistry = new ProviderRegistry();
      providerRegistry.register(failingProvider);

      const config = createBaseConfig({ providerRegistry });
      const gateway = new AiGateway(config);

      await expect(async () => {
        for await (const _chunk of gateway.stream(BASE_REQUEST)) {
          // consume
        }
      }).rejects.toThrow(ProviderError);
    });

    it('quota check still happens before streaming starts', async () => {
      const quotaClient = createQuotaClient({
        allowed: false,
        remainingTokens: 0,
        quotaPct: 110,
      });

      const chunks: LLMStreamChunk[] = [
        { type: 'content_delta', content: 'Should not reach here' },
      ];

      const providerRegistry = new ProviderRegistry();
      providerRegistry.register(createStreamingProvider('anthropic', chunks));

      const config = createBaseConfig({ providerRegistry, quotaClient });
      const gateway = new AiGateway(config);

      await expect(async () => {
        for await (const _chunk of gateway.stream(BASE_REQUEST)) {
          // consume
        }
      }).rejects.toThrow(AiQuotaExceededError);

      expect(quotaClient.check).toHaveBeenCalledWith('tenant-1', 100, 'chat.general');
    });

    it('usage recording failure does not break the stream', async () => {
      const chunks: LLMStreamChunk[] = [
        { type: 'content_delta', content: 'Data' },
        { type: 'usage', usage: { promptTokens: 5, completionTokens: 3 } },
        { type: 'done', finishReason: 'stop' },
      ];

      const providerRegistry = new ProviderRegistry();
      providerRegistry.register(createStreamingProvider('anthropic', chunks));

      const usageRecorder = createUsageRecorder();
      usageRecorder.record.mockImplementation(() => {
        throw new Error('Usage recording infra failure');
      });

      const config = createBaseConfig({ providerRegistry, usageRecorder });
      const gateway = new AiGateway(config);

      const received: LLMStreamChunk[] = [];
      // Should NOT throw even though recording throws
      for await (const chunk of gateway.stream(BASE_REQUEST)) {
        received.push(chunk);
      }

      expect(received).toHaveLength(3);
      expect(usageRecorder.record).toHaveBeenCalledOnce();
    });
  });
});

// ─── ModelRegistry Tests ──────────────────────────────────────────────────

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry({ models: MOCK_MODELS });
  });

  describe('resolveByName', () => {
    it('resolves a model by exact name', () => {
      const model = registry.resolveByName('claude-sonnet-4-5');
      expect(model.name).toBe('claude-sonnet-4-5');
      expect(model.provider).toBe('anthropic');
      expect(model.modelId).toBe('claude-sonnet-4-5');
    });

    it('throws ModelNotFoundError for unknown name', () => {
      expect(() => registry.resolveByName('nonexistent')).toThrow(ModelNotFoundError);
    });
  });

  describe('resolveByTags', () => {
    it('resolves a model matching routing tags', () => {
      const model = registry.resolveByTags(['structured_output']);
      expect(model.name).toBe('gpt-4o');
    });

    it('resolves the model with most matching tags when multiple match', () => {
      const model = registry.resolveByTags(['standard', 'chat']);
      expect(model.name).toBe('claude-sonnet-4-5'); // matches both tags
    });

    it('throws ModelNotFoundError when no tags match', () => {
      expect(() => registry.resolveByTags(['nonexistent'])).toThrow(ModelNotFoundError);
    });
  });

  describe('resolveDefault', () => {
    it('resolves the default model', () => {
      const model = registry.resolveDefault();
      expect(model.name).toBe('claude-sonnet-4-5');
      expect(model.isDefault).toBe(true);
    });

    it('returns first model when no model is marked as default', () => {
      const modelsNoDefault = MOCK_MODELS.map((m) => ({ ...m, isDefault: false }));
      const reg = new ModelRegistry({ models: modelsNoDefault });
      const model = reg.resolveDefault();
      expect(model.name).toBe('claude-sonnet-4-5'); // first in list
    });

    it('throws ModelNotFoundError when registry is empty', () => {
      const emptyRegistry = new ModelRegistry({ models: [] });
      expect(() => emptyRegistry.resolveDefault()).toThrow(ModelNotFoundError);
    });
  });

  describe('listModels', () => {
    it('returns all registered models', () => {
      const models = registry.listModels();
      expect(models).toHaveLength(3);
      expect(models.map((m) => m.name)).toEqual([
        'claude-sonnet-4-5',
        'gpt-4o',
        'claude-haiku-4-5',
      ]);
    });

    it('returns a copy (not a reference to internal state)', () => {
      const models = registry.listModels();
      models.pop();
      expect(registry.listModels()).toHaveLength(3);
    });
  });

  describe('static JSON config loading', () => {
    it('loads models from static JSON when no models provided', () => {
      const reg = new ModelRegistry();
      const models = reg.listModels();
      expect(models.length).toBeGreaterThan(0);
      // Verify at least one expected model from models.json
      expect(models.some((m) => m.name === 'claude-sonnet-4-5')).toBe(true);
    });
  });
});
