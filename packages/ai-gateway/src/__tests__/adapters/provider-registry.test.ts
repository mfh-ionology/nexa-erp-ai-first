import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from '../../providers/provider-registry.js';
import { ProviderUnavailableError } from '../../errors/index.js';
import type { LLMProvider } from '../../providers/llm-provider.interface.js';
import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  Message,
  Tool,
  ProviderCapability,
} from '../../types/index.js';

/** Minimal stub implementing LLMProvider for testing. */
function createStubProvider(id: string): LLMProvider {
  return {
    providerId: id,
    complete: async (_req: LLMRequest, _apiKey: string): Promise<LLMResponse> => ({
      content: 'stub',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: 'stub-model',
      provider: id,
      finishReason: 'stop',
    }),
    stream: async function* (_req: LLMRequest, _apiKey: string): AsyncIterable<LLMStreamChunk> {
      yield { type: 'done', finishReason: 'stop' };
    },
    capabilities: (): ProviderCapability[] => ['completion'],
    validateModel: (_modelId: string): boolean => true,
    estimateTokens: async (_msgs: Message[], _tools?: Tool[]): Promise<number> => 0,
  };
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  // ─── register & get ───────────────────────────────────────────────────

  it('registers and retrieves a provider by ID', () => {
    const provider = createStubProvider('anthropic');
    registry.register(provider);

    const retrieved = registry.get('anthropic');
    expect(retrieved).toBe(provider);
    expect(retrieved.providerId).toBe('anthropic');
  });

  it('registers multiple providers', () => {
    registry.register(createStubProvider('anthropic'));
    registry.register(createStubProvider('openai'));

    expect(registry.get('anthropic').providerId).toBe('anthropic');
    expect(registry.get('openai').providerId).toBe('openai');
  });

  it('overwrites existing provider on re-registration', () => {
    const original = createStubProvider('anthropic');
    const replacement = createStubProvider('anthropic');

    registry.register(original);
    registry.register(replacement);

    const retrieved = registry.get('anthropic');
    expect(retrieved).toBe(replacement);
    expect(retrieved).not.toBe(original);
  });

  // ─── get — missing provider ──────────────────────────────────────────

  it('throws ProviderUnavailableError for unregistered provider', () => {
    expect(() => registry.get('nonexistent')).toThrow(ProviderUnavailableError);
  });

  it('includes provider name in error message', () => {
    try {
      registry.get('google');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderUnavailableError);
      expect((err as Error).message).toContain('google');
    }
  });

  // ─── listProviders ────────────────────────────────────────────────────

  it('lists all registered provider IDs', () => {
    registry.register(createStubProvider('anthropic'));
    registry.register(createStubProvider('openai'));

    const providers = registry.listProviders();
    expect(providers).toContain('anthropic');
    expect(providers).toContain('openai');
    expect(providers).toHaveLength(2);
  });

  it('returns empty array when no providers registered', () => {
    expect(registry.listProviders()).toEqual([]);
  });

  // ─── has ──────────────────────────────────────────────────────────────

  it('returns true for registered providers', () => {
    registry.register(createStubProvider('anthropic'));
    expect(registry.has('anthropic')).toBe(true);
  });

  it('returns false for unregistered providers', () => {
    expect(registry.has('anthropic')).toBe(false);
  });
});
