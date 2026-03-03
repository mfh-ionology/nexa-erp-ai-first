# Epic E5b: AI Co-Pilot Intelligence — Memory, Skills & Dynamic Context

**Tier:** 1 | **Dependencies:** E5 (AI Orchestration), E6 (Frontend Shell) | **FRs:** FR7 (conversation history), FR4 (contextual AI) | **NFRs:** NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA)

---

## Design Summary

E5b transforms the Nexa AI Co-Pilot from a stateless chat interface into an **intelligent, context-aware assistant** that knows each user, learns from interactions, and grows its capabilities as new modules are added to the ERP. This is the epic that makes Nexa genuinely "AI-First" — not just AI-added.

### Five Pillars

| Pillar | What It Does | Why It Matters |
|--------|-------------|----------------|
| **Memory System** | Persistent per-user memories (explicit + implicit), conversation summaries, hybrid search with temporal decay | The AI remembers preferences, decisions, and patterns across sessions — "Remember I prefer FIFO costing" persists forever |
| **Skills Registry** | Database-driven skill definitions with trigger phrases, progressive disclosure, and per-module skill packs | When E7 adds Saved Views, the AI automatically knows how to "show me overdue invoices". When E17 adds AR, it learns "create an invoice for Acme" |
| **Tool Framework** | QueryExecutor (reads) + ActionExecutor (writes), registered per-module, with RBAC enforcement and result size limits | Skills route intent, but tools DO the work. Without a tool framework, the AI routes to "get_aging_report" and nothing happens |
| **Inline Entity Mentions** | Natural language autocomplete in the chat textbox — type "contact" and the AI suggests matching entities scoped to context | Users reference ERP entities naturally ("Send invoice to John Smith") without learning slash commands |
| **Dynamic Context Assembly** | Token-budgeted system prompt builder that assembles skills, memories, permissions, and module knowledge from live DB. Supports INTERACTIVE (chat) and AUTONOMOUS (automation) modes | Every AI session gets a personalised, relevant system prompt — no fine-tuning, no static prompts |

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Explicit Memories** | User tells the AI "Remember that I prefer overdue invoices first" → stored as a named memory |
| **Implicit Preferences** | AI observes patterns (user always opens "This Month" view) → stored as learned preferences |
| **Conversation Summaries** | Key decisions and context from past sessions, compressed and stored |
| **Pre-Compaction Memory Flush** | Before conversation context is trimmed, important facts are extracted and stored as memories (inspired by OpenClaw) |
| **Hybrid Search** | BM25 keyword matching + pgvector semantic search, weighted fusion for memory retrieval |
| **Temporal Decay** | Recent memories are weighted higher; old unused memories decay in importance (half-life: 30 days) |
| **Skill Packs** | Each module seeds its own skills (E7 → "Saved Views" pack, E14 → "Finance" pack, E17 → "AR" pack) |
| **Progressive Disclosure** | Three-level skill loading: L0 meta-router → L1 module pack → L2 specific skill instructions. Keeps token budget manageable even with 100+ skills |
| **Dynamic Context Assembly** | On each AI session, the system prompt is built from live data: user memories + relevant skills + permissions + module metadata. Token budget: ~5000 tokens total |
| **Tool Framework** | Two executor types: QueryExecutor (read-only, returns structured data) and ActionExecutor (write, requires user approval). Both use a registry pattern — modules register handlers at startup |
| **QueryExecutor** | Handles READ tools (get_aging_report, search_customers). Enforces companyId scoping, RBAC permission check, result size limits (max rows), and token budget awareness (truncate if too large) |
| **ActionExecutor** | Handles WRITE tools (create_invoice, post_journal). Wraps in $transaction, stages proposals via ActionPlanner, requires user confirmation before execution. Already implemented in E5 |
| **Inline Entity Mentions** | Chat textbox detects entity keywords ("contact", "invoice", "customer") as user types and shows context-aware autocomplete. "Send invoice to contact jo..." → shows John Smith from Acme's contacts. Resolves to structured `{entity:uuid}` references for the AI |
| **Entity Trigger Registry** | Database table (`ai_entity_triggers`) mapping trigger words to entity types, search endpoints, display fields, and context scoping. Seeded per-module like skills and knowledge |
| **Privacy Controls** | User can view, edit, delete any memory. "Forget Everything" option available. Memory can be disabled entirely |

### Database Tables (New)

| Table | Purpose |
|-------|---------|
| `ai_memories` | Explicit and implicit user memories with category, content, importance score, embedding vector |
| `ai_conversation_summaries` | Compressed summaries of past AI sessions |
| `ai_memory_settings` | Per-user memory preferences (enabled, categories, retention period) |

### Database Tables (New — Module Knowledge)

| Table | Purpose |
|-------|---------|
| `ai_module_knowledge` | System-wide structured knowledge about each ERP module — entities, fields, status flows, business rules, FAQs. NOT tenant-scoped (same for all tenants). Seeded per-module alongside skill packs. This is what makes the AI understand the DOMAIN, not just route tools |

### Database Tables (New — Entity Mentions)

| Table | Purpose |
|-------|---------|
| `ai_entity_triggers` | Maps natural language trigger words ("contact", "invoice", "customer") to entity types, search endpoints, display fields, and context scoping. System-wide (no companyId). Seeded per-module |

### Database Tables (New — Skill Overrides)

| Table | Purpose |
|-------|---------|
| `ai_skill_overrides` | Per-tenant overrides for system-wide skills. Allows a tenant to disable a skill, customise trigger phrases, or adjust priority without duplicating the entire skill row. FK to ai_skills + companyId scoping |

### Database Tables (Enhanced from E5)

| Table | Enhancement |
|-------|-------------|
| `ai_skills` | Add: `module_key`, `pack_key`, `trigger_phrases[]`, `negative_triggers[]`, `context_required[]`, `orchestration_pattern`, `skill_content` (Text), `parameters` (Json), `examples` (Json), `priority`, `version`. **Migration note:** E5's `instructions` column is renamed to `skill_content`. E5's `keywords` column is renamed to `trigger_phrases`. Skills remain system-wide (NO companyId) — use `ai_skill_overrides` for tenant-level customisation |
| New: `ai_skill_contexts` | Per-skill dynamic context definitions — what data to inject when a skill is activated |

### Memory Categories

| Category | Examples |
|----------|---------|
| `PREFERENCE` | "Prefers overdue invoices sorted by amount descending" |
| `WORKFLOW` | "Usually creates invoices on Monday mornings" |
| `ENTITY_CONTEXT` | "Working on Project Alpha for Acme Ltd this quarter" |
| `DECISION` | "Decided to use FIFO costing for new warehouse" |
| `INSTRUCTION` | "Always use Net 30 payment terms for new customers" |

