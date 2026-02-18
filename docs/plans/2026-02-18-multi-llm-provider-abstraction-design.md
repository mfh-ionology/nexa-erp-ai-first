# Multi-LLM Provider Abstraction — Design Document

**Date:** 2026-02-18
**Author:** Mohammed (requirements) + Claude Opus 4.6 (design)
**Status:** APPROVED
**Scope:** AI Gateway provider abstraction layer

---

## 1. Motivation

Four objectives drive this change:

1. **Cost optimisation** — route cheap tasks to cheaper providers (e.g., classification to GPT-4o-mini, reasoning to Claude)
2. **Vendor independence** — no lock-in to Anthropic; ability to switch providers if pricing/quality changes
3. **Best-of-breed per task** — different LLMs excel at different things (Google for embeddings, OpenAI for structured output, Claude for reasoning)
4. **Customer choice** — Enterprise tenants can bring their own API keys (BYOK) or choose preferred providers

## 2. Current State

The architecture already has partial multi-model support:

- **`AiModel` registry** (Architecture §6.1) has a `provider` field with comment `'anthropic', 'openai' (future)`
- **Model routing strategy** routes different task types to different Claude models (Opus, Sonnet, Haiku)
- **AI Gateway** (`packages/ai-gateway`) mandates all AI calls route through it — no module calls any LLM directly
- **`AiAgent` registry** links each agent to a specific model via `modelId`

The gap: the actual **provider abstraction layer** is not defined. The architecture assumes Anthropic SDK throughout: E3b.S3 says "Call Claude API via Anthropic SDK", E5.S1 says "Use Anthropic SDK streaming mode", and the tech stack table lists "Claude API (Anthropic SDK)".

## 3. Design Decision

**Approach: Provider Adapter Pattern in AI Gateway**

Extend the existing AI Gateway with a provider adapter interface. Each LLM provider implements `LLMProvider`. The AI Gateway resolves which provider + model to call based on the `AiModel` registry. Provider-specific features are handled via a `providerOptions` passthrough — the core interface never changes.

### 3.1 Core LLM Provider Interface

This contract never changes. New providers = new class implementing it.

```typescript
// packages/ai-gateway/src/providers/llm-provider.interface.ts

interface LLMProvider {
  readonly providerId: string;  // 'anthropic', 'openai', 'google', etc.

  /** Synchronous completion */
  complete(request: LLMRequest): Promise<LLMResponse>;

  /** Streaming completion */
  stream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;

  /** What this provider supports */
  capabilities(): ProviderCapability[];

  /** Validate that a model ID is valid for this provider */
  validateModel(modelId: string): boolean;

  /** Count tokens for a request (for quota pre-check) */
  estimateTokens(messages: Message[], tools?: Tool[]): Promise<number>;
}

interface LLMRequest {
  model: string;                         // e.g., 'claude-sonnet-4-5', 'gpt-4o'
  messages: Message[];                   // unified message format
  tools?: Tool[];                        // unified tool/function format
  maxOutputTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  providerOptions?: Record<string, unknown>;  // EXTENSIBILITY ESCAPE HATCH
}

interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;                         // actual model used (may differ if fallback)
  provider: string;
  finishReason: 'stop' | 'tool_use' | 'max_tokens' | 'error';
  providerMetadata?: Record<string, unknown>;  // provider-specific response data
}

interface LLMStreamChunk {
  type: 'text_delta' | 'tool_call_delta' | 'usage' | 'done';
  content?: string;
  toolCall?: Partial<ToolCall>;
  usage?: Partial<TokenUsage>;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// Extensible — new capabilities don't require type changes
type ProviderCapability =
  | 'completion'
  | 'streaming'
  | 'tool_use'
  | 'vision'
  | 'structured_output'
  | 'extended_thinking'
  | 'long_context'
  | 'embeddings'
  | string;

// Unified message format (adapters convert to/from provider-specific formats)
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
  toolCallId?: string;                   // for tool result messages
}

interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  imageUrl?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
}

// Unified tool definition
interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;  // JSON Schema
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}
```

**Key extensibility mechanism:** When a provider adds a new feature:
1. Update the provider's adapter to handle the new `providerOptions` key
2. Register the capability in the model registry
3. Callers that want it pass it via `providerOptions`
4. Core interface stays unchanged

**Examples of providerOptions usage:**
```typescript
// Anthropic extended thinking
providerOptions: { extended_thinking: { budget_tokens: 10000 } }

// OpenAI structured output
providerOptions: { response_format: { type: 'json_schema', schema: {...} } }

// Google grounding with search
providerOptions: { grounding: { google_search: true } }
```

