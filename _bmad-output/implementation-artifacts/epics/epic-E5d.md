# Epic E5d: AI Knowledge Evolution & Cross-Tenant Intelligence

**Tier:** 1 | **Dependencies:** E5 (AI Orchestration), E5b (Memory & Skills), E5c (Admin & Automations), E3b (Platform API) | **FRs:** FR4 (contextual AI), FR6 (AI-powered analytics) | **NFRs:** NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA), NFR50 (data privacy)

---

## Design Summary

E5d closes the **learning loop** that makes Nexa's AI genuinely intelligent over time rather than static. It operates at two distinct levels:

### Level 1: Per-Tenant Knowledge Evolution (Tenant DB)

The AI develops deep understanding of each specific business:

| Knowledge Type | Example | How It's Captured |
|---------------|---------|-------------------|
| **Business Terminology** | "In our company, 'VAT code 3' means reverse charge" | Admin uploads glossary, or AI learns from corrections |
| **Process Knowledge** | "Our PO approval workflow for >£5000 requires Finance Director" | Admin documents SOP, or AI observes patterns |
| **Industry Rules** | "We're construction — retention invoices hold 5% for 12 months" | Admin configures, or AI learns from repeated corrections |
| **Custom Field Meanings** | "Field 'Project Code' tracks allocation percentage for cost centres" | Admin labels field, or AI infers from usage |
| **Historical Patterns** | "Q4 is always 3x invoice volume, prepare for higher workload" | AI detects from data, admin confirms |
| **Correction History** | "AI suggested FIFO but user corrected to weighted average 4 times" | Automatic — every correction feeds back |

The AI uses **RAG (Retrieval-Augmented Generation)** to pull relevant knowledge articles when answering questions or making suggestions. Over time, corrections and feedback refine the knowledge base.

### Level 2: Cross-Tenant Intelligence (Platform DB)

Anonymised aggregate patterns across ALL tenants flow to the vendor:

| Intelligence Type | Example | Business Value |
|------------------|---------|----------------|
| **Feature Gap Detection** | "Top 5 AI queries that fail across tenants = unbuilt features" | Prioritise roadmap based on real demand |
| **Default Optimisation** | "72% of construction tenants create 'Retention Invoices' view → make it a default" | Reduce setup friction for new tenants |
| **Workflow Discovery** | "40% of tenants manually export aging report then email it → automate this" | Identify automation opportunities |
| **Correction Patterns** | "AI suggests FIFO but 60% of tenants use weighted average → adjust default" | Improve base AI for all tenants |
| **Industry Benchmarks** | "Tenants with automated AR follow-up have 23% faster payment collection" | Sell the value of AI features |
| **Skill Effectiveness** | "The 'create_invoice' skill has 92% success rate, but 'reconcile_bank' only 45%" | Improve underperforming skills |
| **Module Adoption** | "Only 12% of tenants use Manufacturing module → investigate UX barriers" | Improve product adoption |

**Privacy is paramount:** No tenant's actual data crosses boundaries. Only anonymised statistical patterns, counts, and aggregates are stored at the platform level. Tenants can opt-out of cross-tenant analytics entirely.

### Why This Matters for AI-First

Without E5d, the AI is frozen at deployment. It never gets smarter. Every tenant starts from zero. The vendor has no data-driven feedback loop for product decisions. With E5d:

- **Tenant AI improves daily** — corrections, knowledge uploads, and pattern detection compound
- **New tenants benefit from collective wisdom** — vendor-curated best practices pushed to all
- **Vendor builds the right features** — real usage data drives the roadmap, not guesswork
- **Industry-specific AI** — construction tenants get construction-tuned AI, retail gets retail-tuned AI

### Architecture: Two Databases, Two Loops