### Memory Injection Strategy (Enhanced — inspired by OpenClaw)

On each AI session, the system:
1. Fetches user's active memories (ordered by importance + recency with temporal decay)
2. Performs **hybrid search** (BM25 keyword + pgvector semantic) against memories using conversation context as query
3. Applies **MMR re-ranking** (Maximal Marginal Relevance) to ensure diversity in injected memories
4. Fetches summaries of last 3-5 conversations
5. Applies a token budget (max ~2000 tokens for memories, ~2000 for skills/context)
6. Injects as a `<user_context>` block in the system prompt
7. Prunes old/low-importance memories when storage exceeds per-user limits

### Pre-Compaction Memory Flush (from OpenClaw)

Before the conversation context is trimmed (when approaching token limits):
1. Scan recent messages for extractable facts, decisions, and instructions
2. Create new memories for any novel information (avoid duplicates via semantic similarity check)
3. Update importance scores of existing memories if they were referenced
4. Only then allow context compaction to proceed

### Skills Architecture (from Anthropic Skills Guide)

#### Three-Level Progressive Disclosure

| Level | Loaded When | Token Cost | Contains |
|-------|------------|------------|----------|
| **L0: Meta-Router** | Every session | ~200 tokens | Module list + 1-line descriptions. Routes "show overdue invoices" → AR module |
| **L1: Module Pack** | After L0 routes to module | ~500 tokens | Skill names + trigger phrases for that module. Routes "overdue invoices view" → `open_saved_view` skill |
| **L2: Skill Instructions** | After L1 selects skill | ~300 tokens | Full skill instructions, parameters, examples, required tools |

This means a session that handles "show me overdue invoices" loads: 200 (L0) + 500 (L1 AR pack) + 300 (L2 skill) = ~1000 tokens of skill context, NOT all 50+ skills.

#### Five Orchestration Patterns

| Pattern | When Used | Example |
|---------|-----------|---------|
| **Sequential** | Steps must run in order | Create invoice → post → email to customer |
| **Parallel (Multi-Tool)** | Independent actions | Fetch customer + fetch items + fetch terms simultaneously |
| **Iterative** | Refinement loop | User says "filter by this month" → AI applies → user says "also over £1000" → AI refines |
| **Context-Aware** | Depends on current screen/state | On invoice list: "filter" means apply_filter. On invoice detail: "filter" means nothing |
| **Domain Intelligence** | Requires business knowledge | "What's my cash position?" → needs GL + bank + AR aging + AP aging |

#### Trigger Phrase Engineering

Each skill has:
- **Positive triggers** (String[]): Phrases that activate this skill — "show overdue", "open invoices view", "filter by date"
- **Negative triggers** (String[]): Phrases that should NOT activate — "create invoice" should NOT trigger "open invoice list"
- **Priority** (Int): When multiple skills match, highest priority wins
- **Context required** (String[]): What must be true — e.g., `["screen:entity-list", "module:ar"]`

### Report Configuration Architecture Decision