Provider-specific response data comes back in `providerMetadata`:
```typescript
// Anthropic thinking content in response
providerMetadata: { thinking: "Let me analyse the financial data..." }

// OpenAI structured output parsed
providerMetadata: { parsed: { invoiceTotal: 1234.56, ... } }
```

### 3.2 Provider Adapters

Each provider is a single file implementing `LLMProvider`. Adding a new provider = one new file, zero changes elsewhere.

```
packages/ai-gateway/src/providers/
  llm-provider.interface.ts      # The interface (§3.1 above)
  provider-registry.ts           # Discovery + lookup
  adapters/
    anthropic.adapter.ts         # Anthropic SDK wrapper (MVP)
    openai.adapter.ts            # OpenAI SDK wrapper (MVP)
    google.adapter.ts            # Google AI SDK wrapper (post-MVP)
    ollama.adapter.ts            # Ollama local models (post-MVP)
  message-converter.ts           # Unified Message[] ↔ provider-specific format
  tool-converter.ts              # Unified Tool[] ↔ provider-specific format
```

**Provider Registry:**

```typescript
// packages/ai-gateway/src/providers/provider-registry.ts
class ProviderRegistry {
  private adapters = new Map<string, LLMProvider>();

  register(adapter: LLMProvider): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  get(providerId: string): LLMProvider {
    const adapter = this.adapters.get(providerId);
    if (!adapter) throw new ProviderNotFoundError(providerId);
    return adapter;
  }

  listProviders(): { id: string; capabilities: string[] }[] {
    return [...this.adapters.entries()].map(([id, adapter]) => ({
      id, capabilities: adapter.capabilities(),
    }));
  }
}
```

At startup, the AI Gateway registers all available adapters. The `AiModel` registry in the database tells the gateway which adapter to use for each model.

### 3.3 Updated AI Gateway Flow

**Current flow:**
```
ERP module -> aiGateway.complete() -> quota check -> Claude API -> usage record
```

**New flow:**
```
ERP module -> aiGateway.complete()
               -> quota check (Platform API)
               -> resolve AiModel from DB (get provider + modelId)
               -> resolve credentials (vendor key OR tenant BYOK key)
               -> providerRegistry.get(provider).complete(request)
               -> normalize response to LLMResponse
               -> usage record (with provider, model, cost, isByok)
               -> return LLMResponse
```

### 3.4 Credential Resolution (BYOK)

Vendor keys by default. Enterprise tenants can optionally bring their own keys.

```typescript
// packages/ai-gateway/src/credentials/credential-resolver.ts
interface CredentialResolver {
  resolve(tenantId: string, providerId: string): Promise<ProviderCredentials>;
}

// Resolution order:
// 1. Tenant BYOK key for this provider (if Enterprise tier + configured)
// 2. Vendor platform key for this provider (default)
```

**New Platform DB model:**

```prisma
model TenantProviderCredential {
  id            String   @id @default(uuid())
  tenantId      String   @map("tenant_id")
  providerId    String   @map("provider_id")   // 'anthropic', 'openai', 'google', etc.
  encryptedKey  String   @map("encrypted_key")  // AES-256 encrypted API key
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  tenant        Tenant   @relation(fields: [tenantId], references: [id])

  @@map("tenant_provider_credentials")
  @@unique([tenantId, providerId], map: "uq_tenant_provider_credential")
}
```

When `isByok` is true, usage is recorded for audit/observability but does not count against the tenant's token quota.

### 3.5 Fallback Chains

When a provider fails (rate limit, outage, timeout), the system falls back to an alternative.

**Updated AiModel schema (additions only):**

```prisma
model AiModel {
  // ... all existing fields unchanged ...

  // NEW fields
  fallbackModelId  String?   @map("fallback_model_id")
  routingTags      String[]  @map("routing_tags")  // ['cheap', 'fast', 'reasoning', 'vision']

  fallbackModel    AiModel?  @relation("ModelFallback", fields: [fallbackModelId], references: [id])

  @@map("ai_models")
}
```

**Fallback behaviour:**
```
Request -> claude-sonnet-4-5 (primary)
             |
             +- Success -> return
             +- Rate limited / 5xx -> try fallback
             |     -> gpt-4o (fallback)
             |         +- Success -> return (providerMetadata notes fallback used)
             |         +- Also failed -> return error to caller
             +- Timeout (>10s) -> try fallback
```

**Intent-based routing** — agents request capabilities, not specific models:

```typescript
await aiGateway.complete({
  messages: [...],
  routing: {
    tags: ['cheap', 'tool_use'],           // what I need
    preferredProvider: 'anthropic',         // soft preference
    maxCostPerMTokens: 0.50,               // budget constraint
  }
});
```

