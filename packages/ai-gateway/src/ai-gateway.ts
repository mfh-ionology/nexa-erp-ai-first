import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import { AiQuotaExceededError, ProviderError } from './errors/index.js';
import { isFallbackTrigger } from './fallback/fallback-handler.js';
import type { CredentialResolver } from './credentials/credential-resolver.js';
import type { ModelRegistry } from './model-registry.js';
import type { ProviderRegistry } from './providers/provider-registry.js';
import type {
  AiGatewayRequest,
  AiGatewayResponse,
  AiModelConfig,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  QuotaCheckResult,
  UsageRecord,
} from './types/index.js';

// ─── Dependency Interfaces ──────────────────────────────────────────────────
// These interfaces decouple the gateway from concrete implementations of
// quota checking, usage recording, and fallback handling (Tasks 7–9).

export interface QuotaClient {
  check(tenantId: string, estimatedTokens: number, featureKey: string): Promise<QuotaCheckResult>;
}

export interface UsageRecorder {
  /** Fire-and-forget — must never throw. */
  record(data: UsageRecord): void;
}

export interface FallbackHandler {
  executeWithFallback(
    primaryModel: AiModelConfig,
    request: LLMRequest,
    providerRegistry: ProviderRegistry,
    credentialResolver: CredentialResolver,
    tenantId: string,
    requestId?: string, // ISSUE #19 FIX: requestId for log correlation
  ): Promise<{
    response: LLMResponse;
    fallbackUsed: boolean;
    fallbackFrom?: string;
    /** Whether the credentials actually used were BYOK (tenant's own key). */
    isByok: boolean;
  }>;
}

export interface AiGatewayConfig {
  platformApiUrl: string;
  serviceToken: string;
  providerRegistry: ProviderRegistry;
  credentialResolver: CredentialResolver;
  modelRegistry: ModelRegistry;
  usageRecorder: UsageRecorder;
  quotaClient: QuotaClient;
  logger: Logger;
  fallbackHandler?: FallbackHandler;
}

/**
 * AiGateway — single enforcement point for all AI usage in Nexa ERP.
 *
 * No ERP module may call any LLM provider API directly (BR-PLT-007).
 * All calls go through `aiGateway.complete()` which:
 *   1. Resolves the model (by name, routing tags, or default)
 *   2. Estimates token usage
 *   3. Pre-flight quota check against the Platform API
 *   4. Resolves credentials (BYOK or vendor key)
 *   5. Calls the provider adapter
 *   6. On error, attempts fallback if configured
 *   7. Records usage (fire-and-forget)
 *   8. Returns normalised response
 */
export class AiGateway {
  private readonly providerRegistry: ProviderRegistry;
  private readonly credentialResolver: CredentialResolver;
  private readonly modelRegistry: ModelRegistry;
  private readonly usageRecorder: UsageRecorder;
  private readonly quotaClient: QuotaClient;
  private readonly logger: Logger;
  private readonly fallbackHandler?: FallbackHandler;

  constructor(config: AiGatewayConfig) {
    this.providerRegistry = config.providerRegistry;
    this.credentialResolver = config.credentialResolver;
    this.modelRegistry = config.modelRegistry;
    this.usageRecorder = config.usageRecorder;
    this.quotaClient = config.quotaClient;
    this.logger = config.logger;
    this.fallbackHandler = config.fallbackHandler;
  }

