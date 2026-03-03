# Epic E5c: AI Administration & Autonomous Workflows

**Tier:** 1 | **Dependencies:** E5 (AI Orchestration), E5b (AI Co-Pilot Intelligence), E6 (Frontend Shell) | **FRs:** FR4 (contextual AI), FR5 (autonomous AI actions) | **NFRs:** NFR2 (CRUD <500ms), NFR27 (WCAG 2.1 AA), NFR44 (AI response <3s)

---

## Design Summary

E5c adds two critical missing layers to the AI-First ERP:

1. **Administration UI** — Full admin screens for configuring the entire AI infrastructure (models, prompts, agents, skills, variables). Without this, all AI configuration requires direct database access.

2. **Autonomous Workflows** — Goal-oriented agent automations that run on schedules or triggers, chain together, and produce results that feed into other automations. This transforms the AI from a reactive assistant into a **proactive operations engine**.

### Why Now (Not Later)

The AI infrastructure tables from E5 (10 models) and E5b (enhanced skills, memories) are **invisible** to admins without frontend screens. Every new module added (E7, E14, E17, etc.) seeds skills and prompts that need to be reviewed, tuned, and maintained. Without admin UI, this becomes a developer-only operation — defeating the purpose of a self-service AI-First ERP.

Autonomous workflows are planned now because:
- The automation schema needs to reference E5's AiAgent and E5b's AiSkill tables
- E5b's dynamic context assembly must be designed to support long-running agent sessions (not just chat)
- Business modules (E14+) will seed automations (e.g., "daily AR aging analysis") alongside their skill packs

### Core Concepts

| Concept | Description |
|---------|-------------|
| **AI Configuration Dashboard** | Central admin page showing all AI infrastructure: models, prompts, agents, skills, automations with health indicators |
| **Model Registry Management** | CRUD for LLM models with cost tracking, routing tag management, fallback chain configuration, and active/default toggles |
| **Prompt Template Editor** | Rich editor for system prompts and user templates with variable binding, version history, diff view, and live preview |
| **Prompt Variables** | Template variables (`{{customer.name}}`, `{{invoice.totalDue}}`) bound to database fields, page fields, or computed expressions. Resolved at execution time |
| **Agent Configuration** | CRUD for AI agents with model assignment, prompt selection, tool configuration, guardrail editing, and trigger setup |
| **Automation** | A named workflow with a goal, schedule (cron), trigger conditions, assigned agent, input/output configuration, and optional chaining to next automation |
| **Automation Steps** | Ordered steps within an automation: each step has an agent, goal, input source (previous step output, DB query, or static), and output destination |
| **Automation Runs** | Immutable execution history with per-step logs, token usage, duration, status, results, and error details |
| **Goal-Oriented Execution** | The agent receives a natural language goal + structured input data, works autonomously (multi-turn with tools), and produces structured output |

### Database Tables (New)

| Table | Purpose |
|-------|---------|
| `ai_automations` | Master automation definition with name, goal, schedule, trigger type, agent assignment |
| `ai_automation_steps` | Ordered steps within an automation (agent, goal, input/output config) |
| `ai_automation_runs` | Execution history — one row per automation execution |
| `ai_automation_step_runs` | Per-step execution log within a run (status, result, tokens, duration) |
| `ai_prompt_variables` | Variable definitions for prompt templates — binds `{{varName}}` to DB fields, page fields, or expressions |
| `ai_automation_schedules` | Cron schedule definitions with timezone, next run time, pause/resume |

### Automation Architecture

#### Trigger Types

| Type | When It Fires | Example |
|------|--------------|---------|
| `SCHEDULED` | Cron schedule (daily, weekly, etc.) | "Every Monday 7am: Analyse AR aging" |
| `EVENT` | In response to a system event | "When invoice becomes 30 days overdue: Draft follow-up email" |
| `CHAIN` | After a previous automation completes | "After AR aging analysis: Summarise and flag high-risk accounts" |
| `MANUAL` | User clicks "Run Now" in admin UI | Ad-hoc execution for testing or one-off tasks |

#### Execution Flow

