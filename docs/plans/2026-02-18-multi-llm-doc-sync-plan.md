# Multi-LLM Provider Abstraction — Document Synchronisation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update all spec documents to reflect the multi-LLM provider abstraction design, per the Document Synchronisation Rule.

**Architecture:** Provider adapter pattern in AI Gateway. Each LLM provider implements `LLMProvider` interface. Extensible via `providerOptions` passthrough. BYOK for Enterprise tenants. Fallback chains across providers. Intent-based routing via tags.

**Tech Stack:** No code changes — this plan is spec document edits only. Code implementation is a separate plan for when E3b is built.

**Design Document:** `docs/plans/2026-02-18-multi-llm-provider-abstraction-design.md`

---

## Task 1: Update Tech Stack Table (Architecture — starter-template-evaluation.md)

**Files:**
- Modify: `_bmad-output/planning-artifacts/architecture/starter-template-evaluation.md:67`

**Step 1: Edit the AI row in the tech stack table**

Replace line 67:
```
| **AI** | Claude API (Anthropic SDK) | Latest | Tool use / function calling for intent → action mapping. |
```

With:
```
| **AI** | Multi-LLM Provider Adapters | Latest | Provider-agnostic `LLMProvider` interface in AI Gateway. Anthropic (Claude) + OpenAI (GPT-4o) initially; any provider addable via single adapter file. `providerOptions` passthrough for provider-specific features. BYOK for Enterprise tenants. Fallback chains across providers. |
```

**Step 2: Verify the edit**

Read back the file around line 67 and confirm the row is updated and the table formatting is intact.

**Step 3: Commit**

```bash
git add _bmad-output/planning-artifacts/architecture/starter-template-evaluation.md
git commit -m "docs(architecture): update AI tech stack to multi-LLM provider adapters"
```

---

## Task 2: Update AiModel Schema + Model Routing Table (Architecture — core-architectural-decisions.md)

**Files:**
- Modify: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md:18164-18196`

**Step 1: Add fallback and routing fields to AiModel schema**

At the end of the AiModel model block (after line 18178 `updatedAt` and before `agents`), insert:

```prisma
  fallbackModelId String?   @map("fallback_model_id")
  routingTags     String[]  @map("routing_tags")   // ['cheap', 'fast', 'reasoning', 'vision', 'standard']

  fallbackModel   AiModel?  @relation("ModelFallback", fields: [fallbackModelId], references: [id])
  fallbackedBy    AiModel[] @relation("ModelFallback")
```

Also update the `provider` field comment on line 18167 from:
```
  provider        String                           // 'anthropic', 'openai' (future)
```
To:
```
  provider        String                           // 'anthropic', 'openai', 'google', etc.
```

**Step 2: Update the model routing strategy table**

Replace the table at lines 18188-18196 with:

```markdown
**Model routing strategy (intent-based via `routingTags`):**

Agents request capabilities (tags), not specific models. The AI Gateway resolves the best active model matching the requested tags, respecting cost constraints and preferred provider.

| Tag | Primary Model | Fallback Model | Use Case |
|-----|--------------|----------------|----------|
| `reasoning`, `complex` | Claude Opus 4.6 | Claude Sonnet 4.5 | Complex financial analysis, multi-step operations, evaluations |
| `standard`, `chat` | Claude Sonnet 4.5 | GPT-4o | Standard record creation, queries, conversational chat |
| `cheap`, `fast` | Claude Haiku 4.5 | GPT-4o-mini | Simple lookups, classification, field extraction, bulk operations |
| `structured_output` | GPT-4o | Claude Sonnet 4.5 | Tasks requiring guaranteed JSON schema output |
| `briefing` | Claude Sonnet 4.5 | GPT-4o | Daily briefing generation (async, latency less critical) |
| `vision` | Claude Sonnet 4.5 | GPT-4o | Document understanding, image analysis |

Cross-provider fallback: if Anthropic is unavailable, Claude models fall back to OpenAI equivalents and vice versa.
```

**Step 3: Verify the edits**

Read back lines 18160-18200 to confirm schema and table are correct.

**Step 4: Commit**

```bash
git add _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md
git commit -m "docs(architecture): add fallback/routing to AiModel, update routing table to multi-LLM"
```

---

## Task 3: Add Provider Adapter Interface Section (Architecture — core-architectural-decisions.md)

**Files:**
- Modify: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md` (insert after the updated §6.1 Model Registry section, before §6.2 Prompt Management)