The gateway finds the cheapest active model matching the tags. If prices change or new models appear, update the `AiModel` registry — zero agent code changes.

### 3.6 Updated Usage Recording

```typescript
// Updated fields for POST /platform/tenants/:tenantId/ai/record
interface AiUsageRecord {
  tenantId: string;
  userId: string;
  featureKey: string;
  provider: string;       // NEW — 'anthropic', 'openai', 'google'
  model: string;          // 'claude-sonnet-4-5', 'gpt-4o-mini'
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: string;   // Decimal — calculated from AiModel cost fields
  requestId: string;
  isByok: boolean;        // NEW — true = tenant's own key, don't bill for tokens
  latencyMs: number;      // NEW — end-to-end latency for monitoring
  fallbackUsed: boolean;  // NEW — true if primary model failed and fallback was used
  fallbackFrom?: string;  // NEW — original model ID if fallback triggered
}
```

---

## 4. Document Synchronisation Map

Per the Document Synchronisation Rule, this design requires updates to the following documents:

### 4.1 Architecture (core-architectural-decisions.md)

| Location | Current | Change To |
|----------|---------|-----------|
| Tech stack table (starter-template-evaluation.md) | `Claude API (Anthropic SDK) / Latest / Tool use / function calling` | `Multi-LLM Provider Adapters / Latest / Provider-agnostic interface; Anthropic + OpenAI initially, any provider via adapter` |
| §6.1 AiModel schema | No fallback or routing fields | Add `fallbackModelId String?`, `routingTags String[]`, `fallbackModel` relation |
| §6.1 Model routing table | Lists only Claude models (Opus, Sonnet, Haiku) | Add rows for OpenAI (GPT-4o, GPT-4o-mini) and note that routing is tag-based, not model-specific |
| §6.3 Agent Registry | Agents have hardcoded `modelId` | Agents can use `routingTags` as an alternative to hardcoded `modelId` |
| NEW section after §6.1 | Does not exist | Add §6.1b: Provider Adapter Interface (LLMProvider, LLMRequest, LLMResponse), Provider Registry, Credential Resolution, Fallback Chains |

### 4.2 Project Structure (project-structure-boundaries.md)

| Location | Current | Change To |
|----------|---------|-----------|
| Architectural Boundaries table | `API <-> AI: Claude API (Anthropic SDK) / Tool definitions in packages/ai-tools` | `API <-> AI: Multi-LLM Provider Adapters (packages/ai-gateway/src/providers) / Unified tool definitions in packages/ai-tools` |
| NEW directory listing | Not present | Add `packages/ai-gateway/src/providers/` and `packages/ai-gateway/src/credentials/` directory structure |

### 4.3 Project Context (project-context.md)

| Location | Current | Change To |
|----------|---------|-----------|
| §8b AI Gateway description | "Every AI call in the ERP MUST go through the AI Gateway. No module may call Claude API or any LLM directly." | "Every AI call in the ERP MUST go through the AI Gateway. No module may call any LLM API directly. The AI Gateway resolves the provider adapter based on the AiModel registry and routes through the appropriate SDK (Anthropic, OpenAI, etc.)." |
| §8b Flow description | "Flow: ERP module -> aiGateway.complete() -> quota check -> Claude API -> usage record -> return response." | "Flow: ERP module -> aiGateway.complete() -> quota check -> resolve provider from AiModel -> resolve credentials (vendor or BYOK) -> provider adapter -> usage record -> return response." |
| Development Rule #8 | "Every AI call goes through the AI Gateway — no direct LLM API calls from business modules" | "Every AI call goes through the AI Gateway — no direct LLM API calls from business modules. All provider SDKs (Anthropic, OpenAI, etc.) are encapsulated in provider adapters within the AI Gateway." |

### 4.4 Data Models (5-platform-database-models-section-231.md)

| Change | Details |
|--------|---------|
| NEW model: TenantProviderCredential | See §3.4 above — tenantId, providerId, encryptedKey, isActive |
| UPDATE: TenantAiUsage | Add fields: `provider String(50)`, `isByok Boolean @default(false)`, `latencyMs Int?`, `fallbackUsed Boolean @default(false)`, `fallbackFrom String?` |

### 4.5 Epics (epic-e3b-platform-api-ai-gateway.md)

