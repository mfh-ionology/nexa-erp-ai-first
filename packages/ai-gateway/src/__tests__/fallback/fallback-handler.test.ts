import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FallbackHandler, isFallbackTrigger } from '../../fallback/fallback-handler.js';
import { ProviderRegistry } from '../../providers/provider-registry.js';
import { ModelRegistry } from '../../model-registry.js';
import { CredentialResolver } from '../../credentials/credential-resolver.js';
import type { ByokCredentialSource } from '../../credentials/credential-resolver.js';
import {
  ProviderError,
  ProviderUnavailableError,
} from '../../errors/index.js';
import type { LLMProvider } from '../../providers/llm-provider.interface.js';
import type {
  AiModelConfig,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  Message,
  Tool,
  ProviderCapability,
} from '../../types/index.js';
import pino from 'pino';

// ─── Test Helpers ───────────────────────────────────────────────────────────

const SILENT_LOGGER = pino({ level: 'silent' });

const MOCK_LLM_RESPONSE: LLMResponse = {
  content: 'Hello from primary!',
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  model: 'claude-sonnet-4-5',
  provider: 'anthropic',
  finishReason: 'stop',
};

const MOCK_FALLBACK_RESPONSE: LLMResponse = {
  content: 'Hello from fallback!',
  usage: { promptTokens: 12, completionTokens: 22, totalTokens: 34 },
  model: 'gpt-4o',
  provider: 'openai',
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
    // No fallback configured
    isDefault: false,
    config: { timeout: 15000, maxTokens: 4096 },
  },
];

const MOCK_REQUEST: LLMRequest = {
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hello' }],
  maxOutputTokens: 1024,
};

const TENANT_ID = 'tenant-001';

function createStubProvider(
  id: string,
  completeFn?: (req: LLMRequest, apiKey: string) => Promise<LLMResponse>,
): LLMProvider {
  return {
    providerId: id,
    complete: vi.fn(
      completeFn ??
        (async (_req: LLMRequest, _apiKey: string): Promise<LLMResponse> => ({
          ...MOCK_LLM_RESPONSE,
          provider: id,
          model: id === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5',
        })),
    ),
    stream: async function* (
      _req: LLMRequest,
      _apiKey: string,
    ): AsyncIterable<LLMStreamChunk> {
      yield { type: 'done', finishReason: 'stop' };
    },
    capabilities: (): ProviderCapability[] => ['completion'],
    validateModel: (_modelId: string): boolean => true,
    estimateTokens: vi.fn(
      async (_msgs: Message[], _tools?: Tool[]): Promise<number> => 100,
    ),
  };
}

function createByokSource(): ByokCredentialSource {
  return {
    getCredential: vi.fn(async () => null),
  };
}

// ─── isFallbackTrigger Tests ────────────────────────────────────────────────

describe('isFallbackTrigger', () => {
  it('returns true for 429 rate limit', () => {
    const err = new ProviderError('anthropic', 'Rate limited', {
      statusCode: 429,
      isRetryable: true,
    });
    expect(isFallbackTrigger(err)).toBe(true);
  });

  it('returns true for 500 server error', () => {
    const err = new ProviderError('anthropic', 'Internal server error', {
      statusCode: 500,
      isRetryable: true,
    });
    expect(isFallbackTrigger(err)).toBe(true);
  });

  it('returns true for 502 bad gateway', () => {
    const err = new ProviderError('anthropic', 'Bad gateway', {
      statusCode: 502,
      isRetryable: true,
    });
    expect(isFallbackTrigger(err)).toBe(true);
  });

  it('returns true for 503 service unavailable', () => {
    const err = new ProviderError('openai', 'Service unavailable', {
      statusCode: 503,
      isRetryable: true,
    });
    expect(isFallbackTrigger(err)).toBe(true);
  });

  it('returns true for timeout/connection error (no statusCode, retryable)', () => {
    const err = new ProviderError('anthropic', 'Request timeout', {
      isRetryable: true,
    });
    expect(isFallbackTrigger(err)).toBe(true);
  });

  it('returns false for 400 bad request', () => {
    const err = new ProviderError('anthropic', 'Bad request', {
      statusCode: 400,
      isRetryable: false,
    });
    expect(isFallbackTrigger(err)).toBe(false);
  });

  it('returns false for 401 auth error', () => {
    const err = new ProviderError('anthropic', 'Unauthorized', {
      statusCode: 401,
      isRetryable: false,
    });
    expect(isFallbackTrigger(err)).toBe(false);
  });

  it('returns false for 403 forbidden', () => {
    const err = new ProviderError('anthropic', 'Forbidden', {
      statusCode: 403,
      isRetryable: false,
    });
    expect(isFallbackTrigger(err)).toBe(false);
  });

  it('returns false for connection error not marked retryable', () => {
    const err = new ProviderError('anthropic', 'DNS error', {
      isRetryable: false,
    });
    expect(isFallbackTrigger(err)).toBe(false);
  });
});