**Step 1: Insert new section §6.1b after the model routing table**

Insert the following after the model routing strategy table (after the cross-provider fallback note) and before `### 6.2 Prompt Management`:

```markdown
### 6.1b Provider Adapter Interface

Every LLM provider the system can use implements a single `LLMProvider` interface. The AI Gateway resolves which adapter to call based on the `AiModel.provider` field. Adding a new provider = one new adapter file, zero changes to the core interface or gateway logic.

**Core interface (never changes):**

```typescript
// packages/ai-gateway/src/providers/llm-provider.interface.ts

interface LLMProvider {
  readonly providerId: string;  // 'anthropic', 'openai', 'google', etc.
  complete(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  capabilities(): ProviderCapability[];
  validateModel(modelId: string): boolean;
  estimateTokens(messages: Message[], tools?: Tool[]): Promise<number>;
}

interface LLMRequest {
  model: string;
  messages: Message[];
  tools?: Tool[];
  maxOutputTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  providerOptions?: Record<string, unknown>;  // extensibility escape hatch
}

interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  provider: string;
  finishReason: 'stop' | 'tool_use' | 'max_tokens' | 'error';
  providerMetadata?: Record<string, unknown>;  // provider-specific response data
}

type ProviderCapability =
  | 'completion' | 'streaming' | 'tool_use' | 'vision'
  | 'structured_output' | 'extended_thinking' | 'long_context' | 'embeddings'
  | string;  // extensible — new capabilities don't need type changes
```

**Extensibility via `providerOptions`:** When a provider adds new features, only the adapter is updated. The core interface and AI Gateway never change. Examples:

- Anthropic extended thinking: `providerOptions: { extended_thinking: { budget_tokens: 10000 } }`
- OpenAI structured output: `providerOptions: { response_format: { type: 'json_schema', schema: {...} } }`

Provider-specific response data returns in `providerMetadata` (e.g., thinking content, parsed structured output).

**Provider Registry:**

```typescript
// packages/ai-gateway/src/providers/provider-registry.ts
class ProviderRegistry {
  private adapters = new Map<string, LLMProvider>();
  register(adapter: LLMProvider): void { ... }
  get(providerId: string): LLMProvider { ... }
  listProviders(): { id: string; capabilities: string[] }[] { ... }
}
```

**Credential Resolution (BYOK):**

Vendor keys by default. Enterprise tier tenants can optionally configure their own API keys per provider (stored encrypted in `TenantProviderCredential` in Platform DB). Resolution order: (1) tenant BYOK key if configured, (2) vendor platform key. When BYOK is used, usage is recorded for audit but not billed against the tenant's token quota.

**Fallback Chains:**

Each `AiModel` has an optional `fallbackModelId`. When the primary model fails (rate limit, 5xx, timeout >10s), the gateway retries with the fallback model. Fallback usage is recorded with `fallbackUsed: true` and `fallbackFrom` in the usage record.

**Updated AI Gateway Flow:**

```
ERP module → aiGateway.complete()
  → quota check (Platform API)
  → resolve AiModel from DB (get provider + modelId)
  → resolve credentials (vendor key OR tenant BYOK key)
  → providerRegistry.get(provider).complete(request)
  → normalize response to LLMResponse
  → usage record (with provider, model, cost, isByok, fallback info)
  → return LLMResponse
```
```

**Step 2: Verify the insertion**

Read the area around the insertion to confirm it sits between §6.1 and §6.2.

**Step 3: Commit**

```bash
git add _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md
git commit -m "docs(architecture): add §6.1b Provider Adapter Interface section"
```

---

## Task 4: Update AiAgent to Support Routing Tags (Architecture — core-architectural-decisions.md)

**Files:**
- Modify: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md:18288-18308`

**Step 1: Add routingTags alternative to AiAgent schema**

In the AiAgent model block, after line with `modelId` field, add:

```prisma
  routingTags     String[]  @map("routing_tags")   // alternative to modelId — ['cheap', 'tool_use']
```

Also add a comment to the `modelId` field:

Change:
```prisma
  modelId         String        @map("model_id")
```
To:
```prisma
  modelId         String?       @map("model_id")    // explicit model, OR use routingTags for intent-based resolution
