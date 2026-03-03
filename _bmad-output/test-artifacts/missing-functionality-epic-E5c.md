# Missing Functionality - Epic E5c

> Auto-generated during frontend E2E testing

## Missing: AI Admin API routes not registered (blocks all AI admin CRUD operations)
- **Journey**: Prompt Template CRUD with Versioning (j4), Step 5 — Save new prompt
- **Expected**: POST to `/api/v1/ai/admin/prompts` should create a new prompt and return 201 with the prompt detail including version 1
- **Actual**: API returns 404 "Route not found". All `/ai/admin/*` endpoints return 404 — the AI plugin's admin routes are not registered on the running API server. The backend code exists (`apps/api/src/ai/admin/admin.routes.ts`) but the AI plugin (`apps/api/src/ai/index.ts`) fails to initialize, likely due to missing `PLATFORM_SERVICE_TOKEN` or Redis connection failure during startup. Even the degraded-mode fallback (which should register routes returning 503) is not mounting the routes.
- **Impact**: Blocks ALL AI admin frontend journeys: prompt CRUD (j4-j6), model management (j2-j3), agent management, skill management, dashboard data loading (j1 partial), automation management (j7-j12)
- **Related Story**: E5c-3 (AI Admin Dashboard & Configuration UI)
- **Suggested Story Title**: Fix AI plugin graceful degradation — ensure admin routes register even when AI Gateway is unavailable

## Missing: Prompt list empty — no seeded data loaded
- **Journey**: Prompt Template CRUD with Versioning (j4), Step 1 — Navigate to prompt list
- **Expected**: At least 6 seeded prompt records visible in the table (from E5/E5b seed data)
- **Actual**: Table shows "No results found" because GET `/api/v1/ai/admin/prompts` returns 404
- **Impact**: Cannot verify prompt list rendering with data (categories, versions, status badges)
- **Related Story**: E5c-3
- **Suggested Story Title**: Same as above — fix AI plugin route registration

## Missing: Prompt creation, version history, diff view, and version restore
- **Journey**: Prompt Template CRUD with Versioning (j4), Steps 5-13
- **Expected**: Create prompt (v1), edit with change reason (v2), view diff, restore v1 (v3), verify v3 on list
- **Actual**: Cannot proceed past Step 5 (create) because POST returns 404. All subsequent steps (versioning, diff, restore) are blocked.
- **Impact**: Entire prompt versioning workflow untestable
- **Related Story**: E5c-3
- **Suggested Story Title**: Same as above — fix AI plugin route registration

## Missing: Prompt Test Render Panel — cannot test without working prompt CRUD
- **Journey**: Prompt Test Render Panel (j6), Steps 1-4
- **Expected**: Navigate to prompt list, click a prompt to open editor, click "Test Prompt" button to open test panel, click "Render" to see rendered output with resolved variables
- **Actual**: Prompt list is empty (no seed data). Attempted to create a prompt via UI — form fills correctly (Name, Category "Record Creation", Description, System Prompt with `{{company.name}}` and `{{current_date}}` variables, User Template), but POST to `/api/ai/admin/prompts` returns 404 "Route not found". Red error toast "Route not found" displayed in UI. Cannot proceed to Steps 2-4.
- **Impact**: Entire Test Prompt workflow untestable. The frontend components (PromptTestPanel, Render button, variable input fields, green-bordered output cards) cannot be exercised.
- **Related Story**: E5c-3 (AC-5e: Test Prompt feature)
- **Suggested Story Title**: Same root cause as above — fix AI plugin route registration to enable prompt CRUD and test render