```
Trigger fires
  → Load automation definition + steps
  → For each step (ordered):
      1. Resolve input variables (from DB, previous step, or static)
      2. Build agent context (goal + input + user memories if applicable)
      3. Execute agent autonomously (multi-turn, up to maxTurns)
      4. Capture structured output
      5. Store step run record (append-only)
      6. Feed output to next step's input (if chained)
  → Store automation run record
  → If chain_next_id: trigger next automation
  → If notification_config: notify relevant users of results
```

#### Example: Daily AR Follow-Up Automation

```
Automation: "Daily AR Follow-Up"
Schedule: Every weekday at 7:00 AM
Steps:
  1. Agent: AR Analyst
     Goal: "Find all invoices overdue >30 days. For each, assess risk level based on customer payment history."
     Input: { dateThreshold: "{{today - 30 days}}" }
     Output: { flaggedInvoices: [...], riskAssessments: [...] }

  2. Agent: Communication Drafter
     Goal: "For each flagged invoice, draft a personalised follow-up email using the customer's preferred tone."
     Input: {{ previousStep.output }}
     Output: { emailDrafts: [...] }

  3. Agent: Summary Writer
     Goal: "Summarise today's AR follow-up activity. Flag any accounts that have been overdue >60 days across multiple invoices."
     Input: {{ step1.output, step2.output }}
     Output: { summary: "...", highRiskAccounts: [...] }

Chain → Notify: Send summary to AR Manager via in-app notification
```

### Prompt Variable System

Variables in prompt templates are bound to data sources and resolved at execution time:

| Variable Source | Example | Resolution |
|----------------|---------|------------|
| `DB_FIELD` | `{{customer.name}}` | Query: `SELECT name FROM customers WHERE id = :entityId` |
| `DB_QUERY` | `{{overdueCount}}` | Query: `SELECT COUNT(*) FROM invoices WHERE due_date < NOW() AND status = 'POSTED'` |
| `PAGE_FIELD` | `{{currentPage.selectedCustomerId}}` | From frontend state (for chat-context prompts) |
| `PREVIOUS_STEP` | `{{step1.output.flaggedInvoices}}` | From automation step output JSON |
| `SYSTEM` | `{{today}}`, `{{currentUser.name}}`, `{{company.name}}` | Built-in system variables |
| `CONSTANT` | `{{reminderTone}}` = "professional but firm" | Static value set in automation config |
| `EXPRESSION` | `{{today - 30 days}}` | Evaluated expression |

### Admin UI Pages

| Page | Template | Description |
|------|----------|-------------|
| AI Configuration Dashboard | T5 Dashboard | Overview: model count, active agents, skill count, automation status, daily token usage chart |
| Model Registry | T1 Entity List + T3 Detail | CRUD for AI models with cost/token fields, routing tags, fallback chain |
| Prompt Templates | T1 List + T4 Editor | Template editor with syntax highlighting, variable autocomplete, version history, diff view, live preview |
| Agent Configuration | T1 List + T3 Detail | Agent CRUD: model selection, prompt assignment, tool picker, guardrail editor, trigger config |
| Skill Pack Manager | T1 List + T3 Detail | View/edit skills grouped by module, trigger phrase testing, activation toggles |
| Automation Builder | T1 List + T4 Editor | Visual step builder, schedule config, variable binding, agent assignment per step |
| Automation Runs | T1 List + T2 Detail | Run history with status, duration, token usage, per-step drill-down, error details |

---

## Story E5c.S1: Automation Engine & Schema

**User Story:** As a developer, I want an automation execution engine with database schema so that AI agents can run goal-oriented workflows on schedules, respond to events, and chain together.

