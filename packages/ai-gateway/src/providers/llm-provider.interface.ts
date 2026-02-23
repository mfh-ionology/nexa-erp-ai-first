import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  Message,
  Tool,
  ProviderCapability,
} from '../types/index.js';

/**
 * Stable contract for LLM provider adapters.
 *
 * Adding a new provider = one new adapter file implementing this interface.
 * Zero changes to the core interface or gateway logic.
 * Extensibility is via `providerOptions` (request) and `providerMetadata` (response).
 */
export interface LLMProvider {
  /** Unique provider identifier, e.g. 'anthropic', 'openai'. */
  readonly providerId: string;

  /** Send a completion request and return a normalised response. */
  complete(request: LLMRequest, apiKey: string): Promise<LLMResponse>;

  /** Stream a completion request, yielding normalised chunks. */
  stream(request: LLMRequest, apiKey: string): AsyncIterable<LLMStreamChunk>;

  /** List capabilities supported by this provider. */
  capabilities(): ProviderCapability[];

  /** Check whether a model ID is valid for this provider. */
  validateModel(modelId: string): boolean;

  /** Estimate token count for a set of messages (+ optional tools). */
  estimateTokens(messages: Message[], tools?: Tool[]): Promise<number>;
}
