import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import pino from 'pino';
import { AiGateway } from '../../ai-gateway.js';
import { ProviderRegistry } from '../../providers/provider-registry.js';
import { ModelRegistry } from '../../model-registry.js';
import { CredentialResolver } from '../../credentials/credential-resolver.js';
import { QuotaClient } from '../../quota/quota-client.js';
import { UsageRecorder } from '../../quota/usage-recorder.js';
import { FallbackHandler } from '../../fallback/fallback-handler.js';
import {
  AiQuotaExceededError,
  ProviderError,
  ProviderUnavailableError,
} from '../../errors/index.js';
import type { LLMProvider } from '../../providers/llm-provider.interface.js';
import type {
  AiGatewayRequest,
  AiModelConfig,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ProviderCapability,
} from '../../types/index.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const SILENT_LOGGER = pino({ level: 'silent' });
const PLATFORM_URL = 'http://localhost:3001/api/v1';
const SERVICE_TOKEN = 'test-svc-token';
const MASTER_KEY = '0'.repeat(64);

const TEST_MODELS: AiModelConfig[] = [
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
    fallbackModelName: 'gpt-4o-mini',
    isDefault: false,
    config: { timeout: 15000, maxTokens: 4096 },
  },
  {
    name: 'gpt-4o-mini',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    routingTags: ['cheap'],
    fallbackModelName: 'claude-haiku-4-5',
    isDefault: false,
    config: { timeout: 15000, maxTokens: 4096 },
  },
];