**Acceptance Criteria:**
1. GIVEN the Prisma schema WHEN migrations run THEN the 6 tables (ai_automations, ai_automation_steps, ai_automation_runs, ai_automation_step_runs, ai_prompt_variables, ai_automation_schedules) are created with proper indexes and foreign keys
2. GIVEN an automation with trigger type `SCHEDULED` and cron `0 7 * * 1-5` WHEN the scheduler runs THEN the automation executes at 7:00 AM Monday-Friday in the configured timezone
3. GIVEN an automation with trigger type `EVENT` and event `InvoiceOverdue` WHEN the event fires THEN the automation is triggered with the event payload as input
4. GIVEN an automation with multiple ordered steps WHEN it executes THEN each step runs sequentially, with the output of step N available as input to step N+1
5. GIVEN an automation step with an assigned agent WHEN the step executes THEN the agent runs autonomously (multi-turn with tools, up to maxTurns) and produces structured output
6. GIVEN an automation with `chainNextId` WHEN it completes successfully THEN the chained automation is triggered with the output of the current automation as input
7. GIVEN an automation with `chainNextId` WHEN saving via API THEN the system validates that no circular chain exists (e.g., A→B→C→A). Traverses the chain graph and rejects with a 422 validation error if a cycle is detected. Maximum chain depth: 10
8. GIVEN an automation run WHEN it completes (success or failure) THEN an immutable `ai_automation_runs` record is created with status, duration, total tokens used, and result/error
9. GIVEN an automation step run WHEN it completes THEN an immutable `ai_automation_step_runs` record is created with step-level metrics (tokens, latency, model used, result)
10. GIVEN a prompt variable with source `DB_FIELD` WHEN resolved THEN the variable value is fetched from the specified database table and field, scoped by companyId
11. GIVEN the automation's context assembly WHEN an agent step executes THEN it uses E5b's dynamic context assembler in AUTONOMOUS mode (module knowledge + skill instructions + step input — no user memories or screen context)
12. GIVEN a tool call (query or action) with required parameters defined in its `inputSchema` WHEN the AI proposes calling that tool AND any required parameter is missing THEN the orchestrator MUST NOT execute the tool — instead it returns a clarification request to the user listing all missing required fields with their descriptions (see Project Context §19)
13. GIVEN a tool call where all required parameters are present AND some optional parameters are omitted THEN the orchestrator executes the tool normally — optional parameters use service-layer defaults
14. GIVEN a tool with nested required parameters (e.g., `conditions[].operator`, `lines[].quantity`) WHEN the AI proposes a call with array items missing nested required fields THEN the orchestrator blocks execution and requests the missing nested fields
15. GIVEN an automation step (AUTONOMOUS mode) where a required tool parameter cannot be resolved from the variable binding system THEN the step FAILS with status `FAILED` and error `UNRESOLVABLE_REQUIRED_PARAM: {paramName}` — the step must never proceed with partial data
16. GIVEN multiple required parameters are missing from a proposed tool call WHEN the orchestrator prompts the user THEN it asks for ALL missing values in a single prompt (batch gathering), not one at a time

**Key Tasks:**
- [ ] Create Prisma models for all 6 tables with proper relations and indexes
- [ ] Create migration and seed script (system variables, example automation)
- [ ] Implement automation scheduler service (cron-based, timezone-aware)
- [ ] Implement event-triggered automation service (listens to event bus)
- [ ] Implement step execution engine (sequential, with input/output piping)
- [ ] Implement goal-oriented agent executor (multi-turn autonomous execution)
- [ ] Implement automation chaining (trigger next automation on completion)
- [ ] Implement circular chain detection (graph traversal, max depth 10, reject cycles)
- [ ] Implement prompt variable resolver (DB_FIELD, DB_QUERY, SYSTEM, PREVIOUS_STEP, CONSTANT, EXPRESSION)
- [ ] Implement automation CRUD API endpoints
- [ ] Implement automation run/step-run query endpoints (with pagination, filtering)
- [ ] Add circuit breaker: if automation fails 3 consecutive times, auto-pause and notify admin
- [ ] Implement mandatory parameter validation in orchestrator: validate all `required` fields (top-level and nested) from tool `inputSchema` BEFORE executing any tool call
- [ ] Implement clarification prompt generation: when required params are missing, build a user-facing prompt listing all missing fields with descriptions (batch — not one-at-a-time)
- [ ] Implement nested schema validation: traverse array item schemas to check nested `required` fields (e.g., `lines[].quantity`, `conditions[].operator`)
- [ ] Implement AUTONOMOUS mode param failure: when variable binding cannot resolve a required param, fail step with `UNRESOLVABLE_REQUIRED_PARAM` error
- [ ] Add comprehensive test coverage

