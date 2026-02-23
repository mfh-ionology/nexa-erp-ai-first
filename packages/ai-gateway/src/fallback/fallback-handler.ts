import type { Logger } from 'pino';
import { ProviderError, ProviderUnavailableError } from '../errors/index.js';
import type { CredentialResolver } from '../credentials/credential-resolver.js';
import type { ModelRegistry } from '../model-registry.js';
import type { ProviderRegistry } from '../providers/provider-registry.js';
import type { AiModelConfig, LLMRequest, LLMResponse } from '../types/index.js';

// ─── Fallback Trigger Conditions (Task 7.2) ──────────────────────────────────
//
// Fallback IS triggered for:
//   - HTTP 429 (rate limited)
//   - HTTP 5xx (server error)
//   - Request timeout >10s (configurable per model via AiModel.config.timeout)
//   - SDK connection errors (no statusCode)
//
// Fallback is NOT triggered for:
//   - HTTP 400 (bad request) — caller error
//   - HTTP 401 (auth error) — caller error
//   - HTTP 403 (forbidden) — caller error
//   - Any non-ProviderError exceptions
//
// Maximum 1 fallback attempt (no chains-of-chains).

/**
 * Determines whether a ProviderError should trigger a fallback attempt.
 *
 * Retryable conditions:
 *   - 429 rate limited
 *   - 5xx server errors
 *   - Timeout / connection errors (no status code but marked retryable)
 *
 * Non-retryable (caller errors):
 *   - 400 bad request
 *   - 401 auth error
 *   - 403 forbidden
 */
export function isFallbackTrigger(error: ProviderError): boolean {
  // SDK connection/timeout errors have no statusCode but are marked retryable
  if (error.statusCode === undefined) {
    return error.isRetryable;
  }

  // 429 rate limited
  if (error.statusCode === 429) return true;

  // 5xx server errors
  if (error.statusCode >= 500) return true;

  // 4xx client errors (400, 401, 403, etc.) — NOT retryable
  return false;
}

export interface FallbackResult {
  response: LLMResponse;
  fallbackUsed: boolean;
  fallbackFrom?: string;
  /** Whether the credentials actually used were BYOK (tenant's own key). */
  isByok: boolean;
}

/**
 * Handles fallback logic when a primary LLM provider fails.
 *
 * On provider error matching fallback criteria (rate limit 429, server error 5xx,
 * timeout >10s), resolves the primary model's fallbackModelId and retries.
 *
 * - Maximum 1 fallback attempt (no chains-of-chains)
 * - Cross-provider fallback supported (e.g. Anthropic -> OpenAI)
 * - Credentials are resolved independently for the fallback provider
 */
export class FallbackHandler {
  constructor(
    private readonly modelRegistry: ModelRegistry,
    private readonly logger: Logger,
  ) {}

  /**
   * Execute an LLM request with fallback support.
   *
   * Tries the primary model first. If it fails with a retryable error and
   * a fallback model is configured, retries with the fallback model.
   */
  async executeWithFallback(
    primaryModel: AiModelConfig,
    request: LLMRequest,
    providerRegistry: ProviderRegistry,
    credentialResolver: CredentialResolver,
    tenantId: string,
    /** ISSUE #19 FIX: requestId for log correlation. */
    requestId?: string,
  ): Promise<FallbackResult> {
    // Primary attempt
    const primaryProvider = providerRegistry.get(primaryModel.provider);
    const primaryCredentials = await credentialResolver.resolve(
      tenantId,
      primaryModel.provider,
    );

    let primaryError: ProviderError;

    try {
      const response = await primaryProvider.complete(request, primaryCredentials.apiKey);
      return { response, fallbackUsed: false, isByok: primaryCredentials.isByok };
    } catch (err) {
      if (!(err instanceof ProviderError)) {
        throw err;
      }

      primaryError = err;

      // Check if this error should trigger fallback
      if (!isFallbackTrigger(primaryError)) {
        throw primaryError;
      }

      // Check if fallback model is configured
      if (!primaryModel.fallbackModelName) {
        throw primaryError;
      }
    }

    // Fallback attempt
    // ISSUE #19 FIX: Include requestId in all fallback log entries
    this.logger.warn(
      {
        requestId,
        primaryModel: primaryModel.name,
        primaryProvider: primaryModel.provider,
        fallbackModel: primaryModel.fallbackModelName,
        primaryError: primaryError.message,
        primaryStatusCode: primaryError.statusCode,
      },
      'FallbackHandler: primary provider failed, attempting fallback',
    );

    const fallbackModel = this.modelRegistry.resolveByName(primaryModel.fallbackModelName);
    const fallbackProvider = providerRegistry.get(fallbackModel.provider);
    const fallbackCredentials = await credentialResolver.resolve(
      tenantId,
      fallbackModel.provider,
    );

    // Build fallback request with the fallback model's ID
    const fallbackRequest: LLMRequest = {
      ...request,
      model: fallbackModel.modelId,
    };

    try {
      const response = await fallbackProvider.complete(
        fallbackRequest,
        fallbackCredentials.apiKey,
      );

      this.logger.info(
        {
          requestId,
          primaryModel: primaryModel.name,
          fallbackModel: fallbackModel.name,
          fallbackProvider: fallbackModel.provider,
        },
        'FallbackHandler: fallback succeeded',
      );

      return {
        response,
        fallbackUsed: true,
        fallbackFrom: primaryModel.name,
        isByok: fallbackCredentials.isByok,
      };
    } catch (fallbackErr) {
      this.logger.error(
        {
          requestId,
          primaryModel: primaryModel.name,
          fallbackModel: fallbackModel.name,
          primaryError: primaryError.message,
          fallbackError: (fallbackErr as Error).message,
        },
        'FallbackHandler: both primary and fallback failed',
      );

      // Both failed — throw ProviderUnavailableError with both errors
      throw new ProviderUnavailableError(
        primaryError,
        fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr)),
      );
    }
  }
}
