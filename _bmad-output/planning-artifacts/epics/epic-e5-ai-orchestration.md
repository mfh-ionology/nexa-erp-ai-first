# Epic E5: AI Orchestration

**Tier:** 1 | **Dependencies:** E3b (Platform API + AI Gateway), E4 (i18n) | **FRs:** FR1-FR10, FR153-FR156 | **NFRs:** NFR1 (AI <3s), NFR16 (AI never auto-executes), NFR21 (AI degradation safe), NFR47 (AI Gateway <100ms)

---

## Story E5.S1: AI Service Layer

**User Story:** As a developer, I want a structured AI service layer that integrates with Claude via the AI Gateway, manages prompt templates, and parses responses, so that all ERP modules can leverage AI capabilities through a consistent interface.

**Acceptance Criteria:**
1. GIVEN an AI request from any module WHEN the service layer processes it THEN the request is routed through the AI Gateway (`packages/ai-gateway`) which performs quota check, model selection, and usage recording
2. GIVEN a registered AI prompt template WHEN the AI service resolves it THEN parameters are populated from entity data, context cache, and user input before sending to the model
3. GIVEN the AI model returns a response WHEN the service layer parses it THEN structured data (proposed records, answers, action proposals) is extracted and typed
4. GIVEN streaming is enabled for a request WHEN the model generates tokens THEN they are forwarded to the client in real-time via WebSocket or SSE
5. GIVEN the AI Gateway is unreachable or returns an error WHEN an AI request is made THEN the system degrades gracefully — traditional UI remains fully functional, and a user-friendly error message is shown
6. GIVEN an AI request completes WHEN usage is recorded THEN the AI Gateway logs `TenantAiUsage` with model, tokens, cost estimate, and feature key