```
┌─────────────────────────────────────────────────────┐
│                   TENANT DATABASE                    │
│                                                      │
│  ai_knowledge_articles  ──→  RAG Pipeline  ──→ AI    │
│  ai_training_examples   ──→  Context       ──→ Co-Pilot
│  ai_correction_log      ──→  Improvement   ──→ Better│
│                                                      │
│  User corrects AI ──→ correction_log ──→ retrain     │
│  Admin uploads SOP ──→ knowledge_articles ──→ RAG    │
│  AI detects pattern ──→ knowledge_articles (auto)    │
└───────────────────────┬─────────────────────────────┘
                        │ anonymised aggregation
                        │ (no tenant data crosses)
                        ▼
┌─────────────────────────────────────────────────────┐
│                  PLATFORM DATABASE                   │
│                                                      │
│  tenant_ai_patterns      ──→ Feature Gap Detection   │
│  tenant_ai_corrections   ──→ Default Optimisation    │
│  platform_knowledge_base ──→ Push to All Tenants     │
│  ai_skill_effectiveness  ──→ Skill Improvement       │
│                                                      │
│  Vendor reviews insights ──→ Product roadmap         │
│  Vendor publishes knowledge ──→ All tenants benefit  │
└─────────────────────────────────────────────────────┘
```

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Knowledge Article** | A document (text, markdown, PDF) that teaches the AI about tenant-specific processes, terminology, or rules. Chunked and embedded for RAG retrieval |
| **Training Example** | A curated input/output pair: "When user asks X, the correct answer is Y." Used to guide AI behaviour for tenant-specific scenarios |
| **Correction Log** | Every time a user corrects the AI (edits a suggestion, says "no, actually..."), the correction is logged with the original response. These are training signals |
| **Knowledge Confidence Score** | Each knowledge article and training example has a confidence score based on: source (admin > AI-generated), age, usage frequency, contradiction count |
| **RAG Pipeline** | On each AI query, relevant knowledge articles are retrieved via vector search and injected into the context. Budget: ~1000 tokens from knowledge base |
| **Anonymised Pattern** | A statistical aggregate (no PII, no entity names, no amounts): "X% of tenants in industry Y create saved view with filter Z" |
| **Platform Knowledge** | Vendor-curated best practices, help articles, and default configurations pushed to tenants. Tenants can accept, modify, or reject |
| **Learning Signal** | Any data point that indicates the AI should change behaviour: corrections, low confidence scores, repeated failures, user feedback ratings |

### Database Tables

#### Tenant DB (Per-Tenant Knowledge)

| Table | Purpose |
|-------|---------|
| `ai_knowledge_articles` | Tenant-specific knowledge documents with category, content, embeddings, and confidence score |
| `ai_knowledge_chunks` | Chunked fragments of knowledge articles with individual embeddings for precise RAG retrieval |
| `ai_training_examples` | Curated input/output pairs that guide AI behaviour for tenant-specific scenarios |
| `ai_correction_log` | Immutable log of every user correction to AI responses, with original and corrected content |
| `ai_learning_signals` | Aggregated learning signals per skill/agent: success rate, correction rate, confidence distribution |

#### Platform DB (Cross-Tenant Intelligence)

| Table | Purpose |
|-------|---------|
| `tenant_ai_patterns` | Anonymised usage patterns per tenant (query categories, skill usage, workflow patterns) — no PII |
| `tenant_ai_corrections` | Anonymised correction patterns (what the AI gets wrong across tenants, grouped by category) |
| `platform_knowledge_base` | Vendor-curated knowledge articles pushed to tenants (best practices, help docs, default configs) |
| `ai_skill_effectiveness` | Cross-tenant skill performance metrics (success rate, correction rate, confidence by skill) |
| `platform_ai_insights` | Vendor-generated insights from aggregate data (feature gaps, workflow opportunities, adoption metrics) |

### Knowledge Injection Strategy

On each AI session, knowledge is injected alongside memories and skills:

```
Base system prompt (~500 tokens)
+ User memories via hybrid search (~2000 tokens) [E5b]
+ Active skill chain L0→L1→L2 (~1000 tokens) [E5b]
+ Relevant knowledge articles via RAG (~1000 tokens) [E5d — NEW]
+ User permissions summary (~200 tokens) [E2b]
+ Current screen context (~300 tokens) [E6]
= ~5000 tokens total context
```

The knowledge RAG retrieval is query-aware: if the user asks about "retention invoices", only construction/retention-related knowledge articles are injected — not the entire knowledge base.

### Correction Loop: How the AI Gets Smarter

```
1. User asks: "What VAT code should I use for this EU purchase?"
2. AI responds: "Use Standard Rate (20%)"
3. User corrects: "No, this is reverse charge — use VAT code 3"
4. System logs correction → ai_correction_log
5. After N corrections on same topic → auto-generate knowledge article:
   "For EU purchases, this tenant uses reverse charge (VAT code 3)"
6. Next time similar question → RAG retrieves this knowledge → AI answers correctly
7. Anonymised pattern sent to platform: "tenant in [industry] corrected EU VAT suggestion"
8. Platform detects: "60% of UK tenants correct EU VAT → adjust default AI behaviour"
9. Vendor publishes updated knowledge to all tenants
```

### Privacy & Data Isolation

| Rule | Implementation |
|------|---------------|
| **No tenant data crosses boundaries** | Anonymisation job strips all PII, entity names, amounts before platform aggregation |
| **Opt-out available** | `ai_knowledge_settings.shareAnonymisedPatterns` — tenant can disable cross-tenant sharing |
| **No model fine-tuning on tenant data** | Knowledge is injected via RAG at runtime, never used to fine-tune the base model |
| **Tenant owns their knowledge** | All knowledge articles are exportable and deletable. "Forget All Knowledge" available |
| **Platform knowledge is suggestions** | Vendor-pushed knowledge appears as "Suggested" — tenant admin must accept before it enters their knowledge base |
| **GDPR compliant** | All cross-tenant data is aggregated statistics only. No individual records leave the tenant DB |