```

**Step 2: Update orchestration flow text**

At line 18363, replace:
```
                    ├── Calls Claude API with model + prompt + tools
```
With:
```
                    ├── Calls AI Gateway with model/routing tags + prompt + tools (provider-agnostic)
```

**Step 3: Verify edits**

Read back the AiAgent schema and orchestration flow to confirm.

**Step 4: Commit**

```bash
git add _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md
git commit -m "docs(architecture): update AiAgent for routing tags, provider-agnostic orchestration"
```

---

## Task 5: Update Architectural Boundaries Table (Architecture — project-structure-boundaries.md)

**Files:**
- Modify: `_bmad-output/planning-artifacts/architecture/project-structure-boundaries.md:439`

**Step 1: Update the API ↔ AI boundary row**

Replace line 439:
```
| API ↔ AI | AI orchestration service | Claude API (Anthropic SDK) | Tool definitions in packages/ai-tools |
```
With:
```
| API ↔ AI | AI orchestration service | Multi-LLM Provider Adapters (packages/ai-gateway/src/providers/) | Unified tool definitions in packages/ai-tools, provider adapters in ai-gateway |
```

**Step 2: Verify the edit**

Read back the boundaries table to confirm formatting is intact.

**Step 3: Commit**

```bash
git add _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md
git commit -m "docs(architecture): update API↔AI boundary to multi-LLM provider adapters"
```

---

## Task 6: Update AI Gateway Section (Project Context — project-context.md)

**Files:**
- Modify: `_bmad-output/planning-artifacts/project-context.md:260-262,361`

**Step 1: Update §8b AI Gateway paragraph**

Replace lines 260-262:
```
**Every AI call in the ERP MUST go through the AI Gateway** (`packages/ai-gateway`). No module may call Claude API or any LLM directly.

Flow: ERP module → `aiGateway.complete()` → quota check → Claude API → usage record → return response.
```
With:
```
**Every AI call in the ERP MUST go through the AI Gateway** (`packages/ai-gateway`). No module may call any LLM API directly. The AI Gateway resolves the provider adapter based on the `AiModel` registry and routes through the appropriate SDK (Anthropic, OpenAI, etc.).

Flow: ERP module → `aiGateway.complete()` → quota check → resolve provider from AiModel → resolve credentials (vendor or BYOK) → provider adapter → usage record → return response.
```

**Step 2: Update Development Rule #8**

Replace line 361:
```
8. **Every AI call goes through the AI Gateway** — no direct LLM API calls from business modules
```
With:
```
8. **Every AI call goes through the AI Gateway** — no direct LLM API calls from business modules. All provider SDKs (Anthropic, OpenAI, etc.) are encapsulated in provider adapters within the AI Gateway.
```

**Step 3: Verify both edits**

Read back lines 258-266 and lines 359-363.

**Step 4: Commit**

```bash
git add _bmad-output/planning-artifacts/project-context.md
git commit -m "docs(project-context): update AI Gateway to multi-LLM with provider adapters"
```

---

## Task 7: Add TenantProviderCredential + Update TenantAiUsage (Data Models)

**Files:**
- Modify: `_bmad-output/planning-artifacts/data-models/5-platform-database-models-section-231.md:59-74`

**Step 1: Add new TenantProviderCredential model**

Insert a new section after the TenantAiUsage section (after line 74) and before the TenantAiQuota section:

```markdown
## TenantProviderCredential
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_provider_credentials` | BYOK API keys for Enterprise tenants |
| **PK** | `id` UUID | |
| tenantId | String | FK to Tenant |
| providerId | String(50) | 'anthropic', 'openai', 'google', etc. |
| encryptedKey | String | AES-256 encrypted API key |
| isActive | Boolean | Default true |
| createdAt | DateTime (Timestamptz) | |
| updatedAt | DateTime (Timestamptz) | |
| **Unique** | [tenantId, providerId] | One key per provider per tenant |
```

**Step 2: Update TenantAiUsage table**

In the TenantAiUsage table (lines 59-74), add the following rows before the `**Indexes**` row:

```
| provider | String(50) | 'anthropic', 'openai', 'google' — which LLM provider was called |
| isByok | Boolean | Default false — true if tenant's own API key was used |
| latencyMs | Int? | End-to-end latency in milliseconds |
| fallbackUsed | Boolean | Default false — true if primary model failed and fallback was used |
| fallbackFrom | String?(100) | Original model ID if fallback was triggered |
```

**Step 3: Verify both edits**

Read back the updated TenantAiUsage table and the new TenantProviderCredential section.

**Step 4: Commit**

```bash
git add _bmad-output/planning-artifacts/data-models/5-platform-database-models-section-231.md
git commit -m "docs(data-models): add TenantProviderCredential, extend TenantAiUsage for multi-LLM"
```

---

## Task 8: Update E3b.S3 AI Gateway Story (Epics)

**Files:**
- Modify: `_bmad-output/planning-artifacts/epics/epic-e3b-platform-api-ai-gateway.md:118-165`

**Step 1: Update story title**

Replace line 118:
```
## Story E3b.S3: AI Gateway Service
```
With:
```
## Story E3b.S3: AI Gateway Service + Provider Adapters
```

**Step 2: Update AC#1**

Replace line 123:
```
1. GIVEN any ERP module WHEN it needs to call an LLM THEN it must call `aiGateway.complete()` (no direct Claude API calls) per BR-PLT-007
```
With:
```
1. GIVEN any ERP module WHEN it needs to call an LLM THEN it must call `aiGateway.complete()` (no direct LLM API calls — all provider SDKs encapsulated in adapters) per BR-PLT-007
```

**Step 3: Add new AC for provider abstraction**

After AC#6 (line 128), add:
```
7. GIVEN the AI Gateway WHEN it receives a completion request THEN it resolves the provider adapter from the AiModel registry, resolves credentials (vendor key or tenant BYOK), calls the provider adapter, and normalises the response to a unified LLMResponse format
8. GIVEN a primary model fails (rate limit, 5xx, timeout >10s) WHEN a fallbackModelId is configured on the AiModel THEN the gateway retries with the fallback model and records `fallbackUsed: true` in the usage record
```

**Step 4: Update "Implement LLM proxy" key task**

Replace lines 139-142:
```
- [ ] Implement LLM proxy (AC: #4)
  - [ ] Call Claude API via Anthropic SDK
  - [ ] Stream or complete based on caller preference
  - [ ] Measure prompt/completion tokens from response
```
With:
```
- [ ] Implement LLM provider adapter layer (AC: #4, #7)
  - [ ] Define `LLMProvider` interface in `packages/ai-gateway/src/providers/llm-provider.interface.ts`
  - [ ] Implement `ProviderRegistry` in `packages/ai-gateway/src/providers/provider-registry.ts`
  - [ ] Implement `AnthropicAdapter` in `packages/ai-gateway/src/providers/adapters/anthropic.adapter.ts`
  - [ ] Implement `OpenAIAdapter` in `packages/ai-gateway/src/providers/adapters/openai.adapter.ts`
  - [ ] Implement unified message/tool converters (`message-converter.ts`, `tool-converter.ts`)
  - [ ] Resolve provider from `AiModel.provider` field at call time
  - [ ] Stream or complete based on caller preference (provider-agnostic)
  - [ ] Measure prompt/completion tokens from unified `LLMResponse`
```

**Step 5: Add new key tasks for BYOK and fallback**

After the updated LLM proxy task, add:
```
- [ ] Implement credential resolution (AC: #7)
  - [ ] `packages/ai-gateway/src/credentials/credential-resolver.ts`
  - [ ] Resolution order: (1) tenant BYOK key from `TenantProviderCredential`, (2) vendor platform key
  - [ ] Decrypt BYOK keys at call time (AES-256)
  - [ ] Pass resolved credentials to provider adapter
- [ ] Implement fallback chain (AC: #8)
  - [ ] On provider error (rate limit, 5xx, timeout >10s), resolve `AiModel.fallbackModelId`
  - [ ] Retry with fallback model (may be different provider)
  - [ ] Record `fallbackUsed: true` and `fallbackFrom` in usage data
```

**Step 6: Update FR/NFR reference line**

Replace line 154:
```
**FR/NFR:** FR205 (AI calls through gateway), FR206 (per-call usage recording); NFR47 (<100ms added latency), NFR50 (durable AI records)
```
With:
```
**FR/NFR:** FR205, FR206, FR223 (multi-LLM provider adapters), FR224 (BYOK), FR225 (fallback chains); NFR47, NFR50
```