## Missing: Agent Configuration CRUD — blocked by AI admin API routes returning 404
- **Journey**: Agent Configuration CRUD Lifecycle (j7), Steps 1-11
- **Expected**: Navigate to agent list (showing 10+ seeded agents), create a new agent with name "test-e2e-agent", fill all tabs (Main, Tools, Guardrails, Triggers), save, verify agent appears in list
- **Actual**: Agent list page renders correctly with proper table structure (columns: Name, Display Name, Model, Prompt, Tools, Routing Tags, Max Turns, Status) and search bar, but shows "No results found" because GET `/ai/admin/agents` returns 404. The agent form page at `/ai/admin/agents/new` renders correctly with 4 tabs, all form fields work (Name, Display Name, Description, Model dropdown, Prompt dropdown, Routing Tags chip buttons, Max Turns, Active toggle, Guardrails tag inputs, Approval toggle, Data Scope), but:
  1. Model dropdown is empty (only "Auto-route" option) — GET `/ai/admin/models` returns 404
  2. Prompt dropdown is empty — GET `/ai/admin/prompts` returns 404
  3. Form cannot be submitted because `promptId` is a required field but no prompts are available
  4. Even if validation passed, POST `/ai/admin/agents` would return 404
- **Impact**: Entire agent CRUD lifecycle untestable. Frontend UI is fully built and working but has no backend API to interact with.
- **Related Story**: E5c-4 (AC-1, AC-2: Agent list page and agent CRUD form)
- **Suggested Story Title**: Same root cause as above — fix AI plugin route registration to enable agent CRUD operations

## Missing: /ai/variables API endpoint for prompt editor variable autocomplete
- **Journey**: Prompt Editor Variable Autocomplete (j5), Step 4
- **Expected**: Typing `{{` in the System Prompt textarea should trigger an autocomplete dropdown showing variables grouped by source type (System, DB Fields, Page Fields, Custom). System variables should include `today`, `currentUser.name`, `currentUser.role`, `company.name`, `company.baseCurrency`. Clicking a variable (e.g. `company.name`) should insert `{{company.name}}` into the textarea.
- **Actual**: The autocomplete popup triggers correctly on `{{` (frontend `VariableAutocomplete` component works), but shows "No matching variables" because the `GET /api/v1/ai/variables` endpoint does not exist in the backend. No route handler is registered for this path — grep of `apps/api/src` for `/ai/variables` returns zero matches.
- **Impact**: The variable autocomplete feature is non-functional. Users cannot discover or insert available template variables while editing prompts, making the prompt editor significantly less usable for non-technical users.
- **Related Story**: E5c-3 (AC-5c: variable autocomplete)
- **Suggested Story Title**: Implement GET /ai/variables API endpoint returning available prompt template variables grouped by source type

## Missing: Skill Pack Manager — no skill data loaded (blocks accordion view, toggle, and search testing)
- **Journey**: Skill Pack Manager — Grouped View & Activation Toggle (j8), Steps 1-7
- **Expected**: Skills grouped by moduleKey in accordion sections, each skill card showing name (monospace), displayName, description, trigger pills (blue), negative trigger pills (red), orchestration pattern badge (purple), priority, and active toggle switch. Toggle should deactivate/reactivate with toast confirmation. Search should filter skills by name/description.
- **Actual**: Page structure is correct — "Skill Pack Manager" heading, breadcrumbs (AI Administration > Skill Packs), search bar, view mode toggle (grid/list), "Test Trigger" button, and "+ Add Skill" button all render with proper Concept D purple styling. However, the main content area shows "No skills found" because the backend AI admin API routes return 404 (same root cause as all other AI admin journeys). Without skill data: no accordion groups display, no skill cards render, no toggle switches are available, and search filtering has nothing to filter against.
- **Impact**: Core skill management features untestable — grouped accordion view, inline activation toggle (AC-6), and search filtering (AC-3) cannot be verified with real data.
- **Related Story**: E5c-4 (AC-3: Grouped accordion view, AC-6: Inline activation toggle)
- **Suggested Story Title**: Same root cause as above — fix AI plugin route registration to enable skill CRUD and listing operations

## Missing: Skill Edit Form — no skills seeded, cannot navigate to /ai/admin/skills/{id}
- **Journey**: Skill Edit Form & Test Trigger Panel (j9), Steps 2-5
- **Expected**: Click a skill card to open edit form at /ai/admin/skills/{id}. Form should show tabs: Main, Triggers, Content, Schema. Main tab with name (mono), displayName, description, category dropdown, module key dropdown, output type dropdown, priority, active toggle. Triggers tab with blue trigger phrase pills, red negative trigger pills, grey context required pills. Content tab with large mono textarea containing full skillContent (SKILL.md).
- **Actual**: Skill Pack Manager shows "No skills found" — no AiSkill records in the database. Cannot navigate to the skill edit form. Steps 2 (open form), 3 (Triggers tab), 4 (Content tab), 5 (navigate back) are all blocked.
- **Impact**: Cannot verify the skill edit form UI, tab navigation, or form field rendering
- **Related Story**: E5c-4 (AC-4: Skill edit form with tabs)
- **Suggested Story Title**: Seed AiSkill records for dev/test environments, OR fix AI plugin route registration to enable skill CRUD