**FR/NFR:** FR4, FR5; NFR2, NFR44

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §4.2 AI Service Layer | AI Gateway, agent execution, tool framework |
| API Contracts | §2.6 AI & Chat | New: automation CRUD + run endpoints |
| Data Models | §3.1 System Module | New: 6 automation tables |
| State Machines | N/A | Automation run states: PENDING → RUNNING → COMPLETED / FAILED / CANCELLED |
| Event Catalog | `AiAutomationTriggered`, `AiAutomationCompleted`, `AiAutomationFailed` | New events |
| Business Rules | BR-AI-01: Automation token budget per run | New rule |
| UX Design Spec | N/A (backend only) | N/A |
| Project Context | §12 AI-First Integration, §14 Skills Architecture | Agent execution, skill activation |

---

## Story E5c.S2: Prompt Variable Binding System

**User Story:** As an admin, I want to define variables in prompt templates that are automatically resolved from database fields, page state, or computed expressions, so that prompts are dynamic and context-rich without hardcoding.

**Acceptance Criteria:**
1. GIVEN a prompt template with `{{customer.name}}` WHEN the prompt is rendered for an AI session with a customer entity context THEN the variable is replaced with the actual customer name from the database
2. GIVEN a variable with source `DB_QUERY` and query `SELECT COUNT(*) FROM customer_invoices WHERE status = 'OVERDUE' AND company_id = :companyId` WHEN resolved THEN the count is injected into the prompt
3. GIVEN a variable with source `PAGE_FIELD` and field `currentPage.selectedFilters` WHEN resolved in a chat session THEN the current page's filter state is injected (enables "what am I looking at?" queries)
4. GIVEN a variable with source `SYSTEM` WHEN resolved THEN system variables (`{{today}}`, `{{currentUser.name}}`, `{{currentUser.role}}`, `{{company.name}}`, `{{company.baseCurrency}}`) are injected from the session context
5. GIVEN a variable with source `EXPRESSION` and value `{{today - 30 days}}` WHEN resolved THEN the expression is evaluated and the result injected
6. GIVEN a prompt template editor WHEN an admin types `{{` THEN an autocomplete dropdown shows all available variables grouped by source type (System, DB Fields, Page Fields, Custom)
7. GIVEN a prompt with unresolvable variables WHEN rendered THEN the system logs a warning, replaces with a safe fallback (`[unknown: varName]`), and does NOT crash the AI session

**Key Tasks:**
- [ ] Implement variable parser (extract `{{varName}}` from template text)
- [ ] Implement variable resolver with pluggable source handlers (DB_FIELD, DB_QUERY, PAGE_FIELD, SYSTEM, PREVIOUS_STEP, CONSTANT, EXPRESSION)
- [ ] Implement DB field resolver with companyId scoping and relation traversal (e.g., `customer.primaryContact.email`)
- [ ] Implement expression evaluator (date arithmetic, string operations, basic math)
- [ ] Implement system variable provider (today, currentUser, company, etc.)
- [ ] Implement variable registry API (GET /ai/variables — list all available variables with types and descriptions)
- [ ] Implement graceful fallback for unresolvable variables
- [ ] Add comprehensive test coverage for each variable source type

**FR/NFR:** FR4; NFR2

---

## Story E5c.S3: AI Model & Prompt Admin UI

**User Story:** As an admin, I want to view and manage AI models, prompt templates, and prompt versions through a web interface, so that I can configure the AI infrastructure without database access.

**Acceptance Criteria:**
1. GIVEN the AI Configuration Dashboard WHEN an admin navigates to it THEN they see cards for: Active Models (count + cost this month), Active Agents (count), Active Skills (count by module), Automations (active/paused), and a daily token usage chart
2. GIVEN the Model Registry page WHEN rendered THEN it shows a T1 Entity List of all AI models with columns: name, provider, model ID, max tokens, cost/M input, cost/M output, routing tags, active status, default flag
3. GIVEN the Model Registry WHEN an admin clicks "Add Model" THEN a form allows entry of all model fields including cost, token limits, routing tags (multi-select), capabilities (JSON editor), and fallback model selection (dropdown of other models)
4. GIVEN the Prompt Templates page WHEN rendered THEN it shows a T1 Entity List of all prompts grouped by category, with columns: name, category, active version, created by, last updated
5. GIVEN a prompt template WHEN an admin clicks to edit THEN a T4 Editor opens with: (a) syntax-highlighted system prompt editor with variable autocomplete on `{{`, (b) user template editor, (c) parameters JSON schema editor, (d) version history sidebar with diff view between versions, (e) "Test Prompt" button that runs the prompt with sample variables and shows the rendered output
6. GIVEN the prompt editor WHEN an admin saves changes THEN a new AiPromptVersion is created (append-only), the prompt's activeVersion is updated, and a changeReason is required
7. GIVEN the prompt editor's version history WHEN an admin clicks a previous version THEN they see the diff between that version and the current active version, with an option to "Restore This Version" (which creates a new version copying the old content)