// ─── FallbackHandler Tests ──────────────────────────────────────────────────

describe('FallbackHandler', () => {
  let providerRegistry: ProviderRegistry;
  let modelRegistry: ModelRegistry;
  let credentialResolver: CredentialResolver;
  let handler: FallbackHandler;
  let anthropicProvider: LLMProvider;
  let openaiProvider: LLMProvider;

  beforeEach(() => {
    providerRegistry = new ProviderRegistry();
    modelRegistry = new ModelRegistry({ models: MOCK_MODELS });

    const byokSource = createByokSource();
    credentialResolver = new CredentialResolver(
      byokSource,
      'a'.repeat(64), // 32-byte hex master key
      (key: string) => {
        // Provide vendor keys for both providers
        if (key === 'ANTHROPIC_API_KEY') return 'sk-ant-test';
        if (key === 'OPENAI_API_KEY') return 'sk-openai-test';
        return undefined;
      },
    );

    anthropicProvider = createStubProvider('anthropic');
    openaiProvider = createStubProvider('openai', async () => ({
      ...MOCK_FALLBACK_RESPONSE,
    }));

    providerRegistry.register(anthropicProvider);
    providerRegistry.register(openaiProvider);

    handler = new FallbackHandler(modelRegistry, SILENT_LOGGER);
  });

  it('returns primary response when primary succeeds — no fallback', async () => {
    const primaryModel = MOCK_MODELS[0]!; // claude-sonnet-4-5

    const result = await handler.executeWithFallback(
      primaryModel,
      MOCK_REQUEST,
      providerRegistry,
      credentialResolver,
      TENANT_ID,
    );

    expect(result.fallbackUsed).toBe(false);
    expect(result.fallbackFrom).toBeUndefined();
    expect(result.response.provider).toBe('anthropic');
    expect(anthropicProvider.complete).toHaveBeenCalledOnce();
    expect(openaiProvider.complete).not.toHaveBeenCalled();
  });

  it('falls back on 429 rate limit — fallback succeeds', async () => {
    const primaryModel = MOCK_MODELS[0]!; // claude-sonnet-4-5 -> fallback: gpt-4o

    // Primary fails with 429
    (anthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ProviderError('anthropic', 'Rate limited', {
        statusCode: 429,
        isRetryable: true,
      }),
    );

    const result = await handler.executeWithFallback(
      primaryModel,
      MOCK_REQUEST,
      providerRegistry,
      credentialResolver,
      TENANT_ID,
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackFrom).toBe('claude-sonnet-4-5');
    expect(result.response.provider).toBe('openai');
    expect(result.response.model).toBe('gpt-4o');
    expect(anthropicProvider.complete).toHaveBeenCalledOnce();
    expect(openaiProvider.complete).toHaveBeenCalledOnce();
  });

  it('falls back on 500 server error — fallback succeeds', async () => {
    const primaryModel = MOCK_MODELS[0]!;

    (anthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ProviderError('anthropic', 'Internal server error', {
        statusCode: 500,
        isRetryable: true,
      }),
    );

    const result = await handler.executeWithFallback(
      primaryModel,
      MOCK_REQUEST,
      providerRegistry,
      credentialResolver,
      TENANT_ID,
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackFrom).toBe('claude-sonnet-4-5');
    expect(result.response.provider).toBe('openai');
  });

  it('falls back on timeout — fallback succeeds', async () => {
    const primaryModel = MOCK_MODELS[0]!;

    (anthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ProviderError('anthropic', 'Request timeout after 30000ms', {
        isRetryable: true,
      }),
    );

    const result = await handler.executeWithFallback(
      primaryModel,
      MOCK_REQUEST,
      providerRegistry,
      credentialResolver,
      TENANT_ID,
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackFrom).toBe('claude-sonnet-4-5');
    expect(result.response.provider).toBe('openai');
  });

  it('throws original error when no fallback is configured', async () => {
    const noFallbackModel = MOCK_MODELS[2]!; // claude-haiku-4-5 — no fallbackModelName

    (anthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ProviderError('anthropic', 'Rate limited', {
        statusCode: 429,
        isRetryable: true,
      }),
    );

    await expect(
      handler.executeWithFallback(
        noFallbackModel,
        MOCK_REQUEST,
        providerRegistry,
        credentialResolver,
        TENANT_ID,
      ),
    ).rejects.toThrow(ProviderError);

    expect(openaiProvider.complete).not.toHaveBeenCalled();
  });

  it('throws ProviderUnavailableError when both primary and fallback fail', async () => {
    const primaryModel = MOCK_MODELS[0]!; // claude-sonnet-4-5 -> fallback: gpt-4o

    const primaryErr = new ProviderError('anthropic', 'Rate limited', {
      statusCode: 429,
      isRetryable: true,
    });
    const fallbackErr = new ProviderError('openai', 'Server overloaded', {
      statusCode: 503,
      isRetryable: true,
    });

    (anthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(primaryErr);
    (openaiProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(fallbackErr);

    try {
      await handler.executeWithFallback(
        primaryModel,
        MOCK_REQUEST,
        providerRegistry,
        credentialResolver,
        TENANT_ID,
      );
      expect.fail('Should have thrown ProviderUnavailableError');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderUnavailableError);
      const unavailable = err as ProviderUnavailableError;
      expect(unavailable.primaryError).toBe(primaryErr);
      expect(unavailable.fallbackError).toBe(fallbackErr);
      expect(unavailable.message).toContain('Primary:');
      expect(unavailable.message).toContain('Fallback:');
    }
  });

  it('does NOT retry on 400 bad request — throws original ProviderError', async () => {
    const primaryModel = MOCK_MODELS[0]!;

    const badRequestErr = new ProviderError('anthropic', 'Bad request: invalid model', {
      statusCode: 400,
      isRetryable: false,
    });

    (anthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(badRequestErr);

    await expect(
      handler.executeWithFallback(
        primaryModel,
        MOCK_REQUEST,
        providerRegistry,
        credentialResolver,
        TENANT_ID,
      ),
    ).rejects.toThrow(badRequestErr);

    // Fallback provider should NOT be called
    expect(openaiProvider.complete).not.toHaveBeenCalled();
  });

  it('does NOT retry on 401 auth error — throws original ProviderError', async () => {
    const primaryModel = MOCK_MODELS[0]!;

    const authErr = new ProviderError('anthropic', 'Unauthorized', {
      statusCode: 401,
      isRetryable: false,
    });

    (anthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(authErr);

    await expect(
      handler.executeWithFallback(
        primaryModel,
        MOCK_REQUEST,
        providerRegistry,
        credentialResolver,
        TENANT_ID,
      ),
    ).rejects.toThrow(authErr);

    expect(openaiProvider.complete).not.toHaveBeenCalled();
  });

  it('supports cross-provider fallback (Anthropic primary -> OpenAI fallback)', async () => {
    const primaryModel = MOCK_MODELS[0]!; // anthropic -> openai fallback

    (anthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ProviderError('anthropic', 'Service unavailable', {
        statusCode: 503,
        isRetryable: true,
      }),
    );

    const result = await handler.executeWithFallback(
      primaryModel,
      MOCK_REQUEST,
      providerRegistry,
      credentialResolver,
      TENANT_ID,
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackFrom).toBe('claude-sonnet-4-5');
    expect(result.response.provider).toBe('openai');
    expect(result.response.model).toBe('gpt-4o');

    // Verify cross-provider: primary was anthropic, fallback was openai
    expect(anthropicProvider.complete).toHaveBeenCalledOnce();
    expect(openaiProvider.complete).toHaveBeenCalledOnce();
  });

  it('passes the fallback model ID in the request to the fallback provider', async () => {
    const primaryModel = MOCK_MODELS[0]!;

    (anthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ProviderError('anthropic', 'Rate limited', {
        statusCode: 429,
        isRetryable: true,
      }),
    );

    await handler.executeWithFallback(
      primaryModel,
      MOCK_REQUEST,
      providerRegistry,
      credentialResolver,
      TENANT_ID,
    );

    // The fallback request should use the fallback model's ID
    const fallbackCall = (openaiProvider.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    const fallbackRequest = fallbackCall[0] as LLMRequest;
    expect(fallbackRequest.model).toBe('gpt-4o');
  });

  it('re-throws non-ProviderError exceptions without attempting fallback', async () => {
    const primaryModel = MOCK_MODELS[0]!;

    const genericError = new Error('Something unexpected');
    (anthropicProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(genericError);

    await expect(
      handler.executeWithFallback(
        primaryModel,
        MOCK_REQUEST,
        providerRegistry,
        credentialResolver,
        TENANT_ID,
      ),
    ).rejects.toThrow(genericError);

    expect(openaiProvider.complete).not.toHaveBeenCalled();
  });
});