## Missing: Test Trigger API endpoint fails — "Failed to test trigger phrase"
- **Journey**: Skill Edit Form & Test Trigger Panel (j9), Step 8
- **Expected**: After entering "show me overdue invoices" and clicking Test, the L0→L1→L2 routing results should display: L0 matched module with confidence score, L1 matched skill with confidence score, L2 required tools and skill content preview. Results should appear within 3 seconds.
- **Actual**: The Test Trigger panel UI works correctly — it opens as a Sheet slide-in, input field accepts text, Test button is clickable. However, clicking Test produces the error "Failed to test trigger phrase. Please try again." in a red alert box. The API endpoint returns an error (likely 404 or 500). Additionally, multiple 404 errors were recorded for `/api/v1/ai/admin/dashboard`, `/api/v1/ai/automations/runs`, and `/api/v1/ai/automations` endpoints.
- **Impact**: Cannot verify L0→L1→L2 skill routing simulation or confidence bar rendering
- **Related Story**: E5c-4 (AC-5: Test Trigger routing simulation)
- **Suggested Story Title**: Same root cause — fix AI plugin route registration to enable test trigger endpoint

## Missing: Automation Chain Configuration & Notifications — blocked by empty automation list
- **Journey**: Automation Chain Configuration & Notifications (j11), Steps 2-7
- **Expected**: Click "E2E Weekly Summary" automation (created in j10) to open edit form. Enable "Chain to next automation" toggle, select "Daily AR Aging Summary" as chain target. Enable "Notify on completion" toggle, configure In-App channel, notify on success/failure. Save and verify chain + notification config persists.
- **Actual**: Automation list page renders correctly (heading, breadcrumbs, table columns, search bar, "+ New" button with Concept D styling) but shows "No results found". Neither "E2E Weekly Summary" (from j10) nor seeded "Daily AR Aging Summary" is listed. The GET `/api/v1/ai/automations` endpoint fails — the AI plugin's admin routes are not registered on the running API server. Cannot navigate to the edit form, so chain toggle, chain dropdown, notification toggle, notification channels, and save flow are all untestable.
- **Impact**: Cannot verify E5c-5 AC-7 (chain-to-next-automation config) or AC-8 (notification settings). The frontend components exist (chain toggle, chain dropdown, notification toggle, In-App/Email checkboxes, notify on success/failure toggles) but cannot be exercised without a working automation API.
- **Related Story**: E5c-5 (AC-7, AC-8)
- **Suggested Story Title**: Same root cause — fix AI plugin route registration to enable automation CRUD and listing operations

## Missing: Automation Run Now & Runs List — blocked by empty automation list (no seed data)
- **Journey**: Automation Run Now & Real-Time Status (j12), Steps 1-5
- **Expected**: Navigate to automation list showing seeded "Daily AR Aging Summary", click overflow "Run Now" to trigger, confirm in dialog, observe run in /ai/admin/automations/runs list, click run to see detail page with metrics cards (Total Tokens, Total Cost, Steps, Duration) and step timeline.
- **Actual**: Automation list page renders correctly (heading "Automations", breadcrumbs, table with columns: Name, Trigger, Schedule, Steps, Last Run, Last Run Time, Active, search bar, "+ New" button) but shows "No results found". No AiAutomation records exist in the database. The Automation Runs page also loads correctly (breadcrumb "AI Administration > Automations > Runs", filter bar with All Statuses dropdown, date range inputs dd/mm/yyyy, All Automations dropdown) with skeleton loading placeholders, but has no data. Cannot test: Run Now action, confirmation dialog, run trigger API, run list rendering with data, or run detail page.
- **Impact**: Cannot verify E5c-5 AC-9 (manual trigger/"Run Now" action) or E5c-6 AC-1 (run list page with data). Both page structures render correctly but are empty due to missing seed data.
- **Related Story**: E5c-1 (seed "Daily AR Aging Summary" automation), E5c-5, E5c-6
- **Suggested Story Title**: Seed AiAutomation records for dev/test environments — "Daily AR Aging Summary" prerequisite for E2E testing

