// ─── Core Gateway ───────────────────────────────────────────────────────────
export { AiGateway, createAiGateway } from './ai-gateway.js';
export type {
  AiGatewayConfig,
  QuotaClient,
  UsageRecorder,
  FallbackHandler,
} from './ai-gateway.js';

// ─── Model Registry ─────────────────────────────────────────────────────────
export { ModelRegistry } from './model-registry.js';

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  AiGatewayRequest,
  AiGatewayResponse,
  AiModelConfig,
  ContentBlock,
  CredentialResult,
  FinishReason,
  ImageBlock,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  Message,
  ProviderCapability,
  QuotaCheckResult,
  TextBlock,
  TokenUsage,
  Tool,
  ToolCall,
  ToolResultBlock,
  ToolUseBlock,
  UsageRecord,
} from './types/index.js';

// ─── Errors ─────────────────────────────────────────────────────────────────
export {
  AiQuotaExceededError,
  ProviderError,
  ProviderUnavailableError,
  CredentialError,
  ModelNotFoundError,
} from './errors/index.js';

// ─── Provider Interface ─────────────────────────────────────────────────────
export type { LLMProvider } from './providers/llm-provider.interface.js';

// ─── Provider Registry ──────────────────────────────────────────────────────
export { ProviderRegistry } from './providers/provider-registry.js';

// ─── Provider Adapters ─────────────────────────────────────────────────────
export { AnthropicAdapter } from './providers/adapters/anthropic.adapter.js';
export { OpenAIAdapter } from './providers/adapters/openai.adapter.js';

// ─── Credential Resolution ──────────────────────────────────────────────────
export { CredentialResolver } from './credentials/credential-resolver.js';
export type { ByokCredentialSource } from './credentials/credential-resolver.js';

// ─── Quota Client ──────────────────────────────────────────────────────────
export { QuotaClient as QuotaClientImpl, QuotaCheckError } from './quota/quota-client.js';
export type { QuotaClientConfig } from './quota/quota-client.js';

// ─── Usage Recorder ──────────────────────────────────────────────────────
export { UsageRecorder as UsageRecorderImpl } from './quota/usage-recorder.js';
export type { UsageRecorderConfig } from './quota/usage-recorder.js';

// ─── Fallback ─────────────────────────────────────────────────────────────
export {
  FallbackHandler as FallbackHandlerImpl,
  isFallbackTrigger,
} from './fallback/fallback-handler.js';
export type { FallbackResult } from './fallback/fallback-handler.js';

// ─── Circuit Breaker ───────────────────────────────────────────────────────
export { CircuitBreaker } from './circuit-breaker/circuit-breaker.js';
export type { CircuitBreakerConfig, CircuitState } from './circuit-breaker/circuit-breaker.js';
