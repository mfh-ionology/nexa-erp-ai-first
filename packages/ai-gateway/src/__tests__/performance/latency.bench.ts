/**
 * AI Gateway Latency Benchmark — NFR47
 *
 * Measures the overhead that the AI Gateway adds on top of the LLM call itself.
 * With mocked HTTP (Platform API) and mocked LLM providers, the measured latency
 * represents: model resolution + token estimation + quota check + credential
 * resolution + request building + response building + fire-and-forget usage recording.
 *
 * Assertion: p95 < 100ms (NFR47).
 *
 * Run with: vitest run latency.bench --config packages/ai-gateway/vitest.config.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import pino from 'pino';
import { AiGateway } from '../../ai-gateway.js';
import { ProviderRegistry } from '../../providers/provider-registry.js';
import { ModelRegistry } from '../../model-registry.js';
import { CredentialResolver } from '../../credentials/credential-resolver.js';
import { QuotaClient } from '../../quota/quota-client.js';
import { UsageRecorder } from '../../quota/usage-recorder.js';
import type { LLMProvider } from '../../providers/llm-provider.interface.js';
import type {
  AiGatewayRequest,
  AiModelConfig,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ProviderCapability,
} from '../../types/index.js';

const SILENT_LOGGER = pino({ level: 'silent' });

const BENCH_MODELS: AiModelConfig[] = [
  {
    name: 'claude-sonnet-4-5',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-5',
    routingTags: ['standard'],
    isDefault: true,
    config: { timeout: 30000, maxTokens: 8192 },
  },
];

/** Provider that resolves instantly (zero-latency mock). */
function createFastProvider(): LLMProvider {
  return {
    providerId: 'anthropic',
    complete: async (req: LLMRequest): Promise<LLMResponse> => ({
      content: 'Fast response',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: req.model,
      provider: 'anthropic',
      finishReason: 'stop',
    }),
    stream: async function* (): AsyncIterable<LLMStreamChunk> {
      yield { type: 'done', finishReason: 'stop' };
    },
    capabilities: (): ProviderCapability[] => ['completion'],
    validateModel: (): boolean => true,
    estimateTokens: async (): Promise<number> => 100,
  };
}

// Pre-built response to avoid repeated JSON.stringify in the hot loop
const QUOTA_RESPONSE_BODY = JSON.stringify({
  data: { allowed: true, remainingTokens: 50000, quotaPct: 25 },
});

describe('AI Gateway — Latency Benchmark (NFR47)', () => {
  let originalFetch: typeof globalThis.fetch;
  let usageRecorder: UsageRecorder;

  beforeEach(() => {
    originalFetch = globalThis.fetch;

    // Ultra-fast mock fetch — minimal overhead
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(QUOTA_RESPONSE_BODY, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    if (usageRecorder) {
      await usageRecorder.close();
    }
  });

  it('maintains p95 latency under 100ms across 100 iterations', async () => {
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(createFastProvider());

    // ISSUE #12 FIX: Create QuotaClient with short cache TTL and re-create per batch
    // to measure actual quota HTTP path, not just cached responses.
    // Each iteration creates a fresh QuotaClient so the quota HTTP call is exercised.

    usageRecorder = new UsageRecorder({
      platformApiUrl: 'http://localhost:3001/api/v1',
      serviceToken: 'bench-token',
      logger: SILENT_LOGGER,
    });

    const credentialResolver = new CredentialResolver(
      { getCredential: async () => null },
      '0'.repeat(64),
      (key) => (key === 'ANTHROPIC_API_KEY' ? 'sk-bench' : undefined),
    );

    const request: AiGatewayRequest = {
      tenantId: 'tenant-bench',
      userId: 'user-bench',
      featureKey: 'bench.test',
      messages: [{ role: 'user', content: 'Benchmark message' }],
    };

    const ITERATIONS = 100;
    const latencies: number[] = [];

    // Warm up (1 iteration to prime JIT)
    const warmupClient = new QuotaClient({
      platformApiUrl: 'http://localhost:3001/api/v1',
      serviceToken: 'bench-token',
      logger: SILENT_LOGGER,
      cacheTtlMs: 0, // No caching — every call hits the (mocked) HTTP path
    });
    const warmupGateway = new AiGateway({
      platformApiUrl: 'http://localhost:3001/api/v1',
      serviceToken: 'bench-token',
      providerRegistry,
      credentialResolver,
      modelRegistry: new ModelRegistry({ models: BENCH_MODELS }),
      usageRecorder,
      quotaClient: warmupClient,
      logger: SILENT_LOGGER,
    });
    await warmupGateway.complete(request);

    // Measured iterations — each creates a fresh QuotaClient to avoid cache hits
    for (let i = 0; i < ITERATIONS; i++) {
      const quotaClient = new QuotaClient({
        platformApiUrl: 'http://localhost:3001/api/v1',
        serviceToken: 'bench-token',
        logger: SILENT_LOGGER,
        cacheTtlMs: 0, // No caching
      });
      const gateway = new AiGateway({
        platformApiUrl: 'http://localhost:3001/api/v1',
        serviceToken: 'bench-token',
        providerRegistry,
        credentialResolver,
        modelRegistry: new ModelRegistry({ models: BENCH_MODELS }),
        usageRecorder,
        quotaClient,
        logger: SILENT_LOGGER,
      });

      const start = performance.now();
      await gateway.complete(request);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);

    const p50 = latencies[Math.floor(ITERATIONS * 0.5)]!;
    const p95 = latencies[Math.ceil(ITERATIONS * 0.95) - 1]!;
    const p99 = latencies[Math.ceil(ITERATIONS * 0.99) - 1]!;
    const avg = latencies.reduce((a, b) => a + b, 0) / ITERATIONS;
    const min = latencies[0]!;
    const max = latencies[ITERATIONS - 1]!;

    // Log metrics for visibility
    console.log(`\n  Latency benchmark (${ITERATIONS} iterations):`);
    console.log(`    Avg:  ${avg.toFixed(2)}ms`);
    console.log(`    P50:  ${p50.toFixed(2)}ms`);
    console.log(`    P95:  ${p95.toFixed(2)}ms`);
    console.log(`    P99:  ${p99.toFixed(2)}ms`);
    console.log(`    Min:  ${min.toFixed(2)}ms`);
    console.log(`    Max:  ${max.toFixed(2)}ms\n`);

    // NFR47: quota check + usage recording adds no more than 100ms
    expect(p95).toBeLessThan(100);
  });
});