**Key Tasks:**
- [ ] Build AI Configuration Dashboard page (T5 Dashboard, Concept D styled)
- [ ] Build Model Registry list page (T1 Entity List) with CRUD actions
- [ ] Build Model detail/edit form (T3 Detail Form) with all fields including JSON editor for capabilities
- [ ] Build Prompt Templates list page (T1 Entity List) grouped by category
- [ ] Build Prompt Template editor (T4 Editor) with syntax highlighting (CodeMirror or Monaco)
- [ ] Implement variable autocomplete in prompt editor (triggered on `{{`)
- [ ] Build version history sidebar with diff view (use diff library)
- [ ] Build "Test Prompt" preview (resolve variables with sample data, show rendered output)
- [ ] Wire all CRUD operations to API endpoints with optimistic updates
- [ ] Ensure all components match Concept D visual design

**FR/NFR:** FR4; NFR27

---

## Story E5c.S4: Agent & Skill Admin UI

**User Story:** As an admin, I want to configure AI agents (model, prompt, tools, guardrails) and manage skill packs (view, edit, test trigger phrases) through a web interface, so that I can tune the AI behaviour for my organisation.

**Acceptance Criteria:**
1. GIVEN the Agent Configuration page WHEN rendered THEN it shows a T1 Entity List of all agents with columns: name, display name, assigned model, assigned prompt, tool count, max turns, active status
2. GIVEN an agent WHEN an admin clicks to edit THEN a T3 Detail Form opens with: (a) model selection dropdown (from AiModel registry), (b) prompt selection dropdown (from AiPrompt registry) with preview, (c) tools configuration (JSON editor with schema validation), (d) guardrails configuration (JSON editor), (e) trigger configuration (JSON editor), (f) routing tags (multi-select), (g) max turns slider
3. GIVEN the Skill Pack Manager page WHEN rendered THEN it shows skills grouped by module (accordion sections), each skill showing: name, description, trigger phrases as tags, negative triggers as red tags, orchestration pattern badge, active toggle
4. GIVEN a skill WHEN an admin clicks to edit THEN a T3 Detail Form opens with: (a) all skill fields editable, (b) trigger phrase editor (tag input with add/remove), (c) negative trigger editor (tag input), (d) "Test Trigger" panel where admin types a phrase and sees which skill would be matched and at what confidence score
5. GIVEN the "Test Trigger" panel WHEN an admin types "show me overdue invoices" THEN the system runs the L0→L1→L2 routing chain and shows: matched module, matched skill, confidence score, and what tool calls would be generated
6. GIVEN skill activation toggles WHEN an admin toggles a skill off THEN it is excluded from the L1 module pack and never activated by the AI (soft disable, not delete)

**Key Tasks:**
- [ ] Build Agent Configuration list page (T1 Entity List) with CRUD actions
- [ ] Build Agent detail/edit form (T3 Detail Form) with model/prompt dropdowns, JSON editors for tools/guardrails
- [ ] Build Skill Pack Manager page with module-grouped accordion layout
- [ ] Build Skill detail/edit form (T3 Detail Form) with tag input for trigger/negative triggers
- [ ] Build "Test Trigger" panel with L0→L1→L2 simulation and confidence score display
- [ ] Wire all CRUD operations to API endpoints with optimistic updates
- [ ] Ensure all components match Concept D visual design

**FR/NFR:** FR4; NFR27

---

## Story E5c.S5: Automation Builder UI

**User Story:** As an admin, I want to create and configure AI automations (scheduled workflows with chained agent steps) through a visual builder, so that I can set up autonomous AI workflows without coding.