**Step 7: Update reference documents table row for Architecture**

Replace line 159:
```
| Architecture | §2.31.3 AI Gateway Service | Flow: ERP -> aiGateway.complete() -> quota check -> Claude API -> usage record -> return; quota enforcement behaviour |
```
With:
```
| Architecture | §2.31.3 AI Gateway Service, §6.1b Provider Adapter Interface | Flow: ERP -> aiGateway.complete() -> quota check -> resolve provider -> provider adapter -> usage record -> return; LLMProvider interface, ProviderRegistry, credential resolution, fallback chains |
```

**Step 8: Verify all edits**

Read back lines 116-170 to confirm all changes.

**Step 9: Commit**

```bash
git add _bmad-output/planning-artifacts/epics/epic-e3b-platform-api-ai-gateway.md
git commit -m "docs(epics): update E3b.S3 for multi-LLM provider adapters, BYOK, fallback"
```

---

## Task 9: Update E5.S1 AI Service Layer Story (Epics)

**Files:**
- Modify: `_bmad-output/planning-artifacts/epics/epic-e5-ai-orchestration.md:23,33`

**Step 1: Update model routing key task**

Replace line 23:
```
  - [ ] Handle model routing: Opus for complex analysis, Sonnet for standard tasks, Haiku for extraction
```
With:
```
  - [ ] Handle model routing via AiModel.routingTags: 'reasoning' for complex analysis, 'standard' for CRUD, 'cheap' for extraction. AI Gateway resolves best model per tags from AiModel registry.
```

**Step 2: Update streaming key task**

Replace line 33:
```
  - [ ] Use Anthropic SDK streaming mode
```
With:
```
  - [ ] Use AI Gateway streaming (provider-agnostic — gateway handles provider-specific streaming protocol)
```

**Step 3: Verify both edits**

Read back lines 18-40.

**Step 4: Commit**

```bash
git add _bmad-output/planning-artifacts/epics/epic-e5-ai-orchestration.md
git commit -m "docs(epics): update E5.S1 for provider-agnostic routing and streaming"
```

---

## Task 10: Update E13b AI Usage Dashboard (Epics)

**Files:**
- Modify: `_bmad-output/planning-artifacts/epics/epic-e13b-platform-admin-portal.md:142-182`

**Step 1: Add per-provider breakdown to E13b.S4 AC#2**

Replace line 148:
```
2. GIVEN per-tenant AI usage WHEN the admin drills into a tenant THEN they see usage by feature (chat, document processing, forecasting), daily trend (30-day), and quota progress bar
```
With:
```
2. GIVEN per-tenant AI usage WHEN the admin drills into a tenant THEN they see usage by feature (chat, document processing, forecasting), by provider (Anthropic, OpenAI, etc.), daily trend (30-day), quota progress bar, and BYOK vs vendor key breakdown
```

**Step 2: Add new AC for provider management**

After AC#5 (line 151), add:
```
6. GIVEN the Platform Admin AI settings page WHEN the admin views provider configuration THEN they see vendor-level API keys per provider (masked), active/inactive status, and can update keys
7. GIVEN an Enterprise tier tenant WHEN the admin views the tenant's AI configuration THEN they see any BYOK API keys configured per provider (masked), active/inactive status, and usage split between BYOK and vendor keys
```

**Step 3: Add key tasks for provider management**

After the existing key tasks (after line 168), add:
```
- [ ] Build provider management settings (AC: #6)
  - [ ] Vendor-level API key management per provider (masked display, update)
  - [ ] Provider active/inactive toggles
- [ ] Build tenant BYOK management view (AC: #7)
  - [ ] Per-tenant BYOK key list (masked), add/remove/activate/deactivate
  - [ ] BYOK vs vendor usage split chart
```

**Step 4: Update FR/NFR reference**

Replace line 170:
```
**FR/NFR:** FR205-FR210; NFR46, NFR50
```
With:
```
**FR/NFR:** FR205-FR210, FR224 (BYOK), FR226 (provider management dashboards); NFR46, NFR50
```

**Step 5: Verify all edits**

Read back lines 140-185.

**Step 6: Commit**