## Missing: Run Detail — Step Timeline & Expandable Details — no automation runs exist
- **Journey**: Run Detail — Step Timeline & Expandable Details (j14), Step 2
- **Expected**: Navigate to /ai/admin/automations/runs, see at least one run row (COMPLETED or FAILED), click to open run detail page showing: run summary header (automation name linked, run ID in mono, status badge, triggered by, timestamps), 4 metrics cards (Total Tokens, Total Cost, Steps, Duration), Step Execution Timeline with expandable steps showing Input/Output JSON viewers with copy buttons
- **Actual**: Automation Runs page loads correctly with proper table structure (columns: Automation, Trigger, Triggered By, Started At, Duration, Status, Tokens, Cost, Steps) and filter bar (All Statuses dropdown, date range inputs, All Automations dropdown), but shows "No results found". No AiAutomationRun records exist. Pre-step attempted to trigger a run via Automations list "Run Now" action, but the automations list is also empty (0 rows). Cannot proceed to: run detail page, metrics cards verification, step timeline, step expand/collapse, JSON viewer interaction, or copy-to-clipboard testing.
- **Impact**: Cannot verify E5c-6 AC-3 (run detail with step timeline), AC-4 (expandable step details with JSON viewers). All frontend components exist and are built but have no data to render.
- **Related Story**: E5c-1 (seed "Daily AR Aging Summary" automation), E5c-6
- **Suggested Story Title**: Same root cause — seed AiAutomation records and fix AI plugin route registration to enable automation execution and run history

## Missing: No FAILED automation run seed data — cannot test failed run detail, error banner, step timeline, or retry flow
- **Journey**: Failed Run — View Error & Retry from Failed Step (j15), Steps 3-6
- **Expected**: At least one FAILED automation run should exist in the database. Clicking it should open a run detail page showing: red "Failed" status badge, red-bordered error banner with "Run Failed" title and error message, step execution timeline with completed steps (green), one failed step (red X circle, red left-border accent, error message), subsequent steps greyed out as "Skipped (previous step failed)", and a "Retry" button that opens a confirmation dialog to retry from the failed step.
- **Actual**: Automation Runs list page renders correctly with proper table structure, filter bar (status filter, date range, automation dropdown), and breadcrumbs. The FAILED status filter works (button shows "Failed" with purple active border, "Clear" button appears). However, the table shows "No results found" — zero AiAutomationRun records exist in the database. Steps 3-6 (run detail, timeline, retry dialog, retry confirmation) could not be tested.
- **Impact**: Cannot verify E5c-6 AC-4 (failed run error details), AC-5 (retry from failed step). The UI structure (list page, filter bar, table columns) was verified as working, but the core failed-run UX flow remains untested.
- **Related Story**: E5c-6
- **Suggested Story Title**: Seed FAILED AiAutomationRun records with step run data for dev/test E2E testing

## Missing: Sidebar items for Agent Configuration, Skill Packs, Automations, Automation Runs not rendered
- **Journey**: Skill Edit Form & Test Trigger Panel (j9), Step 1
- **Expected**: The sidebar AI section should include all admin sub-items: AI Administration, Model Registry, Prompt Templates, Agent Configuration, Skill Packs, Automations, Automation Runs
- **Actual**: Sidebar only shows: AI Administration, Model Registry, Prompt Templates. Items for Agent Configuration, Skill Packs, Automations, and Automation Runs are missing from the DOM entirely despite being defined in navigation-config.ts with the same `resourceCode: 'system.settings.detail'` as the items that DO render.
- **Impact**: Users cannot navigate directly to skill/agent/automation pages from the sidebar — must use AI dashboard quick-nav buttons instead
- **Related Story**: E5c-3
- **Suggested Story Title**: Investigate sidebar navigation filtering — some AI admin sub-items not rendered despite matching permission config