**Acceptance Criteria:**
1. GIVEN the Automation Builder list page WHEN rendered THEN it shows all automations with columns: name, trigger type badge, schedule (cron in human-readable form), step count, last run status, last run time, active toggle
2. GIVEN the "Create Automation" action WHEN clicked THEN a T4 Editor opens with: (a) name and description, (b) trigger type selection (Scheduled, Event, Manual), (c) schedule configuration (cron builder with human-readable preview, timezone selector) for scheduled type, (d) event type selection for event type
3. GIVEN the automation editor's step builder WHEN rendered THEN it shows an ordered list of steps, each with: step number, agent selection dropdown, goal text area, input configuration (source selector + field mapping), output configuration (what to capture from the agent's response)
4. GIVEN the step builder WHEN an admin clicks "Add Step" THEN a new step is added at the end with configurable agent, goal, and I/O. Steps can be drag-reordered
5. GIVEN the variable binding panel within a step WHEN an admin clicks on the goal text area THEN they can insert variables (`{{step1.output.flaggedInvoices}}`, `{{today}}`, `{{company.name}}`) via the same autocomplete used in prompts
6. GIVEN the automation editor's chain configuration WHEN an admin toggles "Chain to next automation" THEN a dropdown shows other automations to chain to, with the current automation's output mapped as the next automation's input
7. GIVEN the automation editor's notification configuration WHEN an admin toggles "Notify on completion" THEN they can select notification recipients (users or roles) and choose channels (in-app, email)
8. GIVEN the "Run Now" button WHEN clicked THEN the automation executes immediately in the background with a progress indicator, and the admin can watch step-by-step execution in real-time

**Key Tasks:**
- [ ] Build Automation list page (T1 Entity List) with status badges and active toggles
- [ ] Build Automation editor (T4 Editor) with trigger type configuration
- [ ] Build cron schedule builder with human-readable preview and timezone selector
- [ ] Build step builder with drag-reorder (dnd-kit), agent selection, goal editor, I/O configuration
- [ ] Build variable binding panel with autocomplete for step outputs and system variables
- [ ] Build chain configuration panel
- [ ] Build notification configuration panel
- [ ] Build "Run Now" with real-time step progress via WebSocket
- [ ] Wire all CRUD operations to API endpoints
- [ ] Ensure all components match Concept D visual design

**FR/NFR:** FR4, FR5; NFR27

---

## Story E5c.S6: Automation Monitoring & Run History

**User Story:** As an admin, I want to view automation execution history with per-step details, monitor active runs, and handle failures, so that I can ensure automations are running correctly and troubleshoot issues.

**Acceptance Criteria:**
1. GIVEN the Automation Runs page WHEN rendered THEN it shows a T1 Entity List of all runs across all automations with columns: automation name, trigger type, started at, duration, status (PENDING/RUNNING/COMPLETED/FAILED/CANCELLED), total tokens, total cost, step count
2. GIVEN a specific run WHEN an admin clicks to view THEN a T2 Detail page opens showing: (a) overall run summary (status, duration, total tokens, cost), (b) step-by-step timeline with status indicators (green/red/spinner), (c) per-step expandable details (agent used, goal, input, output, tokens, latency, model used)
3. GIVEN a failed run step WHEN expanded THEN the admin sees: error message, stack trace (if available), the agent's last message before failure, and retry/skip actions
4. GIVEN a failed automation WHEN the admin clicks "Retry from Failed Step" THEN the automation re-executes starting from the failed step with the same input, creating a new run record linked to the original
5. GIVEN the AI Configuration Dashboard WHEN rendered THEN it includes an "Automation Health" section showing: automations by status (pie chart), failed runs in last 24h (alert count), upcoming scheduled runs (next 6h timeline), and total automation token spend (line chart by day)
6. GIVEN an automation that has failed 3 consecutive times WHEN the circuit breaker triggers THEN the automation is auto-paused, a notification is sent to admins, and the dashboard shows a warning badge
7. GIVEN the run history WHEN filtered by date range and status THEN results are paginated (50 per page) and load within 500ms

**Key Tasks:**
- [ ] Build Automation Runs list page (T1 Entity List) with status badges and filters
- [ ] Build Run detail page (T2 Detail) with step timeline and expandable step details
- [ ] Build failed step detail view with error info and retry/skip actions
- [ ] Implement "Retry from Failed Step" endpoint and UI action
- [ ] Build Automation Health section for the AI Configuration Dashboard
- [ ] Implement circuit breaker logic (3 consecutive failures → auto-pause + notify)
- [ ] Implement run history query with pagination, date/status filters
- [ ] Wire all queries to API endpoints with efficient pagination
- [ ] Ensure all components match Concept D visual design