---

## Story E5d.1: Knowledge Base Schema & RAG Pipeline

**User Story:** As a developer, I want a per-tenant knowledge base with document upload, chunking, embedding, and RAG retrieval so that the AI can answer questions using tenant-specific knowledge.

**Acceptance Criteria:**
1. GIVEN the Prisma schema WHEN migrations run THEN the 5 tenant tables (ai_knowledge_articles, ai_knowledge_chunks, ai_training_examples, ai_correction_log, ai_learning_signals) are created with proper indexes and vector columns. **Dependency:** Reuses the pgvector extension installed by E5b.S4 (`CREATE EXTENSION IF NOT EXISTS vector` is idempotent)
2. GIVEN a knowledge article upload (text/markdown/PDF) WHEN processed THEN the document is chunked (target: ~500 tokens per chunk), each chunk is embedded using E5b's shared `EmbeddingService` (via AI Gateway, batch-capable), and chunks are stored with their embeddings in `ai_knowledge_chunks`. **Dependency:** Reuses `EmbeddingService` from E5b.S4 — do NOT create a separate embedding service
3. GIVEN a user's AI query WHEN the RAG pipeline runs THEN it performs vector similarity search using E5b's shared `VectorSearchService`, retrieves the top-K most relevant chunks (K=5, configurable), and injects them into the AI context within a ~1000 token budget. **Dependency:** Reuses `VectorSearchService.similaritySearch()` from E5b.S4 — do NOT create a separate vector search implementation
4. GIVEN multiple knowledge sources (admin-uploaded, AI-generated, vendor-suggested) WHEN ranking for injection THEN confidence score weighting applies: admin-uploaded (1.0) > vendor-suggested+accepted (0.9) > AI-generated+confirmed (0.8) > AI-generated+unconfirmed (0.5)
5. GIVEN a knowledge article WHEN it is retrieved and used in an AI response THEN its `lastUsedAt` is updated and `usageCount` incremented (for effectiveness tracking)
6. GIVEN the `POST /ai/knowledge` endpoint WHEN called with a document THEN the document is stored, chunked, embedded, and indexed within 5 seconds for documents under 10 pages
7. GIVEN the `GET /ai/knowledge` endpoint WHEN called THEN only the current tenant's knowledge articles are returned, ordered by category and confidence score