**Key Tasks:**
- [ ] Implement `AiOrchestrator` service in `api/src/ai/orchestrator.ts` (AC: #1)
  - [ ] Accept AI requests with intent, context, and user message
  - [ ] Route through AI Gateway for quota check and model invocation
  - [ ] Handle model routing via AiModel.routingTags: 'reasoning' for complex analysis, 'standard' for CRUD, 'cheap' for extraction. AI Gateway resolves best model per tags from AiModel registry.
- [ ] Implement `PromptManager` service in `api/src/ai/prompt-manager.ts` (AC: #2)
  - [ ] Load `AiPrompt` from database with active version
  - [ ] Resolve parameters: entity lookups, query results, context cache, user input, computed values
  - [ ] Compile system prompt and user message with Handlebars-style substitution
- [ ] Implement `ResponseParser` in `api/src/ai/response-formatter.ts` (AC: #3)
  - [ ] Parse structured output (JSON mode) for record creation proposals
  - [ ] Parse natural language responses for conversational answers
  - [ ] Extract confidence scores from AI output
- [ ] Implement streaming support in orchestrator (AC: #4)
  - [ ] Use AI Gateway streaming (provider-agnostic — gateway handles provider-specific streaming protocol)
  - [ ] Forward chunks to WebSocket handler
- [ ] Implement graceful degradation and error handling (AC: #5)
  - [ ] Circuit breaker pattern for AI Gateway calls
  - [ ] Fallback to traditional UI notification when AI unavailable
  - [ ] Emit `ai.degraded` event for monitoring
- [ ] Implement usage recording via AI Gateway (AC: #6)

**FR/NFR:** FR1, FR2, FR4, FR5, FR10; NFR1, NFR16, NFR21, NFR47

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §6 AI Infrastructure & Orchestration | 7 subsystems: Model Registry, Prompt Manager, Agent Registry, Orchestrator, Context Engine, Guardrails, Tool Executor |
| API Contracts | §2.6 AI & Chat, §3.6 AI Endpoints | WS /ai/chat, POST /ai/chat/message, POST /ai/suggestions |
| Data Models | N/A | AiModel, AiPrompt, AiPromptVersion, AiAgent (defined in Architecture §6.1-6.3) |
| State Machines | N/A | N/A — AI layer has no formal state machine |
| Event Catalog | §17 AI Orchestration Events | `ai.action.executed` event |
| Business Rules | §14 Implicit Rules | IMP-005: AI never auto-executes; IMP-006: AI degradation safe |
| UX Design Spec | §AI Interaction Model | "Told, Shown, Approve, Done" paradigm |
| Project Context | §8b Platform Layer Architecture | AI Gateway mandatory routing, quota check flow |

---

## Story E5.S2: AI Chat Session Management

**User Story:** As a user, I want to have multi-turn conversations with the AI assistant via WebSocket, with persistent chat history and session management, so that I can have contextual, ongoing interactions.

**Acceptance Criteria:**
1. GIVEN a user opens the Co-Pilot drawer WHEN a WebSocket connection is established THEN the connection authenticates via JWT and associates with the user's tenant and company context
2. GIVEN a user sends a message WHEN the AI processes it THEN the response streams back token-by-token with a typing indicator until complete
3. GIVEN an active conversation WHEN the user sends a follow-up message THEN the AI has full context of the previous messages in the session (multi-turn)
4. GIVEN a user creates a new chat session WHEN they click "+ New Chat" THEN a new `AiConversation` record is created and the AI starts fresh while retaining user/tenant awareness
5. GIVEN a user returns to the application WHEN they open the Co-Pilot drawer THEN their previous conversations are listed with auto-generated titles, most recent first
6. GIVEN an HTTP fallback is needed (WebSocket unavailable) WHEN the user sends a message via POST THEN the response is returned as a complete message (non-streaming)

**Key Tasks:**
- [ ] Implement WebSocket handler in `api/src/ai/websocket.handler.ts` (AC: #1, #2)
  - [ ] Socket.io connection with JWT authentication
  - [ ] Tenant/company context injection from auth token
  - [ ] Stream chunk forwarding from AI Gateway to client
- [ ] Implement `AiConversation` and `AiMessage` persistence (AC: #3, #4, #5)
  - [ ] CRUD for conversation sessions
  - [ ] Store messages with role (user/assistant), content, metadata
  - [ ] Auto-generate conversation titles from first user message
- [ ] Implement multi-turn context assembly (AC: #3)
  - [ ] Build message history array from conversation messages
  - [ ] Apply context window limits (trim old messages when approaching token limit)
  - [ ] Include current page context in system message
- [ ] Implement HTTP fallback endpoint `POST /ai/chat/message` (AC: #6)
- [ ] Implement `GET /ai/chat/history` and `POST /ai/chat/sessions` endpoints (AC: #4, #5)

**FR/NFR:** FR1, FR4, FR7; NFR1

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §6 AI Infrastructure, §5.4 Dual Interface Pattern | WebSocket handler, Co-Pilot Dock interaction model |
| API Contracts | §2.6 AI & Chat, §3.6 AI Endpoints | WS /ai/chat, GET /ai/chat/history, POST /ai/chat/sessions |
| Data Models | N/A | AiConversation, AiMessage (Architecture §6) |
| State Machines | N/A | N/A — no formal state machine |
| Event Catalog | §17 AI Orchestration Events | AI Context Engine subscribes to all business events |
| Business Rules | §13 Communications Rules | BR-COM-013: AI actions require user confirmation |
| UX Design Spec | §AI Interaction Model — Co-Pilot Dock | 380px drawer, chat history selector, streaming responses |
| Project Context | §8b Platform Layer Architecture | AI Gateway routing |

---

## Story E5.S3: AI Action Framework

**User Story:** As a user, I want the AI to propose actions (create invoice, send email, update record) that I can review and confirm or reject before execution, so that I maintain control over all AI-initiated changes.

**Acceptance Criteria:**
1. GIVEN the AI determines an action is needed (e.g., "create invoice for Acme") WHEN it formulates the action THEN it sends an `action_proposal` message with type, description, entity type, preview data, and confidence score
2. GIVEN the user receives an action proposal WHEN they click "Confirm" THEN the action executes through the standard API (same path as manual creation) and a `record_created` message is sent back
3. GIVEN the user receives an action proposal WHEN they click "Reject" THEN the action is cancelled, no data is modified, and the AI acknowledges the rejection
4. GIVEN a financial action (create invoice, post journal, process payment) WHEN the AI proposes it THEN user confirmation is ALWAYS required regardless of confidence score
5. GIVEN an action is executed via AI WHEN the audit trail records it THEN it includes `isAiAction: true`, `aiConfidence`, and the conversation ID

**Key Tasks:**
- [ ] Implement `ActionPlanner` in `api/src/ai/action-planner.ts` (AC: #1)
  - [ ] Parse AI structured output to identify proposed actions
  - [ ] Create action proposal objects with preview data
  - [ ] Calculate confidence scores per field
- [ ] Implement action confirmation/rejection WebSocket messages (AC: #2, #3)
  - [ ] Handle `action_confirm` client message type
  - [ ] Handle `action_reject` client message type
  - [ ] Execute confirmed actions via standard service layer (not bypassing validation)
- [ ] Implement guardrails in `api/src/ai/guardrails.ts` (AC: #4)
  - [ ] Define financial action types that always require confirmation
  - [ ] Block auto-execution for create/modify/delete operations
  - [ ] Log all guardrail enforcement decisions
- [ ] Integrate audit trail with AI metadata (AC: #5)
  - [ ] Extend audit service to accept `isAiAction`, `aiConfidence`, `conversationId`
  - [ ] Emit `ai.action.executed` event after successful execution

**FR/NFR:** FR6, FR8, FR9; NFR16

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §6 AI Infrastructure | Guardrails subsystem, Tool Executor |
| API Contracts | §3.6 AI Endpoints | `action_proposal`, `action_confirm`, `action_reject` message types |
| Data Models | N/A | AiAgent.guardrails JSON field |
| State Machines | N/A | N/A — actions follow entity-specific state machines |
| Event Catalog | §17 AI Orchestration Events | `ai.action.executed` |
| Business Rules | §14 Implicit Rules | IMP-005: AI never auto-executes financial transactions; BR-COM-013 |
| UX Design Spec | §Core User Experience | "Told, Shown, Approve, Done" — user always approves |
| Project Context | §8b Platform Layer Architecture | AI Gateway mandatory routing |

---

## Story E5.S4: AI Predictions

**User Story:** As a finance manager, I want AI-powered cash flow forecasting, anomaly detection, and duplicate detection with confidence scores, so that I can proactively manage financial risk.

**Acceptance Criteria:**
1. GIVEN a cash flow forecast request with date range WHEN the AI processes it THEN it returns period-by-period projections including opening balance, inflows, outflows, net flow, and closing balance with source breakdowns
2. GIVEN the forecast identifies a period with negative balance WHEN the result is returned THEN an alert of type `NEGATIVE_BALANCE` is included with the affected period and suggested action
3. GIVEN an anomaly detection request WHEN the AI analyses recent transactions THEN it flags suspicious patterns (duplicate payments, unusual amounts, timing anomalies) with confidence scores
4. GIVEN a duplicate detection request for an entity type WHEN the AI processes it THEN it returns potential duplicate pairs with similarity scores and field-by-field comparison
5. GIVEN any prediction result WHEN the confidence score is returned THEN it follows the standard thresholds: >=90% green/auto-suggest, 70-89% amber/review, <70% red/manual

**Key Tasks:**
- [ ] Implement `POST /ai/predict/cash-flow` endpoint (AC: #1, #2)
  - [ ] Gather AR (outstanding invoices), AP (outstanding bills), committed POs, recurring payments
  - [ ] Send financial context to AI for pattern analysis and projection
  - [ ] Parse structured forecast response with period breakdowns and alerts
- [ ] Implement `POST /ai/detect/anomalies` endpoint (AC: #3)
  - [ ] Collect recent transaction data (configurable lookback period)
  - [ ] Define anomaly patterns: duplicate amounts, unusual timing, round-number bias
  - [ ] Return flagged items with anomaly type and confidence
- [ ] Implement `POST /ai/detect/duplicates` endpoint (AC: #4)
  - [ ] Accept entity type parameter (Customer, Supplier, Contact)
  - [ ] Use AI for fuzzy matching on name, address, VAT number, bank details
  - [ ] Return duplicate pairs with per-field similarity scores
- [ ] Implement `GET /ai/confidence/:entityType/:entityId` endpoint (AC: #5)
  - [ ] Retrieve stored confidence scores for AI-created entities
- [ ] Implement `POST /ai/explain` endpoint for explainability (AC: #5)
  - [ ] Return human-readable explanation of AI reasoning for a given decision

**FR/NFR:** FR153, FR155, FR156; NFR1

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §6 AI Infrastructure | AI agents for forecasting, anomaly detection |
| API Contracts | §2.6 AI & Chat, §3.6 AI Endpoints | POST /ai/predict/cash-flow, POST /ai/detect/anomalies, POST /ai/detect/duplicates, GET /ai/confidence, POST /ai/explain |
| Data Models | N/A | No dedicated prediction models — results returned inline |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | §17 AI Orchestration Events | `ai.action.executed` for prediction requests |
| Business Rules | §14 Implicit Rules | IMP-005, IMP-006 |
| UX Design Spec | §Key Design Challenges | Confidence scoring: >=90% green, 70-89% amber, <70% red |
| Project Context | §8b Platform Layer Architecture | AI Gateway quota check before every AI call |

---

## Story E5.S5: Daily Briefing & Smart Suggestions

**User Story:** As a user, I want a personalised daily briefing based on my role and contextual smart suggestions when viewing records, so that I start each day informed and always have relevant next actions available.

**Acceptance Criteria:**
1. GIVEN a user with role "Finance Manager" WHEN they request the daily briefing THEN it includes: pending approvals, overdue invoices, cash position, upcoming payment runs, and anomaly alerts
2. GIVEN a user with role "Business Owner" WHEN they request the daily briefing THEN it includes: revenue vs prior period, overdue receivables, pending approvals across all modules, and AI-detected opportunities
3. GIVEN a briefing is generated WHEN each item is displayed THEN it includes actionable links (one-tap approve, chase, review) and period comparison data (delta/trend)
4. GIVEN a user is viewing a specific record (e.g., Customer Detail) WHEN AI suggestions are requested THEN contextual suggestions are returned (e.g., "Invoice this customer", "Show payment history", "Credit check")
5. GIVEN the briefing generation runs WHEN the scheduled job executes THEN it completes within the AI response time target and caches the result for the day

**Key Tasks:**
- [ ] Implement `GET /ai/briefing` endpoint (AC: #1, #2, #3)
  - [ ] Create `BriefingEngine` in `api/src/ai/briefing-engine.ts`
  - [ ] Define role-based briefing templates (Owner, Finance, Sales, HR, Warehouse, Admin)
  - [ ] Gather cross-module data: pending approvals, overdue items, cash position, stock alerts
  - [ ] Generate briefing via AI with structured output format
- [ ] Implement BullMQ scheduled job for daily briefing pre-generation (AC: #5)
  - [ ] Run at configurable time (default 06:00 UTC)
  - [ ] Cache briefing in Redis with 24h TTL
  - [ ] Refresh on-demand if stale
- [ ] Implement `POST /ai/suggestions` endpoint (AC: #4)
  - [ ] Accept current page context (entityType, entityId, pageRoute)
  - [ ] Return role-based and context-based suggestion chips
  - [ ] Include preset prompts from `AiAgent.triggerConfig`
- [ ] Create briefing response schema with actionable items (AC: #3)
  - [ ] Each item: title, description, metric (with delta), action buttons, entity link

**FR/NFR:** FR3, FR5; NFR1

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §6 AI Infrastructure | BriefingEngine, scheduled job, Redis cache |
| API Contracts | §2.6 AI & Chat | GET /ai/briefing, POST /ai/suggestions |
| Data Models | N/A | No dedicated briefing models — generated and cached |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | §17 AI Orchestration Events | AI Context Engine subscribes to all events for briefing data |
| Business Rules | §14 Implicit Rules | IMP-006: AI degradation must not break traditional UI |
| UX Design Spec | §User Journey Flows, Journey 1 | Morning Briefing flow, role-based content, one-tap actions |
| Project Context | §8b Platform Layer Architecture | AI Gateway routing for briefing generation |

---