**FR/NFR:** FR4, FR5; NFR2, NFR27

---

## AI Integration

### Tools Added (for the Co-Pilot itself)

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_automations` | `status?: string` | List configured automations with their status and last run info |
| `run_automation` | `automationId: string` (required), `input?: Json` | Manually trigger an automation (with optional input override) |
| `get_automation_results` | `automationId: string` (required), `runId?: string` | Get the latest (or specific) automation run results |
| `explain_prompt` | `promptName: string` (required), `sampleInput?: Json` | Render a prompt template with sample variables and explain what it does |

> **Mandatory Parameter Gathering Rule (Project Context §19):** All tools MUST have complete `inputSchema` with `required` arrays. The orchestrator validates required parameters before execution — if any are missing, it prompts the user rather than guessing or defaulting. Every parameter MUST include a `description` so the AI can explain what it needs when prompting. This is a cross-cutting rule that applies to ALL tools in ALL epics.

### Context Injected

On every admin AI session:
```
<ai_infrastructure>
## Available Models
- claude-opus-4-6 (Anthropic) — default, reasoning
- claude-sonnet-4-6 (Anthropic) — standard
- claude-haiku-4-5 (Anthropic) — cheap, fast

## Active Automations
- Daily AR Follow-Up (scheduled: weekdays 7am, last run: success)
- Weekly PO Review (scheduled: Monday 9am, last run: 2 days ago, success)