  /**
   * Send a completion request through the AI Gateway.
   *
   * Full flow:
   *   1. Generate requestId (UUID v4)
   *   2. Start latency timer
   *   3. Resolve model from registry (by name, tags, or default)
   *   4. Estimate tokens via provider adapter
   *   5. Pre-flight quota check
   *   6. If blocked → throw AiQuotaExceededError (AC #3)
   *   7. Resolve credentials (BYOK or vendor)
   *   8. Build LLMRequest from AiGatewayRequest + resolved model
   *   9. Call provider adapter
   *  10. On provider error → attempt fallback (AC #8)
   *  11. Stop latency timer
   *  12. Record usage (fire-and-forget) (AC #4)
   *  13. Return AiGatewayResponse with quota warning if present
   */
  async complete(request: AiGatewayRequest): Promise<AiGatewayResponse> {
    // 1. Generate requestId
    const requestId = randomUUID();
    const startTime = performance.now();

    this.logger.info(
      { requestId, tenantId: request.tenantId, featureKey: request.featureKey },
      'AI Gateway: processing completion request',
    );

    // 3. Resolve model
    const model = this.resolveModel(request);

    this.logger.debug(
      { requestId, model: model.name, provider: model.provider },
      'AI Gateway: model resolved',
    );

    // 4. Estimate tokens
    const provider = this.providerRegistry.get(model.provider);
    const estimatedTokens = await provider.estimateTokens(request.messages, request.tools);

    // 5. Pre-flight quota check (fail-open: allow request if quota service is unavailable)
    try {
      const quotaResult = await this.quotaClient.check(
        request.tenantId,
        estimatedTokens,
        request.featureKey,
      );

      // 6. If blocked → throw
      if (!quotaResult.allowed) {
        this.logger.warn(
          { requestId, tenantId: request.tenantId, quotaPct: quotaResult.quotaPct },
          'AI Gateway: quota exceeded, blocking request',
        );
        throw new AiQuotaExceededError(quotaResult.quotaPct, quotaResult.remainingTokens);
      }
    } catch (err) {
      if (err instanceof AiQuotaExceededError) throw err;
      this.logger.warn(
        { requestId, error: (err as Error).message },
        'AI Gateway: quota check failed, allowing request (fail-open)',
      );
    }

    // 8. Build LLMRequest
    const llmRequest: LLMRequest = {
      model: model.modelId,
      messages: request.messages,
      tools: request.tools,
      maxOutputTokens: request.maxOutputTokens ?? model.config?.maxTokens,
      temperature: request.temperature,
      providerOptions: request.providerOptions,
    };

    // 9 & 10. Call provider with fallback support.
    // ISSUE #1 FIX: Only resolve credentials once. When FallbackHandler is configured,
    // it handles credential resolution internally. When no FallbackHandler, resolve here.
    let llmResponse: LLMResponse;
    let fallbackUsed = false;
    let fallbackFrom: string | undefined;
    let isByok: boolean;

    if (this.fallbackHandler) {
      const fallbackResult = await this.fallbackHandler.executeWithFallback(
        model,
        llmRequest,
        this.providerRegistry,
        this.credentialResolver,
        request.tenantId,
        requestId, // ISSUE #19 FIX: pass requestId for log correlation
      );
      llmResponse = fallbackResult.response;
      fallbackUsed = fallbackResult.fallbackUsed;
      fallbackFrom = fallbackResult.fallbackFrom;
      isByok = fallbackResult.isByok;
    } else {
      // 7. Resolve credentials only when no fallback handler
      const credentials = await this.credentialResolver.resolve(request.tenantId, model.provider);
      llmResponse = await provider.complete(llmRequest, credentials.apiKey);
      isByok = credentials.isByok;
    }

    // 11. Stop latency timer
    const latencyMs = Math.round(performance.now() - startTime);

    // 12. Record usage (fire-and-forget — never throws)
    const usageRecord: UsageRecord = {
      tenantId: request.tenantId,
      userId: request.userId,
      featureKey: request.featureKey,
      provider: llmResponse.provider,
      model: llmResponse.model,
      promptTokens: llmResponse.usage.promptTokens,
      completionTokens: llmResponse.usage.completionTokens,
      totalTokens: llmResponse.usage.totalTokens,
      costEstimate: 0, // Cost estimation is out of scope for MVP
      requestId,
      isByok,
      latencyMs,
      fallbackUsed,
      fallbackFrom,
    };

    try {
      this.usageRecorder.record(usageRecord);
    } catch (err) {
      this.logger.error(
        { requestId, error: (err as Error).message },
        'AI Gateway: usage recording failed (fire-and-forget)',
      );
    }

    this.logger.info(
      {
        requestId,
        tenantId: request.tenantId,
        model: llmResponse.model,
        provider: llmResponse.provider,
        latencyMs,
        totalTokens: llmResponse.usage.totalTokens,
        fallbackUsed,
        isByok,
      },
      'AI Gateway: completion request processed',
    );

    // 13. Return AiGatewayResponse
    return {
      ...llmResponse,
      requestId,
      latencyMs,
      fallbackUsed,
      fallbackFrom,
      isByok,
      quotaPct: quotaResult.quotaPct,
      // ISSUE #32 FIX: Merge both warnings if present, prefer quota warning
      warning:
        quotaResult.warning && llmResponse.warning
          ? `${quotaResult.warning}; ${llmResponse.warning}`
          : (quotaResult.warning ?? llmResponse.warning),
    };
  }

