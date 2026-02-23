// ─── Message Types ───────────────────────────────────────────────────────────

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    mediaType: string;
    data: string;
  };
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string | ContentBlock[];
  isError?: boolean;
}

export type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

// ─── Tool Types ──────────────────────────────────────────────────────────────

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// ─── LLM Request / Response ─────────────────────────────────────────────────

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type FinishReason = 'stop' | 'tool_use' | 'max_tokens' | 'error';

export interface LLMRequest {
  model: string;
  messages: Message[];
  tools?: Tool[];
  maxOutputTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  providerOptions?: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  provider: string;
  finishReason: FinishReason;
  providerMetadata?: Record<string, unknown>;
  warning?: string;
}

export interface LLMStreamChunk {
  type: 'content_delta' | 'tool_use_delta' | 'usage' | 'done';
  content?: string;
  /** During streaming, `input` may be a string (incremental JSON fragment) rather than a parsed object. */
  toolCall?: Partial<Omit<ToolCall, 'input'>> & { input?: string | Record<string, unknown> };
  usage?: Partial<TokenUsage>;
  finishReason?: FinishReason;
}

// ─── AI Gateway Request / Response ──────────────────────────────────────────

export interface AiGatewayRequest {
  tenantId: string;
  userId: string;
  featureKey: string;
  messages: Message[];
  tools?: Tool[];
  modelName?: string;
  routingTags?: string[];
  stream?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  providerOptions?: Record<string, unknown>;
}

export interface AiGatewayResponse extends LLMResponse {
  requestId: string;
  latencyMs: number;
  fallbackUsed: boolean;
  fallbackFrom?: string;
  isByok: boolean;
  quotaPct: number;
}

// ─── Quota Types ─────────────────────────────────────────────────────────────

export interface QuotaCheckResult {
  allowed: boolean;
  remainingTokens: number;
  quotaPct: number;
  warning?: string;
  degraded?: boolean;
}

export interface UsageRecord {
  tenantId: string;
  userId: string;
  featureKey: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: number;
  requestId: string;
  isByok: boolean;
  latencyMs: number;
  fallbackUsed: boolean;
  fallbackFrom?: string;
}

// ─── Model Registry Types ────────────────────────────────────────────────────

export interface AiModelConfig {
  name: string;
  provider: string;
  modelId: string;
  routingTags: string[];
  fallbackModelName?: string;
  isDefault?: boolean;
  config?: {
    timeout?: number;
    maxTokens?: number;
  };
}

// ─── Provider Types ──────────────────────────────────────────────────────────

export type ProviderCapability =
  | 'completion'
  | 'streaming'
  | 'tool_use'
  | 'vision'
  | 'structured_output'
  | 'extended_thinking'
  | 'long_context'
  | 'embeddings'
  | (string & {});

export interface CredentialResult {
  apiKey: string;
  isByok: boolean;
}