**Key Tasks:**
- [x] Create Prisma models for 5 tenant-side tables with vector columns and GIN indexes
- [x] Create migration and seed script (default knowledge categories)
- [x] Implement document upload endpoint (text, markdown, PDF support)
- [x] Implement document chunking service (recursive text splitter, ~500 tokens per chunk, overlap 50 tokens)
- [x] Reuse `EmbeddingService` from E5b.S4 for chunk embedding generation (do NOT create separate)
- [x] Implement RAG retrieval service using E5b's `VectorSearchService.similaritySearch()` with confidence-weighted re-ranking (do NOT create separate vector search)
- [x] Implement knowledge injection into dynamic context assembly (integrate with E5b's context assembler)
- [x] Implement knowledge CRUD endpoints (POST, GET, PATCH, DELETE)
- [x] Implement knowledge article categories (BUSINESS_PROCESS, TERMINOLOGY, INDUSTRY_RULES, CUSTOM_FIELDS, HISTORICAL_PATTERN)
- [x] Add comprehensive test coverage

**FR/NFR:** FR4, FR6; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §4.2 AI Service Layer | AI Gateway, RAG pipeline, embedding models |
| API Contracts | §2.6 AI & Chat | New: knowledge CRUD + RAG endpoints |
| Data Models | §3.1 System Module | New: 5 knowledge tables |
| State Machines | N/A | N/A |
| Event Catalog | `AiKnowledgeArticleCreated`, `AiKnowledgeArticleUsed` | New events |
| Business Rules | N/A | N/A |
| UX Design Spec | N/A (backend only) | N/A |
| Project Context | §14 Skills Architecture, §16 Autonomous Workflows | Context assembly integration |

---

## Story E5d.2: Correction Loop & Training Examples

**User Story:** As a system, I want to capture every user correction to AI responses and use them to improve future AI behaviour, so that the AI gets measurably smarter over time for each tenant.

**Acceptance Criteria:**
1. GIVEN a user corrects an AI response (edits a suggestion, says "no, actually...", or gives negative feedback) WHEN the correction is processed THEN an immutable `ai_correction_log` record is created with: original AI response, user correction, conversation context, skill used, and correction category
2. GIVEN N corrections on the same topic (threshold: 3) WHEN the pattern is detected THEN the system auto-generates a draft knowledge article with category `AI_LEARNED` and confidence score 0.5 (unconfirmed)
3. GIVEN an auto-generated knowledge article WHEN an admin reviews it THEN they can: confirm (→ confidence 0.8), edit and confirm, or reject (→ delete)
4. GIVEN a training example `{ input: "What VAT for EU purchase?", output: "Use reverse charge VAT code 3" }` WHEN the AI encounters a similar query THEN the training example is injected as a few-shot example in the context
5. GIVEN the learning signals service WHEN it runs (daily cron) THEN it calculates per-skill metrics: success rate (no corrections / total), correction rate, average confidence, and stores in `ai_learning_signals`
6. GIVEN a skill with correction rate >30% WHEN detected THEN the system flags it for admin review and optionally auto-generates knowledge articles from the most common corrections
7. GIVEN the `GET /ai/corrections` endpoint WHEN called THEN it returns corrections grouped by category and skill, with frequency counts, enabling admins to see "what the AI gets wrong most"

**Key Tasks:**
- [x] Implement correction capture middleware (intercepts user corrections from chat, feedback, and edit actions)
- [x] Implement correction categorisation (auto-categorise: TERMINOLOGY, PROCESS, DATA, PREFERENCE, OTHER)
- [x] Implement pattern detection service (detect N corrections on same topic → draft knowledge article)
- [x] Implement training example CRUD endpoints and few-shot injection
- [x] Implement learning signals aggregation service (daily cron, per-skill metrics)
- [x] Implement correction review API (admin: list, group, confirm/reject auto-generated knowledge)
- [x] Implement high-correction-rate alert (threshold: 30% → flag skill for review)
- [x] Add comprehensive test coverage for correction loop scenarios

**FR/NFR:** FR4; NFR2

---

## Story E5d.3: Cross-Tenant Intelligence Pipeline (Platform)

**User Story:** As a platform vendor, I want anonymised aggregate intelligence from all tenants so that I can detect feature gaps, identify common workflows, and improve the base AI for all tenants.

**Acceptance Criteria:**
1. GIVEN the platform Prisma schema WHEN migrations run THEN the 5 platform tables (tenant_ai_patterns, tenant_ai_corrections, platform_knowledge_base, ai_skill_effectiveness, platform_ai_insights) are created
2. GIVEN a tenant with `shareAnonymisedPatterns = true` WHEN the daily aggregation job runs THEN anonymised patterns are extracted: query category distribution, skill usage counts, saved view creation patterns, automation usage, correction categories — with ALL PII stripped (no entity names, no amounts, no user names)
3. GIVEN anonymised correction patterns across tenants WHEN aggregated THEN the platform can identify: "X% of tenants in industry Y correct the AI on topic Z" — enabling default behaviour adjustments
4. GIVEN skill effectiveness data from all tenants WHEN aggregated THEN the platform shows per-skill metrics: average success rate, correction rate, confidence score, and usage count across all tenants
5. GIVEN the platform insights service WHEN it runs (weekly cron) THEN it generates insights: feature gap candidates (high-failure queries with no matching skill), workflow opportunities (repeated manual patterns), default optimisation candidates (>60% of tenants create the same configuration)
6. GIVEN a tenant with `shareAnonymisedPatterns = false` WHEN the aggregation job runs THEN that tenant's data is completely excluded — zero rows sent to platform
7. GIVEN the anonymisation process WHEN it runs THEN it is verified to contain NO: company names, customer/supplier names, invoice amounts, user names, email addresses, or any field that could identify a specific entity. Only statistical counts, percentages, and category labels are transmitted

**Key Tasks:**
- [x] Create Platform Prisma models for 5 tables
- [x] Create migration and seed script
- [x] Implement anonymisation service (strip all PII, verify with automated PII detection)
- [x] Implement daily aggregation job (tenant → platform, respecting opt-out)
- [x] Implement skill effectiveness aggregation (cross-tenant skill metrics)
- [x] Implement weekly insights generation service (feature gaps, workflow opportunities, default optimisation)
- [x] Implement pattern query API for Platform Admin Portal (with filters: industry, plan tier, tenant size)
- [x] Implement opt-out mechanism (tenant setting, verified data exclusion)
- [x] Add comprehensive test coverage including PII verification tests

**FR/NFR:** FR6; NFR50 (data privacy)

---

## Story E5d.4: Platform Knowledge Distribution

**User Story:** As a platform vendor, I want to curate and push best-practice knowledge articles, default configurations, and AI improvements to all tenants, so that every tenant benefits from collective intelligence.

**Acceptance Criteria:**
1. GIVEN the platform knowledge base WHEN a vendor admin publishes a knowledge article THEN it is marked as `PUBLISHED` and becomes available to all tenants (or filtered by industry/plan tier)
2. GIVEN a published platform knowledge article WHEN a tenant admin opens the Knowledge Management page THEN they see a "Suggested Knowledge" section with articles they haven't yet accepted/rejected
3. GIVEN a suggested knowledge article WHEN a tenant admin clicks "Accept" THEN a copy is created in the tenant's `ai_knowledge_articles` with source `PLATFORM_SUGGESTED`, confidence 0.9, and the platform article is marked as accepted for this tenant
4. GIVEN a suggested knowledge article WHEN a tenant admin clicks "Reject" THEN it is hidden for this tenant and not suggested again (unless the vendor publishes an updated version)
5. GIVEN a suggested knowledge article WHEN a tenant admin clicks "Edit & Accept" THEN they can modify the content before accepting — the tenant version diverges from the platform version
6. GIVEN skill effectiveness data showing a skill with <50% success rate across tenants WHEN the vendor improves the skill THEN the improved version is pushed as a "Skill Update" suggestion to all tenants
7. GIVEN a platform-published default configuration (e.g., "Recommended saved views for Construction tenants") WHEN a construction tenant signs up THEN these are pre-seeded as suggestions in their onboarding flow

**Key Tasks:**
- [ ] Implement platform knowledge article CRUD (vendor admin only)
- [ ] Implement knowledge distribution service (publish → available to tenants, with industry/tier filtering)
- [ ] Implement "Suggested Knowledge" section in tenant knowledge management
- [ ] Implement accept/reject/edit-and-accept flow with tenant-side copy creation
- [ ] Implement skill update distribution (vendor improves skill → push as suggestion)
- [ ] Implement default configuration suggestions for new tenant onboarding (by industry)
- [ ] Implement platform knowledge article versioning (updated article → re-suggest to tenants who accepted previous version)
- [ ] Add comprehensive test coverage

**FR/NFR:** FR4, FR6; NFR2

---

## Story E5d.5: Knowledge Management UI (Tenant)

**User Story:** As a tenant admin, I want to manage my company's AI knowledge base — upload documents, review corrections, manage training examples, and accept/reject platform suggestions — so that the AI accurately understands our business.

**Acceptance Criteria:**
1. GIVEN the Knowledge Management page WHEN navigated to THEN the admin sees tabs: Knowledge Articles, Training Examples, Corrections, Suggested (from vendor), and Settings
2. GIVEN the Knowledge Articles tab WHEN rendered THEN articles are grouped by category (Business Processes, Terminology, Industry Rules, Custom Fields, Historical Patterns) with badges showing source (Admin, AI-Generated, Platform) and confidence score
3. GIVEN the "Upload Document" action WHEN an admin uploads a PDF/markdown/text file THEN it is processed (chunked, embedded) and appears as a new knowledge article with source `ADMIN_UPLOADED` and confidence 1.0
4. GIVEN the "Create Article" action WHEN an admin writes a new article THEN it is stored with rich text content, assigned a category, and embedded for RAG
5. GIVEN the Corrections tab WHEN rendered THEN corrections are grouped by category and skill, showing: original AI response, user correction, frequency, and an "Create Knowledge Article" action that pre-fills from the correction
6. GIVEN the Training Examples tab WHEN rendered THEN examples show input/expected output pairs with a "Test" button that runs the AI with the example input and shows whether it matches the expected output
7. GIVEN the Suggested tab WHEN rendered THEN platform-suggested articles show with Accept/Reject/Edit&Accept actions and a preview of the content
8. GIVEN the Settings tab WHEN rendered THEN the admin can configure: enable/disable AI knowledge, enable/disable cross-tenant sharing (anonymised), knowledge categories to include, retention period for auto-generated articles
9. GIVEN the knowledge management page WHEN any action is taken THEN a stats panel shows: total articles, articles by source, RAG retrieval rate (% of AI queries that used knowledge), correction trend (improving/worsening)

**Key Tasks:**
- [ ] Build Knowledge Management page with tabbed layout (T7 Settings, Concept D styled)
- [ ] Build Knowledge Articles tab with category grouping, source badges, confidence indicators
- [ ] Build document upload flow (drag-drop, progress indicator, processing status)
- [ ] Build article editor (rich text with markdown support)
- [ ] Build Corrections tab with grouped view and "Create Article" action
- [ ] Build Training Examples tab with input/output editor and "Test" button
- [ ] Build Suggested tab with Accept/Reject/Edit&Accept flow
- [ ] Build Settings tab with knowledge and sharing configuration
- [ ] Build stats panel with retrieval rate and correction trend charts
- [ ] Wire all mutations to API endpoints with optimistic updates
- [ ] Ensure all components match Concept D visual design

**FR/NFR:** FR4; NFR27

---

## Story E5d.6: Platform Intelligence Dashboard (Vendor)

**User Story:** As a platform vendor, I want a dashboard showing cross-tenant AI intelligence — feature gaps, workflow opportunities, skill effectiveness, and correction patterns — so that I can make data-driven product decisions.

**Acceptance Criteria:**
1. GIVEN the Platform Admin Portal WHEN navigating to "AI Intelligence" THEN a dashboard shows: total tenants contributing data, total knowledge articles across tenants, total corrections logged, and overall AI success rate
2. GIVEN the Feature Gaps section WHEN rendered THEN it shows: top 10 AI queries that fail (no matching skill or low confidence), grouped by module, with tenant count and frequency — these are unbuilt features
3. GIVEN the Workflow Opportunities section WHEN rendered THEN it shows: repeated manual patterns detected across tenants (e.g., "40% of tenants export aging report then email it") — these are automation candidates
4. GIVEN the Default Optimisation section WHEN rendered THEN it shows: configurations that >60% of tenants create manually (e.g., "Overdue > 30 Days" saved view) — these should be system defaults
5. GIVEN the Skill Effectiveness section WHEN rendered THEN it shows a table of all skills with cross-tenant metrics: average success rate, correction rate, usage count, trend (improving/declining), filterable by module
6. GIVEN the Industry Breakdown section WHEN rendered THEN it shows patterns grouped by tenant industry (construction, retail, manufacturing, etc.) — enabling industry-specific AI tuning
7. GIVEN the Correction Patterns section WHEN rendered THEN it shows: most common AI mistakes across tenants, grouped by category, with the correction that tenants apply — these inform default behaviour changes
8. GIVEN the "Publish Knowledge" action WHEN the vendor creates a new platform knowledge article THEN they can target it by: all tenants, specific industries, specific plan tiers, or specific tenant list

**Key Tasks:**
- [ ] Build AI Intelligence page in Platform Admin Portal (T5 Dashboard)
- [ ] Build Feature Gaps visualization (table + bar chart by module)
- [ ] Build Workflow Opportunities section with detected patterns
- [ ] Build Default Optimisation section with "Make Default" action
- [ ] Build Skill Effectiveness table with trend indicators and module filters
- [ ] Build Industry Breakdown section with industry selector
- [ ] Build Correction Patterns section with grouped view
- [ ] Build "Publish Knowledge" workflow with targeting options
- [ ] Wire all queries to Platform API endpoints
- [ ] Ensure all components match Platform Admin design language

**FR/NFR:** FR6; NFR27

---

## AI Integration

### Tools Added (for the Tenant Co-Pilot)

| Tool | Parameters | Description |
|------|-----------|-------------|
| `search_knowledge` | `query: string` (required) | Search the tenant's knowledge base for relevant articles |
| `add_knowledge` | `content: string` (required), `category: string` (required), `title?: string` | Create a new knowledge article (admin only) |
| `explain_correction` | `correctionId: string` (required) | Explain why the AI was corrected and what it learned |
| `knowledge_stats` | — | Show knowledge base statistics (article count, retrieval rate, correction trend) |

> **Mandatory Parameter Gathering Rule (Project Context §19):** All tools defined above MUST have complete `inputSchema` with `required` arrays. The orchestrator validates required parameters before execution — if any are missing, it prompts the user. Tools with no required params (e.g., `knowledge_stats`) execute immediately. Every parameter MUST include a `description` so the AI can explain what it needs when prompting.

### Context Injected

On every AI session (in addition to E5b's memory and skills):
```
<tenant_knowledge>
## Relevant Knowledge for This Query
- [TERMINOLOGY] "VAT code 3" means reverse charge for EU purchases in this company
- [PROCESS] PO approval for >£5000 requires Finance Director sign-off (John Smith)
- [INDUSTRY] Construction sector: retention invoices hold 5% for 12 months

## Training Examples
- Q: "What VAT for EU purchase?" → A: "Use reverse charge — VAT code 3"
</tenant_knowledge>
```

### Example User Queries

| User Says | AI Action |
|-----------|-----------|
| "What does VAT code 3 mean in our company?" | `search_knowledge("VAT code 3")` → retrieve tenant terminology article |
| "How do we handle PO approvals for large orders?" | `search_knowledge("PO approval workflow")` → retrieve process knowledge |
| "Why did you suggest standard VAT? We use reverse charge" | Log correction → update knowledge → "I've learned that your company uses reverse charge for EU purchases" |
| "What has the AI learned about our business?" | `knowledge_stats()` → present article count, categories, recent learnings |

---

## Appendix: Proposed Prisma Models

### Tenant DB Models

```prisma
model AiKnowledgeArticle {
  id              String    @id @default(uuid())
  companyId       String    @map("company_id")
  title           String    @db.VarChar(500)
  content         String    @db.Text
  category        String    // BUSINESS_PROCESS, TERMINOLOGY, INDUSTRY_RULES, CUSTOM_FIELDS, HISTORICAL_PATTERN
  source          String    // ADMIN_UPLOADED, AI_GENERATED, PLATFORM_SUGGESTED, CORRECTION_DERIVED
  sourceRef       String?   @map("source_ref") // Platform article ID or correction log ID
  confidenceScore Decimal   @default(0.5) @map("confidence_score") @db.Decimal(3, 2)
  isConfirmed     Boolean   @default(false) @map("is_confirmed") // Admin has reviewed
  usageCount      Int       @default(0) @map("usage_count")
  lastUsedAt      DateTime? @map("last_used_at")
  isActive        Boolean   @default(true) @map("is_active")
  createdById     String    @map("created_by_id")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  company         CompanyProfile @relation(fields: [companyId], references: [id])
  createdBy       User           @relation(fields: [createdById], references: [id])
  chunks          AiKnowledgeChunk[]

  @@map("ai_knowledge_articles")
  @@index([companyId, category, isActive], map: "idx_knowledge_company_category")
  @@index([companyId, source], map: "idx_knowledge_source")
}

model AiKnowledgeChunk {
  id          String    @id @default(uuid())
  articleId   String    @map("article_id")
  chunkIndex  Int       @map("chunk_index")
  content     String    @db.Text
  tokenCount  Int       @map("token_count")
  // embedding vector(1536) — added via raw SQL migration (pgvector)
  createdAt   DateTime  @default(now()) @map("created_at")

  article     AiKnowledgeArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@map("ai_knowledge_chunks")
  @@unique([articleId, chunkIndex], map: "uq_knowledge_chunk_order")
}

model AiTrainingExample {
  id          String    @id @default(uuid())
  companyId   String    @map("company_id")
  skillKey    String?   @map("skill_key") // Which skill this example trains (optional)
  inputText   String    @map("input_text") @db.Text
  outputText  String    @map("output_text") @db.Text
  category    String    // Same categories as knowledge articles
  source      String    // ADMIN_CURATED, CORRECTION_DERIVED
  isActive    Boolean   @default(true) @map("is_active")
  createdById String    @map("created_by_id")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  company     CompanyProfile @relation(fields: [companyId], references: [id])
  createdBy   User           @relation(fields: [createdById], references: [id])

  @@map("ai_training_examples")
  @@index([companyId, skillKey, isActive], map: "idx_training_company_skill")
}

model AiCorrectionLog {
  id                String    @id @default(uuid())
  companyId         String    @map("company_id")
  userId            String    @map("user_id")
  conversationId    String?   @map("conversation_id")
  messageId         String?   @map("message_id")
  skillKey          String?   @map("skill_key")
  originalResponse  String    @map("original_response") @db.Text
  correctedResponse String    @map("corrected_response") @db.Text
  correctionType    String    @map("correction_type") // TERMINOLOGY, PROCESS, DATA, PREFERENCE, OTHER
  wasAutoResolved   Boolean   @default(false) @map("was_auto_resolved") // Did it generate a knowledge article?
  createdAt         DateTime  @default(now()) @map("created_at")

  company           CompanyProfile  @relation(fields: [companyId], references: [id])
  user              User            @relation(fields: [userId], references: [id])

  @@map("ai_correction_log")
  @@index([companyId, correctionType], map: "idx_corrections_company_type")
  @@index([companyId, skillKey], map: "idx_corrections_company_skill")
  @@index([createdAt], map: "idx_corrections_date")
}

model AiLearningSignal {
  id              String    @id @default(uuid())
  companyId       String    @map("company_id")
  skillKey        String    @map("skill_key")
  signalDate      DateTime  @map("signal_date") @db.Date
  totalQueries    Int       @default(0) @map("total_queries")
  successCount    Int       @default(0) @map("success_count")
  correctionCount Int       @default(0) @map("correction_count")
  avgConfidence   Decimal   @default(0) @map("avg_confidence") @db.Decimal(3, 2)
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  company         CompanyProfile @relation(fields: [companyId], references: [id])

  @@map("ai_learning_signals")
  @@unique([companyId, skillKey, signalDate], map: "uq_learning_signal")
}
```

### Platform DB Models

```prisma
model TenantAiPattern {
  id              String    @id @default(uuid())
  tenantId        String    @map("tenant_id")
  patternDate     DateTime  @map("pattern_date") @db.Date
  industry        String?   // Tenant's industry (anonymised attribute)
  planTier        String?   @map("plan_tier")
  queryCategories Json      @map("query_categories")  // { "ar": 45, "finance": 30, ... }
  skillUsage      Json      @map("skill_usage")       // { "create_invoice": 12, "apply_filter": 89, ... }
  viewPatterns    Json      @map("view_patterns")     // { "overdue_30_days": true, "this_month": true }
  automationUsage Json      @map("automation_usage")  // { "ar_followup": 5, ... }
  createdAt       DateTime  @default(now()) @map("created_at")

  tenant          Tenant    @relation(fields: [tenantId], references: [id])

  @@map("tenant_ai_patterns")
  @@unique([tenantId, patternDate], map: "uq_tenant_pattern_date")
  @@index([patternDate], map: "idx_patterns_date")
  @@index([industry], map: "idx_patterns_industry")
}

model TenantAiCorrection {
  id              String    @id @default(uuid())
  patternDate     DateTime  @map("pattern_date") @db.Date
  industry        String?
  correctionType  String    @map("correction_type") // TERMINOLOGY, PROCESS, DATA, PREFERENCE
  skillKey        String?   @map("skill_key")
  occurrenceCount Int       @map("occurrence_count")
  tenantCount     Int       @map("tenant_count") // How many distinct tenants
  commonCorrection String?  @map("common_correction") @db.Text // Anonymised most-common correction
  createdAt       DateTime  @default(now()) @map("created_at")

  @@map("tenant_ai_corrections")
  @@index([patternDate, correctionType], map: "idx_corrections_date_type")
  @@index([skillKey], map: "idx_corrections_skill")
}

model PlatformKnowledgeArticle {
  id              String    @id @default(uuid())
  title           String    @db.VarChar(500)
  content         String    @db.Text
  category        String    // BEST_PRACTICE, HELP, DEFAULT_CONFIG, SKILL_UPDATE
  targetIndustries String[] @map("target_industries") // Empty = all
  targetPlanTiers String[]  @map("target_plan_tiers") // Empty = all
  version         Int       @default(1)
  status          String    @default("DRAFT") // DRAFT, PUBLISHED, ARCHIVED
  publishedAt     DateTime? @map("published_at")
  createdById     String    @map("created_by_id")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@map("platform_knowledge_base")
  @@index([status, category], map: "idx_platform_knowledge_status")
}

model AiSkillEffectiveness {
  id              String    @id @default(uuid())
  skillKey        String    @map("skill_key")
  measureDate     DateTime  @map("measure_date") @db.Date
  tenantCount     Int       @map("tenant_count")
  totalQueries    Int       @map("total_queries")
  avgSuccessRate  Decimal   @map("avg_success_rate") @db.Decimal(5, 2)
  avgCorrectionRate Decimal @map("avg_correction_rate") @db.Decimal(5, 2)
  avgConfidence   Decimal   @map("avg_confidence") @db.Decimal(3, 2)
  trend           String?   // IMPROVING, STABLE, DECLINING
  createdAt       DateTime  @default(now()) @map("created_at")

  @@map("ai_skill_effectiveness")
  @@unique([skillKey, measureDate], map: "uq_skill_effectiveness")
  @@index([measureDate], map: "idx_effectiveness_date")
}

model PlatformAiInsight {
  id              String    @id @default(uuid())
  insightType     String    @map("insight_type") // FEATURE_GAP, WORKFLOW_OPPORTUNITY, DEFAULT_CANDIDATE, SKILL_IMPROVEMENT
  title           String    @db.VarChar(500)
  description     String    @db.Text
  evidence        Json      // Supporting data (counts, percentages, tenant counts)
  severity        String    // HIGH, MEDIUM, LOW
  status          String    @default("NEW") // NEW, REVIEWED, ACTIONED, DISMISSED
  reviewedById    String?   @map("reviewed_by_id")
  reviewedAt      DateTime? @map("reviewed_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@map("platform_ai_insights")
  @@index([insightType, status], map: "idx_insights_type_status")
  @@index([severity, status], map: "idx_insights_severity")
}
```

---

## Story Status Summary

| Story | Title | Status |
|-------|-------|--------|
| E5d.1 | Knowledge Base Schema & RAG Pipeline | done |
| E5d.2 | Correction Loop & Training Examples | done |
| E5d.3 | Cross-Tenant Intelligence Pipeline (Platform) | done |
| E5d.4 | Platform Knowledge Distribution | backlog |
| E5d.5 | Knowledge Management UI (Tenant) | backlog |
| E5d.6 | Platform Intelligence Dashboard (Vendor) | backlog |