  /**
   * Stream a completion request through the AI Gateway.
   *
   * Same pre-flight flow as complete() (model resolution, token estimation,
   * quota check, credential resolution), but calls provider.stream() instead
   * of provider.complete(). Yields each LLMStreamChunk as it arrives.
   * After the stream completes, records usage fire-and-forget.
   *
   * If the primary provider fails before any chunks are yielded, and the
   * model has a fallbackModelName configured, attempts the fallback provider.
   */
  async *stream(request: AiGatewayRequest): AsyncGenerator<LLMStreamChunk> {
    const requestId = randomUUID();
    const startTime = performance.now();

    this.logger.info(
      { requestId, tenantId: request.tenantId, featureKey: request.featureKey },
      'AI Gateway: processing streaming request',
    );

    // Resolve model
    const model = this.resolveModel(request);

    this.logger.debug(
      { requestId, model: model.name, provider: model.provider },
      'AI Gateway: model resolved for streaming',
    );

    // Estimate tokens
    const provider = this.providerRegistry.get(model.provider);
    const estimatedTokens = await provider.estimateTokens(request.messages, request.tools);

    // Pre-flight quota check (fail-open: allow request if quota service is unavailable)
    try {
      const quotaResult = await this.quotaClient.check(
        request.tenantId,
        estimatedTokens,
        request.featureKey,
      );

      if (!quotaResult.allowed) {
        this.logger.warn(
          { requestId, tenantId: request.tenantId, quotaPct: quotaResult.quotaPct },
          'AI Gateway: quota exceeded, blocking streaming request',
        );
        throw new AiQuotaExceededError(quotaResult.quotaPct, quotaResult.remainingTokens);
      }
    } catch (err) {
      if (err instanceof AiQuotaExceededError) throw err;
      this.logger.warn(
        { requestId, error: (err as Error).message },
        'AI Gateway: quota check failed, allowing request (fail-open)',
      );
    }

    // Build LLMRequest
    const llmRequest: LLMRequest = {
      model: model.modelId,
      messages: request.messages,
      tools: request.tools,
      maxOutputTokens: request.maxOutputTokens ?? model.config?.maxTokens,
      temperature: request.temperature,
      providerOptions: request.providerOptions,
    };

    // Stream from provider, accumulating usage for recording
    let promptTokens = 0;
    let completionTokens = 0;
    let fallbackUsed = false;
    let fallbackFrom: string | undefined;
    let actualProvider = model.provider;
    let actualModel = model.modelId;
    let isByok: boolean;

    // Attempt primary provider, fallback on connection error before any chunks yielded
    let streamSource: AsyncIterable<LLMStreamChunk>;

    const primaryCredentials = await this.credentialResolver.resolve(
      request.tenantId,
      model.provider,
    );
    isByok = primaryCredentials.isByok;

    try {
      streamSource = provider.stream(llmRequest, primaryCredentials.apiKey);
    } catch (err) {
      // Synchronous error from stream setup — attempt fallback
      const fallbackResult = this.attemptStreamFallback(
        err,
        model,
        llmRequest,
        request.tenantId,
        requestId,
      );
      if (fallbackResult) {
        const resolved = await fallbackResult;
        streamSource = resolved.stream;
        fallbackUsed = true;
        fallbackFrom = model.name;
        actualProvider = resolved.provider;
        actualModel = resolved.model;
        isByok = resolved.isByok;
      } else {
        throw err;
      }
    }

    // Consume the stream — if the first iteration throws (async connection error),
    // attempt fallback before any chunks have been yielded to the caller.
    let iterator = (streamSource as AsyncIterable<LLMStreamChunk>)[Symbol.asyncIterator]();
    let firstChunk: IteratorResult<LLMStreamChunk>;
    try {
      firstChunk = await iterator.next();
    } catch (err) {
      const fallbackResult = this.attemptStreamFallback(
        err,
        model,
        llmRequest,
        request.tenantId,
        requestId,
      );
      if (fallbackResult) {
        const resolved = await fallbackResult;
        streamSource = resolved.stream;
        fallbackUsed = true;
        fallbackFrom = model.name;
        actualProvider = resolved.provider;
        actualModel = resolved.model;
        isByok = resolved.isByok;
        iterator = (streamSource as AsyncIterable<LLMStreamChunk>)[Symbol.asyncIterator]();
        firstChunk = await iterator.next();
      } else {
        throw err;
      }
    }

    // Yield the first chunk and continue the stream
    if (!firstChunk.done) {
      const chunk = firstChunk.value;
      if (chunk.type === 'usage' && chunk.usage) {
        promptTokens = chunk.usage.promptTokens ?? promptTokens;
        completionTokens = chunk.usage.completionTokens ?? completionTokens;
      }
      yield chunk;
    }

    for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
      if (chunk.type === 'usage' && chunk.usage) {
        promptTokens = chunk.usage.promptTokens ?? promptTokens;
        completionTokens = chunk.usage.completionTokens ?? completionTokens;
      }
      yield chunk;
    }