const BASE_REQUEST: AiGatewayRequest = {
  tenantId: 'tenant-int-1',
  userId: 'user-int-1',
  featureKey: 'chat.integration',
  messages: [{ role: 'user', content: 'Integration test message' }],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createStubProvider(id: string): LLMProvider {
  return {
    providerId: id,
    complete: vi.fn(async (req: LLMRequest): Promise<LLMResponse> => ({
      content: `Response from ${req.model}`,
      usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
      model: req.model,
      provider: id,
      finishReason: 'stop',
    })),
    stream: async function* (): AsyncIterable<LLMStreamChunk> {
      yield { type: 'done', finishReason: 'stop' };
    },
    capabilities: (): ProviderCapability[] => ['completion'],
    validateModel: (): boolean => true,
    estimateTokens: vi.fn(async (): Promise<number> => 100),
  };
}

function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Wait for fire-and-forget async operations to flush. */
async function flushAsync(): Promise<void> {
  await new Promise((r) => setTimeout(r, 50));
}

// ─── Integration Tests ──────────────────────────────────────────────────────

describe('AI Gateway — Integration Tests', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: Array<{ url: string; body: Record<string, unknown> | undefined }>;

  // Shared real components (reset per test)
  let anthropicProvider: LLMProvider;
  let openaiProvider: LLMProvider;
  let providerRegistry: ProviderRegistry;
  let modelRegistry: ModelRegistry;
  let credentialResolver: CredentialResolver;

  // Configurable per-test fetch behaviour
  let quotaCheckResponse: Record<string, unknown>;
  let quotaCheckShouldThrow: boolean;
  let quotaCheckCallCount: number;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCalls = [];
    quotaCheckCallCount = 0;
    quotaCheckShouldThrow = false;
    quotaCheckResponse = { allowed: true, remainingTokens: 50000, quotaPct: 25 };

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        let body: Record<string, unknown> | undefined;
        if (init?.body && typeof init.body === 'string') {
          try {
            body = JSON.parse(init.body) as Record<string, unknown>;
          } catch {
            /* non-JSON body */
          }
        }
        fetchCalls.push({ url: urlStr, body });

        if (urlStr.includes('/ai/check')) {
          quotaCheckCallCount++;
          if (quotaCheckShouldThrow) {
            throw new Error('ECONNREFUSED: Platform API unreachable');
          }
          return jsonOk(quotaCheckResponse);
        }
        if (urlStr.includes('/ai/record')) {
          return jsonOk({ recorded: true, quotaPct: 25 });
        }
        return new Response('Not Found', { status: 404 });
      }),
    );

    // Real components
    anthropicProvider = createStubProvider('anthropic');
    openaiProvider = createStubProvider('openai');

    providerRegistry = new ProviderRegistry();
    providerRegistry.register(anthropicProvider);
    providerRegistry.register(openaiProvider);

    modelRegistry = new ModelRegistry({ models: TEST_MODELS });

    credentialResolver = new CredentialResolver(
      { getCredential: vi.fn(async () => null) },
      MASTER_KEY,
      (key) =>
        key === 'ANTHROPIC_API_KEY'
          ? 'sk-ant-int-test'
          : key === 'OPENAI_API_KEY'
            ? 'sk-oai-int-test'
            : undefined,
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ─── 1. Full happy path ─────────────────────────────────────────────────

  describe('Full flow: complete() → quota check → provider call → usage record → response', () => {
    it('wires real QuotaClient, UsageRecorder, and FallbackHandler end-to-end', async () => {
      const quotaClient = new QuotaClient({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });
      const usageRecorder = new UsageRecorder({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });
      const fallbackHandler = new FallbackHandler(modelRegistry, SILENT_LOGGER);

      const gateway = new AiGateway({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        providerRegistry,
        credentialResolver,
        modelRegistry,
        usageRecorder,
        quotaClient,
        logger: SILENT_LOGGER,
        fallbackHandler,
      });

      const response = await gateway.complete(BASE_REQUEST);
      await flushAsync();

      // ── Response shape ──
      expect(response.content).toBe('Response from claude-sonnet-4-5');
      expect(response.provider).toBe('anthropic');
      expect(response.model).toBe('claude-sonnet-4-5');
      expect(response.finishReason).toBe('stop');
      expect(response.usage).toEqual({
        promptTokens: 50,
        completionTokens: 100,
        totalTokens: 150,
      });
      expect(response.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.fallbackUsed).toBe(false);
      expect(response.fallbackFrom).toBeUndefined();
      expect(response.isByok).toBe(false);
      expect(response.quotaPct).toBe(25);

      // ── Quota check HTTP call ──
      const checkCall = fetchCalls.find((c) => c.url.includes('/ai/check'));
      expect(checkCall).toBeDefined();
      expect(checkCall!.url).toContain('/platform/tenants/tenant-int-1/ai/check');
      expect(checkCall!.body).toEqual({
        estimatedTokens: 100,
        featureKey: 'chat.integration',
      });

      // ── Provider called with correct args ──
      expect(anthropicProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-5' }),
        'sk-ant-int-test',
      );

      // ── Usage record HTTP call ──
      const recordCall = fetchCalls.find((c) => c.url.includes('/ai/record'));
      expect(recordCall).toBeDefined();
      expect(recordCall!.url).toContain('/platform/tenants/tenant-int-1/ai/record');
      expect(recordCall!.body).toEqual(
        expect.objectContaining({
          userId: 'user-int-1',
          featureKey: 'chat.integration',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          promptTokens: 50,
          completionTokens: 100,
          totalTokens: 150,
          isByok: false,
          fallbackUsed: false,
          requestId: response.requestId,
        }),
      );

      await usageRecorder.close();
    });
  });

  // ─── 2. Quota exceeded ──────────────────────────────────────────────────

  describe('Quota exceeded → error thrown before provider call', () => {
    it('throws AiQuotaExceededError and does NOT call any provider', async () => {
      quotaCheckResponse = { allowed: false, remainingTokens: 0, quotaPct: 105 };

      const quotaClient = new QuotaClient({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });
      const usageRecorder = new UsageRecorder({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });

      const gateway = new AiGateway({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        providerRegistry,
        credentialResolver,
        modelRegistry,
        usageRecorder,
        quotaClient,
        logger: SILENT_LOGGER,
      });

      await expect(gateway.complete(BASE_REQUEST)).rejects.toThrow(AiQuotaExceededError);

      // Neither provider was called
      expect(anthropicProvider.complete).not.toHaveBeenCalled();
      expect(openaiProvider.complete).not.toHaveBeenCalled();

      // No usage record was sent
      const recordCall = fetchCalls.find((c) => c.url.includes('/ai/record'));
      expect(recordCall).toBeUndefined();

      await usageRecorder.close();
    });
  });

  // ─── 3. Provider failure → fallback ─────────────────────────────────────

  describe('Provider failure → fallback → success', () => {
    it('falls back to secondary model when primary returns 429 (cross-provider)', async () => {
      // Make Anthropic provider fail with retryable 429
      const failingAnthropicProvider = createStubProvider('anthropic');
      (failingAnthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ProviderError('anthropic', 'Rate limited', {
          statusCode: 429,
          isRetryable: true,
        }),
      );

      const fallbackRegistry = new ProviderRegistry();
      fallbackRegistry.register(failingAnthropicProvider);
      fallbackRegistry.register(openaiProvider);

      const quotaClient = new QuotaClient({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });
      const usageRecorder = new UsageRecorder({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });
      const fallbackHandler = new FallbackHandler(modelRegistry, SILENT_LOGGER);

      const gateway = new AiGateway({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        providerRegistry: fallbackRegistry,
        credentialResolver,
        modelRegistry,
        usageRecorder,
        quotaClient,
        logger: SILENT_LOGGER,
        fallbackHandler,
      });

      const response = await gateway.complete(BASE_REQUEST);
      await flushAsync();

      // Response came from fallback (OpenAI gpt-4o)
      expect(response.provider).toBe('openai');
      expect(response.model).toBe('gpt-4o');
      expect(response.content).toBe('Response from gpt-4o');
      expect(response.fallbackUsed).toBe(true);
      expect(response.fallbackFrom).toBe('claude-sonnet-4-5');

      // Usage record reflects fallback
      const recordCall = fetchCalls.find((c) => c.url.includes('/ai/record'));
      expect(recordCall).toBeDefined();
      expect(recordCall!.body).toEqual(
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4o',
          fallbackUsed: true,
          fallbackFrom: 'claude-sonnet-4-5',
        }),
      );

      await usageRecorder.close();
    });

    it('throws ProviderUnavailableError when both primary and fallback fail', async () => {
      // Both providers fail
      const failingAnthropicProvider = createStubProvider('anthropic');
      (failingAnthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ProviderError('anthropic', 'Server error', {
          statusCode: 500,
          isRetryable: true,
        }),
      );
      const failingOpenaiProvider = createStubProvider('openai');
      (failingOpenaiProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ProviderError('openai', 'Server error', {
          statusCode: 500,
          isRetryable: true,
        }),
      );

      const failRegistry = new ProviderRegistry();
      failRegistry.register(failingAnthropicProvider);
      failRegistry.register(failingOpenaiProvider);

      const quotaClient = new QuotaClient({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });
      const usageRecorder = new UsageRecorder({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });
      const fallbackHandler = new FallbackHandler(modelRegistry, SILENT_LOGGER);

      const gateway = new AiGateway({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        providerRegistry: failRegistry,
        credentialResolver,
        modelRegistry,
        usageRecorder,
        quotaClient,
        logger: SILENT_LOGGER,
        fallbackHandler,
      });

      await expect(gateway.complete(BASE_REQUEST)).rejects.toThrow(ProviderUnavailableError);

      await usageRecorder.close();
    });
  });

  // ─── 4. Circuit breaker ─────────────────────────────────────────────────

  describe('Platform unreachable → circuit breaker → stale cache', () => {
    it('serves stale cached quota data when circuit breaker opens', async () => {
      // First call succeeds, subsequent calls fail
      let checkCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string | URL, init?: RequestInit) => {
          const urlStr = typeof url === 'string' ? url : url.toString();
          let body: Record<string, unknown> | undefined;
          if (init?.body && typeof init.body === 'string') {
            try {
              body = JSON.parse(init.body) as Record<string, unknown>;
            } catch {
              /* non-JSON body */
            }
          }
          fetchCalls.push({ url: urlStr, body });

          if (urlStr.includes('/ai/check')) {
            checkCount++;
            if (checkCount === 1) {
              return jsonOk({ allowed: true, remainingTokens: 40000, quotaPct: 20 });
            }
            throw new Error('ECONNREFUSED: Platform API unreachable');
          }
          if (urlStr.includes('/ai/record')) {
            return jsonOk({ recorded: true, quotaPct: 20 });
          }
          return new Response('Not Found', { status: 404 });
        }),
      );

      // failureThreshold: 1 so circuit opens on first failure
      const quotaClient = new QuotaClient({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
        circuitBreaker: { failureThreshold: 1 },
      });
      const usageRecorder = new UsageRecorder({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });

      const gateway = new AiGateway({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        providerRegistry,
        credentialResolver,
        modelRegistry,
        usageRecorder,
        quotaClient,
        logger: SILENT_LOGGER,
      });

      // Call 1: succeeds — quota result is cached
      const r1 = await gateway.complete(BASE_REQUEST);
      expect(r1.quotaPct).toBe(20);
      expect(quotaClient.getCircuitBreaker().getState()).toBe('CLOSED');

      // Call 2: platform unreachable — circuit opens, serves stale cache
      const r2 = await gateway.complete(BASE_REQUEST);
      expect(r2.quotaPct).toBe(20); // From stale cache
      expect(quotaClient.getCircuitBreaker().getState()).toBe('OPEN');

      // Call 3: circuit still OPEN — serves stale cache without HTTP call
      const quotaCheckCalls = fetchCalls.filter((c) => c.url.includes('/ai/check'));
      const callsBefore = quotaCheckCalls.length;

      const r3 = await gateway.complete(BASE_REQUEST);
      expect(r3.quotaPct).toBe(20);

      // No new quota check HTTP call was made (served from cache)
      const quotaCheckCallsAfter = fetchCalls.filter((c) => c.url.includes('/ai/check'));
      expect(quotaCheckCallsAfter.length).toBe(callsBefore);

      // Provider was still called (gateway degrades gracefully)
      expect(anthropicProvider.complete).toHaveBeenCalledTimes(3);

      await flushAsync();
      await usageRecorder.close();
    });
  });

  // ─── 5. requestId consistency ───────────────────────────────────────────

  describe('requestId flows through entire pipeline', () => {
    it('generates unique requestId appearing in response and usage record HTTP body', async () => {
      const quotaClient = new QuotaClient({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });
      const usageRecorder = new UsageRecorder({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });

      const gateway = new AiGateway({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        providerRegistry,
        credentialResolver,
        modelRegistry,
        usageRecorder,
        quotaClient,
        logger: SILENT_LOGGER,
      });

      const response = await gateway.complete(BASE_REQUEST);
      await flushAsync();

      // requestId is a valid UUID v4
      expect(response.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      // Same requestId in usage record HTTP call body
      const recordCall = fetchCalls.find((c) => c.url.includes('/ai/record'));
      expect(recordCall).toBeDefined();
      expect(recordCall!.body!.requestId).toBe(response.requestId);

      // Second call generates a different requestId
      const response2 = await gateway.complete(BASE_REQUEST);
      await flushAsync();

      expect(response2.requestId).not.toBe(response.requestId);
      expect(response2.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      // Second usage record has the second requestId
      const recordCalls = fetchCalls.filter((c) => c.url.includes('/ai/record'));
      expect(recordCalls).toHaveLength(2);
      expect(recordCalls[1]!.body!.requestId).toBe(response2.requestId);

      await usageRecorder.close();
    });
  });

  // ─── 6. Usage record field completeness ─────────────────────────────────

  describe('All usage record fields populated correctly', () => {
    it('includes every required field in the usage record HTTP POST body', async () => {
      const quotaClient = new QuotaClient({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });
      const usageRecorder = new UsageRecorder({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });

      const gateway = new AiGateway({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        providerRegistry,
        credentialResolver,
        modelRegistry,
        usageRecorder,
        quotaClient,
        logger: SILENT_LOGGER,
      });

      const response = await gateway.complete({
        ...BASE_REQUEST,
        featureKey: 'invoice.summary',
      });
      await flushAsync();

      const recordCall = fetchCalls.find((c) => c.url.includes('/ai/record'));
      expect(recordCall).toBeDefined();

      const body = recordCall!.body!;
      // tenantId is in the URL, not the body
      expect(recordCall!.url).toContain('/platform/tenants/tenant-int-1/ai/record');
      expect(body.userId).toBe('user-int-1');
      expect(body.featureKey).toBe('invoice.summary');
      expect(body.provider).toBe('anthropic');
      expect(body.model).toBe('claude-sonnet-4-5');
      expect(body.promptTokens).toBe(50);
      expect(body.completionTokens).toBe(100);
      expect(body.totalTokens).toBe(150);
      expect(body.costEstimate).toBe(0);
      expect(body.requestId).toBe(response.requestId);
      expect(body.isByok).toBe(false);
      expect(typeof body.latencyMs).toBe('number');
      expect(body.latencyMs as number).toBeGreaterThanOrEqual(0);
      expect(body.fallbackUsed).toBe(false);
      // fallbackFrom is undefined → omitted from JSON
      expect(body.fallbackFrom).toBeUndefined();

      await usageRecorder.close();
    });

    it('includes fallback fields when fallback was used', async () => {
      const failingAnthropicProvider = createStubProvider('anthropic');
      (failingAnthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ProviderError('anthropic', 'Rate limited', {
          statusCode: 429,
          isRetryable: true,
        }),
      );

      const fallbackRegistry = new ProviderRegistry();
      fallbackRegistry.register(failingAnthropicProvider);
      fallbackRegistry.register(openaiProvider);

      const quotaClient = new QuotaClient({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });
      const usageRecorder = new UsageRecorder({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        logger: SILENT_LOGGER,
      });
      const fallbackHandler = new FallbackHandler(modelRegistry, SILENT_LOGGER);

      const gateway = new AiGateway({
        platformApiUrl: PLATFORM_URL,
        serviceToken: SERVICE_TOKEN,
        providerRegistry: fallbackRegistry,
        credentialResolver,
        modelRegistry,
        usageRecorder,
        quotaClient,
        logger: SILENT_LOGGER,
        fallbackHandler,
      });

      const response = await gateway.complete(BASE_REQUEST);
      await flushAsync();

      const recordCall = fetchCalls.find((c) => c.url.includes('/ai/record'));
      expect(recordCall).toBeDefined();

      const body = recordCall!.body!;
      expect(body.provider).toBe('openai');
      expect(body.model).toBe('gpt-4o');
      expect(body.fallbackUsed).toBe(true);
      expect(body.fallbackFrom).toBe('claude-sonnet-4-5');
      expect(body.requestId).toBe(response.requestId);

      await usageRecorder.close();
    });
  });

  // ─── E2E with real Platform API (CI-only, optional) ─────────────────────

  describe.runIf(!!process.env.CI)('E2E with real Platform API', () => {
    it('performs full quota check → record flow against real Platform API endpoints', async () => {
      // Restore real fetch for E2E test
      globalThis.fetch = originalFetch;

      const realPlatformUrl =
        process.env.PLATFORM_API_URL ?? 'http://localhost:3001/api/v1';
      const realServiceToken = process.env.PLATFORM_SERVICE_TOKEN ?? '';
      const testTenantId = process.env.TEST_TENANT_ID ?? 'test-tenant';

      const quotaClient = new QuotaClient({
        platformApiUrl: realPlatformUrl,
        serviceToken: realServiceToken,
        logger: SILENT_LOGGER,
      });
      const usageRecorder = new UsageRecorder({
        platformApiUrl: realPlatformUrl,
        serviceToken: realServiceToken,
        logger: SILENT_LOGGER,
      });

      const gateway = new AiGateway({
        platformApiUrl: realPlatformUrl,
        serviceToken: realServiceToken,
        providerRegistry,
        credentialResolver,
        modelRegistry,
        usageRecorder,
        quotaClient,
        logger: SILENT_LOGGER,
      });

      const response = await gateway.complete({
        ...BASE_REQUEST,
        tenantId: testTenantId,
      });

      // Verify response structure
      expect(response.content).toBeDefined();
      expect(response.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(typeof response.quotaPct).toBe('number');

      // Wait for async usage recording to complete
      await new Promise((r) => setTimeout(r, 500));

      await usageRecorder.close();
    });
  });
});