## Recent Automation Issues
- None
</ai_infrastructure>
```

### Example User Queries

| User Says | AI Action |
|-----------|-----------|
| "Set up a daily automation to check for overdue invoices" | Guide admin through creating automation with AR agent + schedule |
| "What automations are running?" | `list_automations()` → present status list |
| "The AR follow-up automation failed, what happened?" | `get_automation_results(automationId: 'ar-followup')` → show error details |
| "Run the PO review automation now" | `run_automation(automationId: 'po-review')` with confirmation |
| "What does the invoice reminder prompt do?" | `explain_prompt('invoice-reminder', sampleInput)` → show rendered template |

---

## Appendix: Proposed Prisma Models

### ai_automations

```prisma
model AiAutomation {
  id                String              @id @default(uuid())
  companyId         String              @map("company_id")
  name              String              @db.VarChar(255)
  description       String?             @db.Text
  triggerType       String              @map("trigger_type") // SCHEDULED, EVENT, CHAIN, MANUAL
  eventType         String?             @map("event_type")   // Event name for EVENT trigger
  chainFromId       String?             @map("chain_from_id") // FK — triggered after this automation completes
  chainNextId       String?             @map("chain_next_id") // FK — trigger this automation on completion
  notificationConfig Json?              @map("notification_config") // Who to notify on completion
  maxTokenBudget    Int                 @default(50000) @map("max_token_budget") // Per-run token limit
  maxDurationMs     Int                 @default(300000) @map("max_duration_ms") // 5 min default
  isActive          Boolean             @default(true) @map("is_active")
  createdById       String              @map("created_by_id")
  createdAt         DateTime            @default(now()) @map("created_at")
  updatedAt         DateTime            @updatedAt @map("updated_at")

  company           CompanyProfile      @relation(fields: [companyId], references: [id])
  createdBy         User                @relation(fields: [createdById], references: [id])
  schedule          AiAutomationSchedule?
  steps             AiAutomationStep[]
  runs              AiAutomationRun[]

  @@map("ai_automations")
  @@index([companyId, isActive], map: "idx_automations_company_active")
  @@index([triggerType], map: "idx_automations_trigger_type")
}
```

### ai_automation_steps

```prisma
model AiAutomationStep {
  id              String         @id @default(uuid())
  automationId    String         @map("automation_id")
  stepOrder       Int            @map("step_order")
  agentId         String         @map("agent_id")
  goal            String         @db.Text
  inputConfig     Json           @map("input_config")  // Variable mappings for input
  outputConfig    Json           @map("output_config") // What to capture from agent output
  maxTurns        Int            @default(10) @map("max_turns")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  automation      AiAutomation   @relation(fields: [automationId], references: [id], onDelete: Cascade)
  agent           AiAgent        @relation(fields: [agentId], references: [id])
  stepRuns        AiAutomationStepRun[]

  @@map("ai_automation_steps")
  @@unique([automationId, stepOrder], map: "uq_automation_step_order")
}
```

### ai_automation_schedules

```prisma
model AiAutomationSchedule {
  id              String         @id @default(uuid())
  automationId    String         @unique @map("automation_id")
  cronExpression  String         @map("cron_expression") @db.VarChar(100)
  timezone        String         @default("Europe/London") @db.VarChar(50)
  nextRunAt       DateTime?      @map("next_run_at")
  lastRunAt       DateTime?      @map("last_run_at")
  isPaused        Boolean        @default(false) @map("is_paused")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  automation      AiAutomation   @relation(fields: [automationId], references: [id], onDelete: Cascade)

  @@map("ai_automation_schedules")
  @@index([nextRunAt, isPaused], map: "idx_schedules_next_run")
}
```

### ai_automation_runs

```prisma
model AiAutomationRun {
  id              String         @id @default(uuid())
  automationId    String         @map("automation_id")
  triggeredBy     String         @map("triggered_by") // 'scheduler', 'event', 'chain', 'manual:userId'
  status          String         @default("PENDING") // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  startedAt       DateTime?      @map("started_at")
  completedAt     DateTime?      @map("completed_at")
  totalTokens     Int            @default(0) @map("total_tokens")
  totalCost       Decimal        @default(0) @map("total_cost") @db.Decimal(10, 4)
  result          Json?          // Final output of the last step
  error           String?        @db.Text
  retryOfRunId    String?        @map("retry_of_run_id") // FK — if this is a retry of a failed run
  createdAt       DateTime       @default(now()) @map("created_at")

  automation      AiAutomation   @relation(fields: [automationId], references: [id])
  stepRuns        AiAutomationStepRun[]

  @@map("ai_automation_runs")
  @@index([automationId, createdAt], map: "idx_runs_automation_date")
  @@index([status], map: "idx_runs_status")
}
```

### ai_automation_step_runs

```prisma
model AiAutomationStepRun {
  id              String              @id @default(uuid())
  runId           String              @map("run_id")
  stepId          String              @map("step_id")
  status          String              @default("PENDING") // PENDING, RUNNING, COMPLETED, FAILED, SKIPPED
  agentId         String              @map("agent_id")
  modelId         String?             @map("model_id")
  input           Json?               // Resolved input data
  output          Json?               // Agent output
  error           String?             @db.Text
  inputTokens     Int                 @default(0) @map("input_tokens")
  outputTokens    Int                 @default(0) @map("output_tokens")
  latencyMs       Int?                @map("latency_ms")
  turns           Int                 @default(0)
  startedAt       DateTime?           @map("started_at")
  completedAt     DateTime?           @map("completed_at")
  createdAt       DateTime            @default(now()) @map("created_at")

  run             AiAutomationRun     @relation(fields: [runId], references: [id], onDelete: Cascade)
  step            AiAutomationStep    @relation(fields: [stepId], references: [id])

  @@map("ai_automation_step_runs")
  @@index([runId, createdAt], map: "idx_step_runs_run_date")
}
```

### ai_prompt_variables

```prisma
model AiPromptVariable {
  id              String     @id @default(uuid())
  promptId        String     @map("prompt_id")
  variableName    String     @map("variable_name") @db.VarChar(100) // e.g., "customer.name"
  displayName     String     @map("display_name") @db.VarChar(255)
  description     String?    @db.Text
  sourceType      String     @map("source_type") // DB_FIELD, DB_QUERY, PAGE_FIELD, SYSTEM, CONSTANT, EXPRESSION
  sourceConfig    Json       @map("source_config") // { table, field, relation? } or { query } or { expression }
  defaultValue    String?    @map("default_value") @db.Text
  isRequired      Boolean    @default(false) @map("is_required")
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")

  prompt          AiPrompt   @relation(fields: [promptId], references: [id], onDelete: Cascade)

  @@map("ai_prompt_variables")
  @@unique([promptId, variableName], map: "uq_prompt_variable")
}
```

---