```bash
git add _bmad-output/planning-artifacts/epics/epic-e13b-platform-admin-portal.md
git commit -m "docs(epics): add provider management and BYOK to E13b.S4 AI Usage Dashboard"
```

---

## Task 11: Update AI Usage Recording API Contract

**Files:**
- Modify: `_bmad-output/planning-artifacts/api-contracts/20-platform-api-internal-erp-facing-endpoints.md:82-92`

**Step 1: Update POST /ai/record request body**

Replace lines 82-92:
```typescript
// Request
{
  userId: string;
  featureKey: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: string;  // Decimal
  requestId: string;     // Trace ID
}
```
With:
```typescript
// Request
{
  userId: string;
  featureKey: string;
  provider: string;        // 'anthropic', 'openai', 'google' — which LLM provider
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: string;    // Decimal
  requestId: string;       // Trace ID
  isByok: boolean;         // true if tenant's own API key was used (don't bill against quota)
  latencyMs: number;       // end-to-end latency in milliseconds
  fallbackUsed: boolean;   // true if primary model failed and fallback was used
  fallbackFrom?: string;   // original model ID if fallback triggered
}
```

**Step 2: Verify the edit**

Read back lines 78-100.

**Step 3: Commit**

```bash
git add _bmad-output/planning-artifacts/api-contracts/20-platform-api-internal-erp-facing-endpoints.md
git commit -m "docs(api-contracts): extend POST /ai/record with provider, BYOK, fallback fields"
```

---

## Task 12: Add New Functional Requirements FR223-FR226 (PRD)

**Files:**
- Modify: `_bmad-output/planning-artifacts/prd/functional-requirements.md` (append after line 346)

**Step 1: Add new section with FR223-FR226**

Append after line 346 (after FR222):

```markdown

## Platform API — Multi-LLM Provider Abstraction

- FR223: The AI Gateway must route all LLM calls through a provider-agnostic adapter interface (`LLMProvider`), supporting multiple LLM providers (Anthropic, OpenAI, and any future provider via a single adapter class) with unified message, tool, and response formats
- FR224: Enterprise tier tenants can configure their own API keys (BYOK) per LLM provider; BYOK credentials are stored encrypted (AES-256) in the Platform database, and BYOK usage is recorded for audit/observability but not billed against the tenant's token quota
- FR225: The AI Gateway must implement automatic fallback chains — when a primary model fails (rate limit, 5xx error, or timeout exceeding 10 seconds), the gateway retries with the configured fallback model (which may be a different provider), recording fallback usage in the audit trail
- FR226: Platform administrators can manage vendor-level LLM provider API keys, view per-provider AI usage dashboards, and manage Enterprise tenant BYOK key configurations through the Platform Admin Portal
```

**Step 2: Verify the edit**

Read back lines 340-355 to confirm FR223-FR226 appear correctly after FR222.

**Step 3: Commit**

```bash
git add _bmad-output/planning-artifacts/prd/functional-requirements.md
git commit -m "docs(prd): add FR223-FR226 for multi-LLM provider abstraction and BYOK"
```

---

## Task 13: Final Cross-Document Verification

**Files:**
- Read-only verification across all modified files

**Step 1: Verify no contradictions**

Check that these terms are consistent across all documents:
- "provider adapter" / "LLMProvider interface" — used in Architecture, Project Context, E3b, E5
- "BYOK" / "TenantProviderCredential" — used in Data Models, E3b, E13b, API Contracts, PRD
- "fallback chains" / "fallbackModelId" — used in Architecture, E3b, API Contracts, PRD
- "routing tags" / "routingTags" — used in Architecture (AiModel + AiAgent), E5
- FR numbers FR223-FR226 — referenced in E3b and E13b FR/NFR lines, defined in PRD

**Step 2: Verify document sync rule compliance**

Confirm the following documents were NOT modified (per design §4.10):
- `event-catalog.md` — no changes needed
- `state-machine-reference.md` — no changes needed
- `business-rules-compendium.md` — no changes needed
- `ux-design-specification/` — no changes needed

**Step 3: Squash commits (optional)**

If Mohammed prefers a single commit, squash the 12 task commits:
```bash
git rebase -i HEAD~12
# Mark all but the first as "squash"
# Combined message: "docs: update all spec documents for multi-LLM provider abstraction (FR223-FR226)"
```

Otherwise, the individual commits per document provide clear traceability.