| Story | Current | Change To |
|-------|---------|-----------|
| E3b.S3 title | "AI Gateway Service" | "AI Gateway Service + Provider Adapters" |
| E3b.S3 AC#1 | "it must call `aiGateway.complete()` (no direct Claude API calls)" | "it must call `aiGateway.complete()` (no direct LLM API calls)" |
| E3b.S3 Key Task: "Implement LLM proxy" | "Call Claude API via Anthropic SDK" | "Implement LLMProvider interface, ProviderRegistry, AnthropicAdapter, OpenAIAdapter. Route calls via provider resolved from AiModel registry." |
| E3b.S3 Key Task: NEW | Does not exist | "Implement credential resolution — vendor keys default, BYOK for Enterprise (TenantProviderCredential model)" |
| E3b.S3 Key Task: NEW | Does not exist | "Implement fallback chain — if primary model fails (rate limit/5xx/timeout), try fallbackModelId" |

### 4.6 Epics (epic-e5-ai-orchestration.md)

| Story | Current | Change To |
|-------|---------|-----------|
| E5.S1 Key Task | "Use Anthropic SDK streaming mode" | "Use AI Gateway streaming (provider-agnostic). Gateway handles provider-specific streaming protocol." |
| E5.S1 Key Task | "Handle model routing: Opus for complex analysis, Sonnet for standard tasks, Haiku for extraction" | "Handle model routing via AiModel.routingTags: 'reasoning' for complex analysis, 'standard' for CRUD, 'cheap' for extraction. Gateway resolves best model per tags." |

### 4.7 Epics (epic-e13b-platform-admin-portal.md)

| Change | Details |
|--------|---------|
| NEW stories or AC additions needed | Platform Admin UI for: (1) managing provider API keys (vendor-level), (2) viewing per-provider usage dashboards, (3) Enterprise tenants: BYOK key management screen |

### 4.8 API Contracts (20-platform-api-internal-erp-facing-endpoints.md)

| Endpoint | Current | Change To |
|----------|---------|-----------|
| POST /platform/tenants/:tenantId/ai/record request body | `model, promptTokens, completionTokens, totalTokens, costEstimate, requestId` | Add fields: `provider`, `isByok`, `latencyMs`, `fallbackUsed`, `fallbackFrom` |

### 4.9 PRD (functional-requirements.md)

| Change | Details |
|--------|---------|
| NEW FRs needed | FR223: AI Gateway routes calls through provider-agnostic adapter interface supporting multiple LLM providers |
| | FR224: Enterprise tenants can configure BYOK API keys per LLM provider; BYOK usage recorded but not billed against token quota |
| | FR225: AI Gateway implements automatic fallback chains — if primary model fails, routes to configured fallback model |
| | FR226: Platform Admin can manage vendor-level LLM provider API keys and view per-provider usage dashboards |

### 4.10 Documents NOT Affected

| Document | Why |
|----------|-----|
| Event Catalog | AI events unchanged — `ai.completion.requested`, `ai.completion.completed` work regardless of provider |
| State Machine Reference | No new stateful entities |
| Business Rules Compendium | AI business rules (IMP-005, IMP-006, BR-COM-013) are provider-agnostic |
| UX Design Specification | Co-Pilot Dock, AI interaction UX unchanged — users don't see or care which LLM is behind the response |

---

## 5. Model Registry Seed Data (MVP)

| name | provider | modelId | routingTags | fallback | isDefault |
|------|----------|---------|-------------|----------|-----------|
| claude-opus-4-6 | anthropic | claude-opus-4-6 | reasoning, complex, evaluator | claude-sonnet-4-5 | false |
| claude-sonnet-4-5 | anthropic | claude-sonnet-4-5 | standard, chat, briefing | gpt-4o | true |
| claude-haiku-4-5 | anthropic | claude-haiku-4-5 | cheap, fast, extraction | gpt-4o-mini | false |
| gpt-4o | openai | gpt-4o | standard, structured_output, vision | claude-sonnet-4-5 | false |
| gpt-4o-mini | openai | gpt-4o-mini | cheap, fast, classification | claude-haiku-4-5 | false |

Cross-provider fallback: if Anthropic is down, Claude models fall back to OpenAI equivalents and vice versa.

---

## 6. Summary

This design:
- Adds a **provider-agnostic adapter interface** to the existing AI Gateway
- Uses **`providerOptions` passthrough** for provider-specific features (no core interface changes when providers add features)
- Implements **Anthropic + OpenAI adapters** for MVP, any provider addable via new adapter file
- Supports **BYOK for Enterprise tenants** with encrypted credential storage
- Adds **fallback chains** for resilience across providers
- Adds **intent-based routing** via tags so agents don't hardcode model IDs
- Requires updates to **7 documents** (Architecture, Project Structure, Project Context, Data Models, E3b, E5, API Contracts) and **4 new PRD FRs** (FR223-FR226)
- Requires **no changes** to 3 documents (Event Catalog, State Machines, Business Rules) and **no UX changes**