    // Record usage after stream completes (fire-and-forget)
    const latencyMs = Math.round(performance.now() - startTime);
    const totalTokens = promptTokens + completionTokens;

    const usageRecord: UsageRecord = {
      tenantId: request.tenantId,
      userId: request.userId,
      featureKey: request.featureKey,
      provider: actualProvider,
      model: actualModel,
      promptTokens,
      completionTokens,
      totalTokens,
      costEstimate: 0,
      requestId,
      isByok,
      latencyMs,
      fallbackUsed,
      fallbackFrom,
    };

    try {
      this.usageRecorder.record(usageRecord);
    } catch (err) {
      this.logger.error(
        { requestId, error: (err as Error).message },
        'AI Gateway: streaming usage recording failed (fire-and-forget)',
      );
    }

    this.logger.info(
      {
        requestId,
        tenantId: request.tenantId,
        model: actualModel,
        provider: actualProvider,
        latencyMs,
        totalTokens,
        isByok,
        fallbackUsed,
      },
      'AI Gateway: streaming request completed',
    );
  }

  /**
   * Attempt to create a fallback stream when the primary provider fails.
   * Returns null if fallback is not possible (error not retryable, or no fallback configured).
   */
  private attemptStreamFallback(
    err: unknown,
    primaryModel: AiModelConfig,
    llmRequest: LLMRequest,
    tenantId: string,
    requestId: string,
  ): Promise<{
    stream: AsyncIterable<LLMStreamChunk>;
    provider: string;
    model: string;
    isByok: boolean;
  }> | null {
    if (!(err instanceof ProviderError) || !isFallbackTrigger(err)) {
      return null;
    }
    if (!primaryModel.fallbackModelName) {
      return null;
    }

    this.logger.warn(
      {
        requestId,
        primaryModel: primaryModel.name,
        fallbackModel: primaryModel.fallbackModelName,
        error: (err as Error).message,
      },
      'AI Gateway: primary streaming provider failed, attempting fallback',
    );

    return (async () => {
      try {
        const fallbackModel = this.modelRegistry.resolveByName(primaryModel.fallbackModelName!);
        const fallbackProvider = this.providerRegistry.get(fallbackModel.provider);
        const fallbackCredentials = await this.credentialResolver.resolve(
          tenantId,
          fallbackModel.provider,
        );

        const fallbackRequest: LLMRequest = { ...llmRequest, model: fallbackModel.modelId };
        const stream = fallbackProvider.stream(fallbackRequest, fallbackCredentials.apiKey);

        return {
          stream,
          provider: fallbackModel.provider,
          model: fallbackModel.modelId,
          isByok: fallbackCredentials.isByok,
        };
      } catch (fallbackErr) {
        this.logger.error(
          { requestId, error: (fallbackErr as Error).message },
          'AI Gateway: streaming fallback resolution failed, re-throwing original error',
        );
        throw err; // Re-throw the original provider error
      }
    })();
  }

  /** Resolve the model from the request (by name, tags, or default). */
  private resolveModel(request: AiGatewayRequest): AiModelConfig {
    if (request.modelName) {
      return this.modelRegistry.resolveByName(request.modelName);
    }
    if (request.routingTags && request.routingTags.length > 0) {
      return this.modelRegistry.resolveByTags(request.routingTags);
    }
    return this.modelRegistry.resolveDefault();
  }
}

/**
 * Factory function to create an AiGateway instance.
 * Provides a cleaner API than constructing directly.
 */
export function createAiGateway(config: AiGatewayConfig): AiGateway {
  return new AiGateway(config);
}