**Decision: Separate tables for Reports (not reusing E7's data_view_fields)**

Reports have fundamentally different features from list views:
- **Aggregation**: `apply_count`, `apply_sum`, `apply_avg` per column
- **Grouping**: `can_group`, `group_header` — hierarchical group-by with custom headers
- **Computed columns**: Calculated fields that don't exist as entity fields
- **Cross-entity joins**: Reports span multiple tables (e.g., "Sales by Customer by Month")

The `report_definitions` and `report_columns` tables will be designed now but implemented in E25 (Reporting Engine). Schema is documented in the Data Models document.

---

## Story E5b.1: Memory Storage & Retrieval API

**User Story:** As a developer, I want a memory persistence layer so that the AI can store and retrieve user-specific memories, conversation summaries, and preferences.

**Acceptance Criteria:**
1. GIVEN the Prisma schema WHEN migrations run THEN the 3 tables (ai_memories, ai_conversation_summaries, ai_memory_settings) are created with proper indexes
2. GIVEN the `POST /ai/memories` endpoint WHEN called with a memory object THEN the memory is stored with category, content, importance score, and source (EXPLICIT or IMPLICIT)
3. GIVEN the `GET /ai/memories` endpoint WHEN called by an authenticated user THEN only that user's memories for the current company are returned, ordered by importance and recency
4. GIVEN the `DELETE /ai/memories/:id` endpoint WHEN called THEN the memory is permanently deleted (hard delete, not soft)
5. GIVEN the `POST /ai/memories/forget-all` endpoint WHEN called THEN all of the user's memories for the current company are permanently deleted
6. GIVEN the conversation summary service WHEN an AI session ends THEN the key decisions, actions taken, and context are compressed into a summary and stored
7. GIVEN the memory injection service WHEN a new AI session starts THEN relevant memories and recent summaries are assembled into a `<user_context>` block within a token budget of ~2000 tokens
8. GIVEN memory settings WHEN a user disables memory THEN no new memories are created and existing memories are not injected
9. GIVEN the importance scoring algorithm WHEN a memory is accessed or referenced THEN its `lastAccessedAt` is updated and importance score recalculated using: `score = baseScore * (explicit > implicit weight) * temporalDecay(daysSinceAccess, halfLife=30)`

**Key Tasks:**
- [ ] Create Prisma models for ai_memories, ai_conversation_summaries, ai_memory_settings
- [ ] Create migration and seed script (default settings per company)
- [ ] Implement memory CRUD endpoints (POST, GET, PATCH, DELETE)
- [ ] Implement `POST /ai/memories/forget-all` (hard delete all user memories)
- [ ] Implement conversation summary service (compress session → summary on session end)
- [ ] Implement memory injection service (assemble context block within token budget)
- [ ] Implement importance scoring algorithm (recency + frequency + explicit > implicit + temporal decay)
- [ ] Implement memory pruning job (cron: remove expired/low-importance memories exceeding per-user limits)
- [ ] Add comprehensive test coverage

**FR/NFR:** FR7, FR4; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §4.2 AI Service Layer | AI Gateway, provider adapters, session management |
| API Contracts | §2.6 AI & Chat | Existing AI endpoints, conversation history |
| Data Models | §3.1 System Module | New: ai_memories, ai_conversation_summaries, ai_memory_settings |
| State Machines | N/A | N/A |
| Event Catalog | `AiMemoryCreated`, `AiMemoryDeleted`, `AiConversationSummarised` | New events |
| Business Rules | N/A | N/A |
| UX Design Spec | §AI Interaction Model | Co-Pilot Dock, conversation flows |
| Project Context | §12 AI-First Integration | Dynamic system context, per-epic AI tools |

---

## Story E5b.2: Skills Registry, Tool Framework & Dynamic Context Assembly

**User Story:** As a developer, I want a database-driven skills registry, tool execution framework, module knowledge base, entity trigger registry, and dynamic context assembler so that the AI Co-Pilot automatically gains capabilities, domain understanding, and entity awareness as modules are added, without requiring code changes to the AI system.

**Acceptance Criteria:**

*Schema & Migration:*
1. GIVEN the enhanced AiSkill model WHEN migration runs THEN the existing `ai_skills` table gains new columns: `module_key`, `pack_key`, `trigger_phrases[]`, `negative_triggers[]`, `context_required[]`, `orchestration_pattern`, `parameters` (Json), `examples` (Json), `priority`, `version`. **Migration note:** E5's `instructions` column is renamed to `skill_content`. E5's `keywords` column is renamed to `trigger_phrases`. Skills remain system-wide (NO companyId) — tenant overrides use `ai_skill_overrides`
2. GIVEN the new AiSkillContext model WHEN migration runs THEN the `ai_skill_contexts` table is created with `skill_id`, `context_key`, `context_query` (Text), `token_budget`, `cache_ttl_seconds`, and `is_required`
3. GIVEN the new AiModuleKnowledge model WHEN migration runs THEN the `ai_module_knowledge` table is created with `module_key`, `knowledge_type` (OVERVIEW, ENTITIES, WORKFLOWS, BUSINESS_RULES, FAQ, TERMINOLOGY), `title`, `content` (Text), `priority`, `is_active`. This table is system-wide (no companyId) — module knowledge is the same for all tenants
4. GIVEN the new AiSkillOverride model WHEN migration runs THEN the `ai_skill_overrides` table is created with `skill_id` (FK), `company_id` (FK), `is_active` (override enable/disable), `trigger_phrases_override` (String[]?), `priority_override` (Int?). Unique constraint on `[skill_id, company_id]`
5. GIVEN the new AiEntityTrigger model WHEN migration runs THEN the `ai_entity_triggers` table is created with `module_key`, `trigger_word` (String), `entity_type` (String), `search_endpoint` (String), `display_field` (String), `scope_by` (String? — e.g., "customerId" for contacts scoped to a customer), `icon` (String?), `priority`, `is_active`. System-wide (no companyId). Unique constraint on `[module_key, trigger_word]`

*Skill Routing (L0 → L1 → L2):*
6. GIVEN the meta-router (L0) WHEN a user message arrives THEN the system loads all active module pack summaries (~200 tokens) and classifies the intent to the correct module
7. GIVEN the module pack (L1) WHEN a module is identified THEN all skills for that module are loaded with trigger phrases (~500 tokens) AND the module's OVERVIEW knowledge is loaded (~200 tokens). The best-matching skill is selected using trigger phrase matching + negative trigger exclusion. Tenant skill overrides are applied (disabled skills excluded, custom trigger phrases used)
8. GIVEN a selected skill (L2) WHEN the skill is activated THEN its full `skill_content` (instructions), `parameters`, and `examples` are loaded (~300 tokens) AND relevant entity/business rule knowledge for the skill's context is loaded (~300 tokens)

*Tool Framework:*
9. GIVEN the QueryExecutor service WHEN a READ tool is called by the AI (e.g., `get_aging_report`) THEN the executor: (a) looks up the registered handler by tool name, (b) enforces companyId scoping on all queries, (c) checks RBAC permission (user must have read access to the module), (d) executes the handler and returns structured JSON, (e) truncates results if they exceed the tool's token budget (default: 2000 tokens). No user confirmation required for reads
10. GIVEN the ActionExecutor service (from E5) WHEN a WRITE tool is called by the AI (e.g., `create_invoice`) THEN the existing E5 flow applies: ActionPlanner stages proposal → guardrails check → user confirmation required → ActionExecutor executes in transaction
11. GIVEN a module's tool definitions WHEN the module plugin initialises THEN it registers BOTH query handlers (`queryExecutor.registerHandler('get_aging_report', handler)`) AND action handlers (`actionExecutor.registerHandler('CREATE_INVOICE', handler)`) using the existing registry pattern from E5's ActionExecutor. Tool definitions (name, description, inputSchema) are stored in the `@nexa/ai-tools` package
12. GIVEN the skill routing chain WHEN a skill is activated (L2) THEN the skill's `requiredTools` are resolved from the tool registry and passed to the AI Gateway as the `tools` array for that turn. Only the tools the active skill needs are sent — not all registered tools

*Dynamic Context Assembly:*
13. GIVEN the dynamic context assembler in INTERACTIVE mode (chat sessions) WHEN building a session's system prompt THEN it assembles: base system prompt + user memories (≤2000 tokens) + active skill chain L0→L1→L2 (≤1000 tokens) + module knowledge (≤500 tokens) + user permissions + current screen context, all within a total budget of ~5000 tokens
14. GIVEN the dynamic context assembler in AUTONOMOUS mode (E5c automations) WHEN building an agent's context THEN it assembles: base system prompt + module knowledge (≤500 tokens) + skill instructions (≤1000 tokens) + automation-specific input data (from step config). NO user memories, NO screen context (there is no user session). Total budget: ~3000 tokens

*Seeding & Endpoints:*
15. GIVEN a seed script for a module WHEN the module's migration runs THEN the skill pack, module knowledge, tool definitions, AND entity triggers are all automatically registered
16. GIVEN the `GET /ai/skills` endpoint WHEN called with `?moduleKey=ar` THEN only skills for that module are returned, ordered by priority, with any tenant overrides applied
17. GIVEN the `GET /ai/knowledge?moduleKey=ar&type=ENTITIES` endpoint WHEN called THEN it returns structured knowledge about AR entities (invoices, payments, credit notes) including fields, status flows, and business rules
18. GIVEN the `GET /ai/entity-triggers?moduleKey=ar` endpoint WHEN called THEN it returns all entity triggers for that module, used by the frontend chat textbox for autocomplete

**Key Tasks:**
- [ ] Enhance AiSkill Prisma model — rename `instructions`→`skill_content`, `keywords`→`trigger_phrases`, add new columns (migration)
- [ ] Create AiSkillContext Prisma model
- [ ] Create AiSkillOverride Prisma model (companyId + skillId, unique constraint)
- [ ] Create AiModuleKnowledge Prisma model (system-wide, no companyId)
- [ ] Create AiEntityTrigger Prisma model (system-wide, no companyId)
- [ ] Implement QueryExecutor service in `api/src/ai/query-executor.ts` — registry pattern mirroring ActionExecutor, with companyId scoping, RBAC check, result truncation
- [ ] Implement tool registration pattern in module plugins (register query + action handlers at startup)
- [ ] Populate `@nexa/ai-tools` package with Tool definition types and base tool schemas
- [ ] Implement meta-router service (L0: classify user intent → module)
- [ ] Implement module pack loader (L1: load skills + module overview knowledge, apply tenant overrides)
- [ ] Implement skill activator (L2: load full skill content + resolve requiredTools from registry)
- [ ] Implement dynamic context assembler with INTERACTIVE and AUTONOMOUS modes
- [ ] Implement skill CRUD endpoints (POST, GET, PATCH, DELETE — admin only)
- [ ] Implement skill override CRUD endpoints (POST, GET, PATCH, DELETE — admin only, tenant-scoped)
- [ ] Implement module knowledge CRUD endpoints (POST, GET, PATCH, DELETE — admin only)
- [ ] Implement entity trigger CRUD endpoints (POST, GET, PATCH, DELETE — admin only)
- [ ] Create seed script pattern for per-module skill + knowledge + tools + entity triggers
- [ ] Add comprehensive test coverage (unit: trigger matching, tool resolution, knowledge retrieval, override application; integration: L0→L1→L2→tool execution chain)

**FR/NFR:** FR4; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §4.2 AI Service Layer, §6 AI Infrastructure | AI Gateway, tool definitions, agent configuration, ActionExecutor |
| API Contracts | §2.6 AI & Chat | New: skill registry, entity trigger, tool endpoints |
| Data Models | §3.20 AI Infrastructure | Enhanced: ai_skills; New: ai_skill_contexts, ai_skill_overrides, ai_entity_triggers |
| State Machines | N/A | N/A |
| Event Catalog | `AiSkillActivated`, `AiSkillPackLoaded`, `AiToolExecuted`, `AiQueryExecuted` | New events |
| Business Rules | N/A | N/A |
| UX Design Spec | §AI Interaction Model | Co-Pilot intent routing |
| Project Context | §12 AI-First Integration, §14 Skills Architecture | Progressive disclosure, trigger phrases, tool framework |

---

## Story E5b.3: Implicit Memory Learning & Pre-Compaction Flush

**User Story:** As a user, I want the AI to learn my preferences and patterns over time without me having to tell it, and I want it to preserve important context even when conversations are long.

**Acceptance Criteria:**
1. GIVEN repeated user actions (e.g., always opening "Overdue Invoices" view) WHEN the pattern threshold is met (3+ occurrences) THEN the AI creates an IMPLICIT memory: "User frequently views overdue invoices"
2. GIVEN an explicit instruction ("Remember that I prefer Net 30 for new customers") WHEN the AI parses it THEN an EXPLICIT memory is created with category INSTRUCTION and high importance
3. GIVEN the AI makes a suggestion based on a memory WHEN presenting it THEN the AI cites the memory source (e.g., "Based on your preference for Net 30 terms...")
4. GIVEN an implicit memory conflicts with an explicit instruction WHEN both are present THEN the explicit instruction takes precedence
5. GIVEN a user corrects the AI ("No, I actually prefer FIFO now") WHEN the correction is processed THEN the old memory is updated or replaced with the correction
6. GIVEN a conversation approaching the context window limit WHEN pre-compaction is triggered THEN the system extracts novel facts, decisions, and instructions from recent messages, creates new memories (with semantic dedup check), updates importance of referenced memories, and only then allows compaction
7. GIVEN the pre-compaction extractor WHEN it finds a potential new memory THEN it checks semantic similarity against existing memories (threshold: 0.85) and either creates a new memory or merges with an existing one

**Key Tasks:**
- [ ] Implement pattern detection service (track user actions, detect repetition)
- [ ] Implement explicit memory parser (extract "Remember..." instructions from conversation)
- [ ] Implement memory citation in AI responses
- [ ] Implement conflict resolution (explicit > implicit, newer > older)
- [ ] Implement correction handler (user says "no, actually..." → update memory)
- [ ] Implement pre-compaction memory flush (extract facts before context trim)
- [ ] Implement semantic deduplication check (cosine similarity threshold: 0.85)
- [ ] Add integration tests for learning scenarios and pre-compaction

**FR/NFR:** FR4; NFR2

---

## Story E5b.4: Hybrid Search & Memory Intelligence

**User Story:** As a developer, I want the memory system to use hybrid search (keyword + semantic) with temporal decay so that memory retrieval is accurate, diverse, and recency-aware.

**Acceptance Criteria:**
1. GIVEN the migration runs WHEN pgvector is needed THEN the migration includes `CREATE EXTENSION IF NOT EXISTS vector` (one-time, idempotent). This extension is shared by E5b (memories), E5d (knowledge chunks), and any future vector search. Then the `ai_memories` table has a `vector(1536)` column for embedding storage with an HNSW index
2. GIVEN a memory is created or updated WHEN the content changes THEN an embedding is generated via the AI Gateway (using the configured embedding model) and stored in the vector column
3. GIVEN a memory retrieval query WHEN the system searches THEN it performs both BM25 keyword search (via PostgreSQL full-text search `tsvector/tsquery`) AND pgvector cosine similarity search, then fuses results using weighted Reciprocal Rank Fusion (default weights: keyword 0.3, semantic 0.7)
4. GIVEN a set of candidate memories from hybrid search WHEN ranking for injection THEN MMR (Maximal Marginal Relevance) re-ranking is applied to ensure diversity (lambda=0.7: 70% relevance, 30% diversity)
5. GIVEN a memory with `lastAccessedAt` = 30 days ago WHEN temporal decay is applied THEN its effective importance is halved (half-life = 30 days, configurable in ai_memory_settings)
6. GIVEN a memory that hasn't been accessed in 90+ days AND has importance score below threshold WHEN the pruning job runs THEN it is archived or deleted based on user's retention settings

**Key Tasks:**
- [ ] Install pgvector extension via migration (`CREATE EXTENSION IF NOT EXISTS vector`) — shared dependency for E5b and E5d
- [ ] Add `embedding vector(1536)` column to ai_memories with HNSW index
- [ ] Add `tsvector` column and GIN index for full-text search
- [ ] Implement shared `VectorSearchService` in `api/src/ai/vector-search.service.ts` — reusable for both memory search (this story) and knowledge RAG (E5d). Methods: `generateEmbedding(text)`, `similaritySearch(embedding, table, limit)`, `hybridSearch(query, table, weights)`, `mmrRerank(candidates, lambda)`
- [ ] Implement shared `EmbeddingService` in `api/src/ai/embedding.service.ts` — via AI Gateway, batch-capable, with caching. Reused by E5d for knowledge chunk embeddings
- [ ] Implement BM25 keyword search using PostgreSQL `ts_rank_cd`
- [ ] Implement pgvector cosine similarity search (via VectorSearchService)
- [ ] Implement Reciprocal Rank Fusion (RRF) for hybrid results (via VectorSearchService)
- [ ] Implement MMR re-ranking for diversity (via VectorSearchService)
- [ ] Implement temporal decay function: `effectiveScore = baseScore * 0.5^(daysSinceAccess / halfLife)`
- [ ] Add performance benchmarks (target: <100ms for memory retrieval on 10K memories per user)
- [ ] Add comprehensive test coverage

**FR/NFR:** FR4; NFR2 (memory retrieval <100ms)

---

## Story E5b.5: Memory & Skills Management UI

**User Story:** As a user, I want to view, edit, and delete what the AI remembers about me, and I want to see what skills the AI has available, so that I maintain control and transparency over my AI experience.

**Acceptance Criteria:**
1. GIVEN the user navigates to Settings > AI Memory THEN they see a list of all their memories grouped by category (Preferences, Workflows, Decisions, Instructions)
2. GIVEN a memory item WHEN the user clicks edit THEN they can modify the content text
3. GIVEN a memory item WHEN the user clicks delete THEN the memory is permanently removed with confirmation
4. GIVEN the "Forget Everything" button WHEN clicked THEN a confirmation dialog appears and upon confirmation all memories are permanently deleted
5. GIVEN memory settings WHEN the user toggles "Enable AI Memory" off THEN no new memories are created and existing memories are not used in AI sessions (but not deleted)
6. GIVEN memory settings WHEN the user configures category toggles (e.g., disable "Workflow" memories) THEN only enabled categories are created/injected
7. GIVEN the memory list WHEN rendered THEN each memory shows: content, category badge, source (Explicit/Learned), creation date, and last-used date
8. GIVEN the user navigates to Settings > AI Skills THEN they see a read-only list of all available skill packs grouped by module, with each skill showing: name, description, trigger phrases, and active/inactive status
9. GIVEN an ADMIN user on the AI Skills page WHEN they click a skill THEN they can edit trigger phrases and toggle active/inactive status

**Key Tasks:**
- [ ] Build Memory Management page (T7 Settings template, Concept D styled)
- [ ] Build memory list with category grouping, search, and filters
- [ ] Build memory edit dialog
- [ ] Build "Forget Everything" confirmation flow
- [ ] Build memory settings panel (enable/disable, category toggles, retention period)
- [ ] Build AI Skills browser page (T7 Settings, read-only for STAFF, editable for ADMIN)
- [ ] Build skill pack viewer with module grouping and trigger phrase display
- [ ] Wire all mutations to API endpoints with optimistic updates
- [ ] Ensure all components match Concept D visual design

**FR/NFR:** FR7; NFR27

---

## Story E5b.6: E7 Skill Pack Validation (Proof-of-Concept)

**User Story:** As a product team, we want to validate the skills architecture end-to-end by seeding and testing the E7 (Saved Views) skill pack, proving that the AI can correctly route user intents like "show me overdue invoices" through L0→L1→L2 to the right action.

**Acceptance Criteria:**
1. GIVEN the E7 skill pack seed WHEN it runs THEN the following skills are registered: `open_entity_list`, `search_views`, `apply_filter`, `list_saved_views`, `create_saved_view`
2. GIVEN the meta-router (L0) WHEN the user says "show me all invoices" THEN L0 classifies this as module=`views` and triggers L1 load
3. GIVEN the views module pack (L1) WHEN loaded THEN trigger phrases for each skill are matched: "show me" + "invoices" → `open_entity_list` with high confidence
4. GIVEN `open_entity_list` skill is selected (L2) WHEN activated THEN the full skill instructions are injected and the AI calls `open_entity_list(viewKey: 'INVOICES')`
5. GIVEN the user says "show me the Overdue for more than 20 days View" WHEN processed THEN the AI calls `search_views(query: 'Overdue for more than 20 days')` → fuzzy match → `open_entity_list(viewKey: 'INVOICES', savedViewName: 'Overdue > 20 Days')`
6. GIVEN the user says "filter invoices by this month" WHEN processed THEN the AI calls `apply_filter(viewKey: 'INVOICES', conditions: [{field: 'invoiceDate', operator: 'BETWEEN', datePreset: 'thismonth'}])`
7. GIVEN the user says "create a new view called Big Invoices for amounts over 10000" WHEN processed THEN the AI calls `create_saved_view(name: 'Big Invoices', viewKey: 'INVOICES', conditions: [{field: 'amount', operator: 'GT', value: 10000}])`
8. GIVEN a negative trigger scenario WHEN the user says "create an invoice" THEN the views skill pack does NOT activate (negative trigger: "create an invoice" ≠ "create a view")

**Key Tasks:**
- [ ] Create E7 skill pack seed data (5 skills with trigger phrases, negative triggers, examples)
- [ ] Write E2E integration tests for L0→L1→L2 routing chain
- [ ] Write E2E tests for each of the 5 E7 skills
- [ ] Write negative trigger tests (ensure wrong skills don't activate)
- [ ] Document the skill pack seed pattern for future epics to follow
- [ ] Create a "Skill Pack Development Guide" in docs/ for future module developers

**FR/NFR:** FR4; NFR2

---

## Story E5b.7: Inline Entity Mentions & Chat Autocomplete

**User Story:** As a user, I want the chat textbox to detect when I'm referencing ERP entities (contacts, invoices, customers) and show context-aware autocomplete suggestions, so that I can naturally reference entities without learning special commands or knowing exact IDs.

**Acceptance Criteria:**
1. GIVEN the chat textbox WHEN the user types a recognised entity trigger word (e.g., "contact", "invoice", "customer") followed by a space or partial text THEN an autocomplete dropdown appears below the cursor showing matching entities from the relevant search endpoint
2. GIVEN the entity trigger "contact" with `scopeBy: "customerId"` WHEN the user's message already mentions a customer (e.g., "Send invoice 1042 to contact jo...") THEN the contact search is scoped to that customer's contacts — NOT all contacts in the system. The scoping is resolved from other entity references already in the message
3. GIVEN the autocomplete dropdown WHEN the user selects an entity THEN the trigger word + partial text is replaced with a styled entity chip showing the entity's display name (e.g., **John Smith**). The underlying payload includes the structured reference `{contact:uuid-123}` that the AI receives
4. GIVEN the user sends a message with entity chips WHEN the AI processes it THEN each chip is resolved to a structured reference with entity type and UUID, enabling the AI to call tools with exact entity identifiers (no ambiguity, no fuzzy matching needed)
5. GIVEN the entity trigger registry WHEN loaded by the frontend THEN triggers are fetched from `GET /ai/entity-triggers` and cached client-side (1hr TTL). The trigger detection runs locally in the browser — no server round-trip for trigger matching, only for entity search
6. GIVEN the entity search API call WHEN triggered by autocomplete THEN the request is debounced (300ms), includes the user's partial text as `q` parameter, is scoped by companyId (from auth context) and any contextual entity (from message analysis), and returns max 8 results with display name + subtitle (e.g., email for contacts, reference for invoices)
7. GIVEN entity types across modules WHEN all trigger words are loaded THEN there are no conflicts — each trigger word maps to exactly one entity type. If a module needs "order" for both Sales Orders and Purchase Orders, it must use distinct triggers ("sales order" vs "purchase order")
8. GIVEN the autocomplete popup WHEN rendered THEN it follows Concept D styling (purple highlight on selected item, 8px radius, shadow matching card shadow tokens) and supports keyboard navigation (↑↓ to navigate, Enter to select, Escape to dismiss)
9. GIVEN a user on mobile WHEN entity autocomplete triggers THEN the dropdown renders above the keyboard as a bottom sheet (not a dropdown that gets hidden behind the virtual keyboard)

**Key Tasks:**
- [ ] Build entity mention detection logic in chat textbox component (local trigger word matching, cursor position tracking)
- [ ] Build autocomplete dropdown component (Concept D styled, keyboard navigable, mobile-responsive as bottom sheet)
- [ ] Build entity chip component (styled inline display with underlying structured reference)
- [ ] Build message serialiser that converts chips → structured payload (`{entityType:uuid}`) for the AI
- [ ] Implement context analysis — extract already-referenced entities from message to scope subsequent autocomplete (e.g., customer mentioned → scope contacts to that customer)
- [ ] Implement `GET /ai/entity-triggers` endpoint (returns all triggers, cached by frontend)
- [ ] Implement entity search proxy endpoint `GET /ai/entity-search?type=Contact&q=jo&scopeBy=customerId&scopeValue=uuid` — delegates to the module's existing search endpoint with companyId + scope
- [ ] Seed initial entity triggers for E7 entities (DataView, SavedView)
- [ ] Add E2E tests for trigger detection, scoped search, chip rendering, mobile bottom sheet
- [ ] Ensure all components match Concept D visual design

**FR/NFR:** FR4, FR7; NFR27

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.4 Dual Interface Pattern | Chat textbox, Co-Pilot Dock |
| API Contracts | §2.6 AI & Chat | New: entity trigger + entity search endpoints |
| Data Models | §3.20 AI Infrastructure | New: ai_entity_triggers |
| State Machines | N/A | N/A |
| Event Catalog | `AiEntityMentionResolved` | New event |
| Business Rules | N/A | N/A |
| UX Design Spec | §AI Interaction Model | Chat textbox, autocomplete patterns |
| Project Context | §14 Skills Architecture | Entity trigger registry |

---

## AI Integration

### Tools Added

| Tool | Parameters | Description |
|------|-----------|-------------|
| `remember` | `content: string`, `category: string` | Store an explicit memory from user instruction |
| `recall` | `query: string` | Search user's memories for relevant context using hybrid search |
| `forget` | `memoryId: string` | Delete a specific memory |
| `list_memories` | `category?: string` | List user's memories, optionally filtered by category |
| `list_skills` | `moduleKey?: string` | List available AI skills, optionally filtered by module |
| `resolve_entity` | `entityType: string`, `query: string`, `scopeBy?: string` | Search for an entity by type and partial name (used when AI needs to resolve an ambiguous reference) |

### Context Injected

On every AI session (dynamically assembled):
```
<user_context>
## Your Memories About This User
- [INSTRUCTION] Always use Net 30 payment terms for new customers
- [PREFERENCE] Prefers overdue invoices sorted by amount descending
- [WORKFLOW] Usually reviews AR aging report on Friday afternoons
- [DECISION] Using FIFO costing for Warehouse B

## Recent Conversation Summaries
- 2026-02-24: Discussed quarterly AR review. User approved write-off of 3 invoices >90 days.
- 2026-02-20: Set up new customer Acme Ltd with special pricing tier.
</user_context>

<available_modules>
- views: Saved Views, Filters, Column Management
- finance: General Ledger, Chart of Accounts, Journal Entries
- ar: Customer Invoices, Payments, Credit Management
- ...
</available_modules>

<active_skill>
## open_entity_list
Navigate to an entity list page, optionally with a named saved view applied.
Parameters: viewKey (required), savedViewName (optional)
Example: open_entity_list(viewKey: 'INVOICES', savedViewName: 'Overdue > 30 Days')
</active_skill>
```

### Example User Queries

| User Says | AI Action |
|-----------|-----------|
| "Remember that I always want to see overdue invoices first" | `remember("Always show overdue invoices first", "INSTRUCTION")` |
| "What do you know about me?" | `list_memories()` → present categorised list |
| "Forget what you know about my invoice preferences" | `recall("invoice preferences")` → find matches → `forget(memoryId)` with confirmation |
| "What did we discuss last week about AR?" | Search conversation summaries for AR-related content via hybrid search |
| "Show me overdue invoices" | L0→views L1→open_entity_list L2→`open_entity_list(viewKey: 'INVOICES', savedViewName: 'Overdue')` |
| "What can you help me with in AR?" | `list_skills(moduleKey: 'ar')` → present capabilities |

---

## Appendix: Skill Pack Seed Pattern

When a future epic (e.g., E17 AR) adds new capabilities, developers create a seed file:

```typescript
// packages/db/prisma/seeds/skill-packs/ar.ts
export const arSkillPack: SkillPackSeed = {
  moduleKey: 'ar',
  packKey: 'ar-core',
  skills: [
    {
      skillKey: 'create_invoice',
      name: 'Create Customer Invoice',
      description: 'Create a new customer invoice with line items',
      triggerPhrases: ['create invoice', 'new invoice', 'bill customer', 'invoice for'],
      negativeTriggers: ['view invoice', 'open invoice', 'find invoice', 'search invoice'],
      orchestrationPattern: 'SEQUENTIAL',
      requiredTools: ['create_customer_invoice', 'add_invoice_line', 'post_invoice'],
      contextRequired: ['module:ar'],
      priority: 100,
      examples: [
        { input: 'Create an invoice for Acme Ltd', output: 'create_customer_invoice(customerName: "Acme Ltd")' },
      ],
    },
    // ... more skills
  ],
};
```

This pattern ensures every module automatically extends the AI Co-Pilot's capabilities.

---

## Appendix: Module Knowledge Seed Pattern

Alongside skill packs, each epic seeds **module knowledge** — structured domain understanding that the AI uses to answer questions, explain concepts, and make intelligent suggestions:

```typescript
// packages/db/prisma/seeds/module-knowledge/ar.ts
export const arModuleKnowledge: ModuleKnowledgeSeed = {
  moduleKey: 'ar',
  knowledge: [
    {
      knowledgeType: 'OVERVIEW',
      title: 'Accounts Receivable Module',
      content: `The AR module manages money owed TO the company by customers.
Key functions: customer invoicing, payment collection, credit management, aging analysis.
Key entities: Customer Invoice, Customer Payment, Credit Note, Customer Statement.
Key metrics: total outstanding, overdue amount, DSO (days sales outstanding), aging buckets.`,
      priority: 100,
    },
    {
      knowledgeType: 'ENTITIES',
      title: 'Customer Invoice',
      content: `## Customer Invoice
A customer invoice records amounts owed by customers for goods/services delivered.

### Fields
- customer (FK) — the debtor
- invoiceDate, dueDate — when issued and when payment is expected
- reference — auto-generated from NumberSeries
- lines[] — line items with item, quantity, unitPrice, vatCode, amount
- status — current lifecycle state
- totalNet, totalVat, totalGross — calculated from lines
- amountDue — totalGross minus payments applied

### Status Flow
DRAFT → POSTED → PAID
Also: DRAFT → VOID (cancelled before posting)
Also: POSTED → CREDIT_NOTE (reversal after posting)

### Business Rules
- Cannot post without at least one line item
- Cannot modify a POSTED invoice (must create credit note)
- Overdue = dueDate < today AND status = POSTED AND amountDue > 0
- Posting creates GL journal entries (debit: Trade Debtors, credit: Revenue + VAT)`,
      priority: 90,
    },
    {
      knowledgeType: 'BUSINESS_RULES',
      title: 'AR Business Rules',
      content: `- Payment allocation: FIFO by default (oldest invoice first), can be manually overridden
- Credit limit: warn when new invoice would exceed customer credit limit, block if hard limit
- Write-off: invoices overdue >180 days can be written off (requires ADMIN approval)
- Statement generation: monthly, shows all transactions for the period`,
      priority: 80,
    },
    {
      knowledgeType: 'FAQ',
      title: 'Common AR Questions',
      content: `- "How many overdue invoices?" → Count WHERE dueDate < today AND status = POSTED AND amountDue > 0
- "What's the total outstanding?" → SUM(amountDue) WHERE status IN (POSTED)
- "Show aging report" → Group by age buckets: Current (0-30), 31-60, 61-90, 90+
- "Who owes the most?" → GROUP BY customer, ORDER BY SUM(amountDue) DESC
- "What's our DSO?" → (Total AR / Revenue) × Days in period`,
      priority: 70,
    },
    {
      knowledgeType: 'TERMINOLOGY',
      title: 'AR Terminology',
      content: `- **Trade Debtors**: GL account where customer debt is recorded
- **Aging**: Categorising outstanding invoices by how long overdue
- **DSO**: Days Sales Outstanding — average days to collect payment
- **Credit Note**: A reversal document for a posted invoice
- **Statement**: Summary of all transactions for a customer over a period
- **Write-off**: Acknowledging a debt will not be collected (bad debt expense)`,
      priority: 60,
    },
  ],
};
```

This pattern ensures the AI doesn't just know HOW to create an invoice (skill), but understands WHAT an invoice is, WHAT rules apply, and WHAT users commonly ask about (knowledge).

---

## Appendix: AiModuleKnowledge Prisma Model

```prisma
model AiModuleKnowledge {
  id              String    @id @default(uuid())
  moduleKey       String    @map("module_key")      // 'ar', 'finance', 'inventory', 'views'
  knowledgeType   String    @map("knowledge_type")  // OVERVIEW, ENTITIES, WORKFLOWS, BUSINESS_RULES, FAQ, TERMINOLOGY
  title           String    @db.VarChar(500)
  content         String    @db.Text                // Markdown content — structured domain knowledge
  priority        Int       @default(100)           // Higher = injected first within token budget
  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@map("ai_module_knowledge")
  @@index([moduleKey, knowledgeType, isActive], map: "idx_module_knowledge")
}
```

Note: This table has NO `companyId` — module knowledge is system-wide. "A journal entry must balance" is true for every tenant. Tenant-specific domain knowledge (e.g., "our company uses VAT code 3 for reverse charge") goes in `ai_knowledge_articles` (E5d).

---

## Appendix: AiSkillOverride Prisma Model

```prisma
model AiSkillOverride {
  id                      String    @id @default(uuid())
  skillId                 String    @map("skill_id")
  companyId               String    @map("company_id")
  isActive                Boolean?  @map("is_active")              // null = inherit, true/false = override
  triggerPhrasesOverride  String[]  @map("trigger_phrases_override") // empty = inherit, non-empty = replace
  priorityOverride        Int?      @map("priority_override")      // null = inherit
  createdAt               DateTime  @default(now()) @map("created_at")
  updatedAt               DateTime  @updatedAt @map("updated_at")

  skill                   AiSkill        @relation(fields: [skillId], references: [id])
  company                 CompanyProfile @relation(fields: [companyId], references: [id])

  @@map("ai_skill_overrides")
  @@unique([skillId, companyId], map: "uq_skill_override")
}
```

Note: This avoids duplicating 100+ skill rows per tenant. Overrides are sparse — only tenants who customise a skill have a row. The module pack loader (L1) merges overrides at query time.

---

## Appendix: AiEntityTrigger Prisma Model

```prisma
model AiEntityTrigger {
  id              String    @id @default(uuid())
  moduleKey       String    @map("module_key")       // 'ar', 'sales', 'hr', 'inventory'
  triggerWord     String    @map("trigger_word")     // 'contact', 'invoice', 'customer', 'item'
  entityType      String    @map("entity_type")      // 'Contact', 'CustomerInvoice', 'Customer', 'Item'
  searchEndpoint  String    @map("search_endpoint")  // '/contacts/search', '/ar/invoices/search'
  displayField    String    @map("display_field")    // 'fullName', 'reference', 'name'
  subtitleField   String?   @map("subtitle_field")   // 'email', 'customerName', null
  scopeBy         String?   @map("scope_by")         // 'customerId' — scopes search to a related entity
  icon            String?                             // 'user', 'file-text', 'building' — Lucide icon name
  priority        Int       @default(100)
  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@map("ai_entity_triggers")
  @@unique([moduleKey, triggerWord], map: "uq_entity_trigger")
  @@index([isActive], map: "idx_entity_triggers_active")
}
```

Note: System-wide (no companyId). Trigger words must be unique per module. If Sales and Purchasing both need "order", they use "sales order" and "purchase order".

---

## Appendix: Entity Trigger Seed Pattern

Alongside skill packs and module knowledge, each epic seeds entity triggers for the chat autocomplete:

```typescript
// packages/db/prisma/seeds/entity-triggers/ar.ts
export const arEntityTriggers: EntityTriggerSeed = {
  moduleKey: 'ar',
  triggers: [
    {
      triggerWord: 'invoice',
      entityType: 'CustomerInvoice',
      searchEndpoint: '/ar/invoices/search',
      displayField: 'reference',
      subtitleField: 'customerName',
      icon: 'file-text',
      priority: 100,
    },
    {
      triggerWord: 'customer',
      entityType: 'Customer',
      searchEndpoint: '/customers/search',
      displayField: 'name',
      subtitleField: 'accountCode',
      icon: 'building',
      priority: 100,
    },
    {
      triggerWord: 'contact',
      entityType: 'Contact',
      searchEndpoint: '/contacts/search',
      displayField: 'fullName',
      subtitleField: 'email',
      scopeBy: 'customerId', // If message already mentions a customer, scope to their contacts
      icon: 'user',
      priority: 100,
    },
    {
      triggerWord: 'payment',
      entityType: 'CustomerPayment',
      searchEndpoint: '/ar/payments/search',
      displayField: 'reference',
      subtitleField: 'customerName',
      icon: 'credit-card',
      priority: 90,
    },
  ],
};
```

---

## Appendix: Tool Definition Seed Pattern

Each module registers its AI tools — both query tools (reads) and action tools (writes):

```typescript
// packages/ai-tools/src/modules/ar.ts
import { Tool } from '@nexa/ai-gateway';

export const arQueryTools: Tool[] = [
  {
    name: 'get_aging_report',
    description: 'Fetch AR aging report showing overdue invoices grouped by aging bucket',
    inputSchema: {
      type: 'object',
      properties: {
        asOfDate: { type: 'string', format: 'date', description: 'Report date (default: today)' },
        groupBy: { type: 'string', enum: ['aging_bucket', 'customer', 'salesperson'], default: 'aging_bucket' },
        includeChaseStatus: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'search_invoices',
    description: 'Search customer invoices by reference, customer name, amount, or status',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text' },
        status: { type: 'string', enum: ['DRAFT', 'POSTED', 'PAID', 'VOID'] },
        dueBefore: { type: 'string', format: 'date' },
        limit: { type: 'integer', default: 20, maximum: 50 },
      },
      required: ['query'],
    },
  },
];

export const arActionTools: Tool[] = [
  {
    name: 'create_invoice',
    description: 'Create a new customer invoice with line items',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', format: 'uuid' },
        invoiceDate: { type: 'string', format: 'date' },
        dueDate: { type: 'string', format: 'date' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              itemId: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number' },
            },
            required: ['itemId', 'quantity', 'unitPrice'],
          },
        },
      },
      required: ['customerId', 'lines'],
    },
  },
];
```

Tool handlers are registered in the module's Fastify plugin:

```typescript
// apps/api/src/modules/ar/ar.plugin.ts
export async function arPlugin(fastify: FastifyInstance) {
  const { queryExecutor, actionExecutor } = fastify.ai;

  // READ tools — no user approval needed
  queryExecutor.registerHandler('get_aging_report', arAgingQueryHandler);
  queryExecutor.registerHandler('search_invoices', arInvoiceSearchHandler);

  // WRITE tools — go through ActionPlanner → user confirmation
  actionExecutor.registerHandler('CREATE_INVOICE', createInvoiceHandler);
  actionExecutor.registerHandler('POST_INVOICE', postInvoiceHandler);
}
```

---

## Appendix: Report Configuration Schema (Planned for E25)

Based on analysis of the previous system's `db_reports` and `db_report_columns` tables, the following schema is planned:

### report_definitions
| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | PK |
| company_id | UUID | FK — tenant scoping |
| report_key | String | Unique identifier (e.g., 'AR_AGING') |
| report_name | String | Display name |
| report_type | Enum | FINANCIAL, OPERATIONAL, STATUTORY, CUSTOM |
| description | String? | What this report shows |
| source_query | Text | Base query or view key |
| permission_code | String | Required permission to access |
| is_active | Boolean | Soft delete |
| sort_order | Int | Display ordering |
| created_at, updated_at | DateTime | Audit |

### report_columns
| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | PK |
| report_id | UUID | FK → report_definitions |
| col_field | String | Database field/expression |
| col_name | String | Display header (i18n key) |
| col_type | Enum | STRING, NUMBER, DATE, CURRENCY, BOOLEAN |
| col_width | Int | Default width in pixels |
| display_order | Int | Column position |
| can_sort | Boolean | Sortable? |
| can_group | Boolean | Groupable? |
| can_show | Boolean | Visible by default? |
| apply_count | Boolean | Show count in group footer? |
| apply_sum | Boolean | Show sum in group footer? |
| apply_avg | Boolean | Show average in group footer? |
| filter_type | Enum? | DROPDOWN, AUTOCOMPLETE, DATE_RANGE, TEXT, NONE |
| filter_endpoint | String? | LOV fetch endpoint |
| group_header | String? | Custom header when grouped |
| format_pattern | String? | Number/date format pattern |

These tables will be fully implemented in E25 (Reporting Engine). The schema is documented here for planning purposes.

---

## Story Status Summary

| Story | Title | Status |
|-------|-------|--------|
| E5b.1 | Memory Storage & Retrieval API | backlog |
| E5b.2 | Skills Registry, Tool Framework & Dynamic Context Assembly | backlog |
| E5b.3 | Implicit Memory Learning & Pre-Compaction Flush | backlog |
| E5b.4 | Hybrid Search & Memory Intelligence | backlog |
| E5b.5 | Memory & Skills Management UI | backlog |
| E5b.6 | E7 Skill Pack Validation (Proof-of-Concept) | backlog |
| E5b.7 | Inline Entity Mentions & Chat Autocomplete | backlog |
