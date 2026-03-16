# AI Module Gaps — Design Specification

**Date:** 2026-03-16
**Author:** Mohammed (decisions) + Claude (spec)
**Status:** Draft
**Scope:** 4 new features + nav restructure for the AI module

---

## 1. Overview

This spec addresses gaps identified in the AI module frontend after Epics E5b–E5d and E13b. The AI backend is largely complete, but several frontend pages are missing or disconnected.

### Features in Scope

| # | Feature | Type | Route |
|---|---------|------|-------|
| 1 | Morning Briefing | New page (dashboard replacement) | `/` (replaces current dashboard) |
| 2 | Knowledge Base nav entry | Nav config fix | `/ai/admin/knowledge` (page exists) |
| 3 | AI Setup Wizard | New feature (modal + checklist) | `/ai/admin` (overlay) |
| 4 | AI Usage Analytics | New page | `/ai/admin/analytics` |
| 5 | Navigation renames & restructure | Config change | `navigation-config.ts` + i18n keys |

### Out of Scope

- Platform Intelligence Dashboard (E5d.6) — platform-admin only, separate epic
- Chat/Copilot changes — no modifications to the copilot drawer
- Backend API changes beyond what's needed to serve these pages

---

## 2. Morning Briefing (Dashboard Replacement)

### Purpose

AI-generated, role-filtered daily summary that becomes the first thing users see on login. Replaces the current static dashboard at `/`.

### Route

- New page at `/` (authenticated index route)
- Current dashboard code preserved but swapped out; nav item "Morning Briefing" at `/ai/briefing` redirects to `/`
- Rollback: if briefing is disabled in company settings, fall back to current dashboard

### Page Layout

#### Greeting Header
- Time-based greeting: "Good morning/afternoon/evening, {firstName}"
- Date + context line: "Friday 14 March 2026 · Here's what needs your attention today"

#### Urgency Cards (3-column grid)
Three colour-coded cards ranked by urgency:

| Card Type | Left Border | Example |
|-----------|-------------|---------|
| Overdue | Red `#ef4444` | "3 invoices overdue >30 days — £12,450 total" |
| Pending Approval | Amber `#f59e0b` | "5 POs awaiting approval — 3 auto-approvable" |
| AI Insight | Purple `#7c3aed` | "Cash flow dip predicted next week" |

Each card has:
- Badge showing item count
- One-line summary + supporting detail
- Primary action button (purple) + secondary button (outline)
- Actions follow "Told, Shown, Approve, Done" — clicking pre-fills the action for user review

#### KPI Row (4-column grid)
Same metrics as current dashboard, pulled from AI context engine:
- Revenue MTD (with % change)
- Outstanding AR (with overdue flag)
- Orders Today (dispatched vs pending)
- Tasks Due (overdue count)

Values use `JetBrains Mono` font. Trend indicators: green ↑ (good), red ↑ (bad), grey (neutral).

#### AI Recommendations Panel (2/3 width)
Ranked list of AI-suggested actions:
- Each row: description, supporting detail, action button
- Max 5 items, ranked by urgency score from context engine
- Action buttons trigger the same flow as copilot chat actions (pre-fill → review → approve)

#### Today's Schedule (1/3 width)
Vertical timeline showing:
- Completed automation results (green dot)
- Upcoming deadlines (amber dot)
- Future scheduled items (grey outline dot)

#### Role Filtering
Content is filtered by user's access groups and enabled modules:
- SUPER_ADMIN/Owner: sees all cards
- Finance role: sees only AR/AP/GL cards
- Warehouse role: sees only stock/dispatch cards
- Sales role: sees only sales/CRM cards

The context engine applies the same RBAC filtering used for copilot responses.

#### Refresh Behaviour
- Auto-generates on login (background job)
- Refreshes hourly in background
- Manual "Refresh now" link at bottom
- Shows "Last refreshed X minutes ago" timestamp

### Current State

The following already exist and should be leveraged:
- **`GET /briefing` endpoint** — already registered in `apps/api/src/ai/briefing.routes.ts`
- **`BriefingPage` template** — exists at `apps/web/src/components/templates/briefing-page.tsx`
- **No route file** at `_authenticated/ai/briefing/` — needs creation (redirect to `/`)

### Route Implementation

- Replace the content of `apps/web/src/routes/_authenticated/index.tsx` with the Morning Briefing page
- Create `apps/web/src/routes/_authenticated/ai/briefing/index.tsx` with a `redirect` in `beforeLoad` to `/`
- Rollback flag stored in `CompanyProfile.settings` JSON as `settings.enableAiBriefing: boolean` (default `true`). When `false`, the authenticated index renders the current static dashboard instead.
- Uses the same `settings` JSON column added for the Setup Wizard (§4) — single migration covers both

### Backend API

Existing endpoint: `GET /briefing` (already in `briefing.routes.ts`)
- Extend response payload to include: urgency cards, KPIs, recommendations, schedule items
- Schedule section data sources: `AiAutomationRun` (completed today) + tasks with `dueDate = today`
- Uses E5b Dynamic Context Assembler for role-filtered content
- Caches per-user with 1-hour TTL (Redis)
- Falls back to basic KPI-only response if AI context engine unavailable

### Mobile Adaptation
- Urgency cards stack vertically (single column)
- KPI row becomes 2×2 grid
- Recommendations and schedule stack vertically
- Swipe actions on urgency cards (swipe right = approve, swipe left = dismiss)

---

## 3. Knowledge Base Nav Entry

### Current State
The Knowledge Management page already exists at `/ai/admin/knowledge/` with 5 tabs:
1. Articles — browse/search knowledge articles
2. Training Examples — tenant-specific training data
3. Corrections — AI correction history
4. Suggested — platform-suggested knowledge for acceptance
5. Settings — knowledge base configuration

### Change Required
Add a nav entry in the **user-facing** section of the AI module nav, positioned after "My Skills":

```
Morning Briefing
My Memory
My Skills
Knowledge Base    ← ADD HERE
```

### Implementation
- Add entry to `navigation-config.ts` under the AI module's user-facing items
- i18n key: update existing `navigation:ai.admin.knowledge` from `"Knowledge"` to `"Knowledge Base"`, or add new key `navigation:ai.knowledge`
- Route: `/ai/admin/knowledge`
- Icon: `LibraryBig` (from lucide-react) — avoids collision with Finance's `BookOpen`
- `alwaysVisible: true` (user-facing, not admin-gated)
- Note: all nav items are automatically favouritable via the path-based favourites system (`use-favourite-pages.ts`) — no per-item config needed

---

## 4. AI Setup Wizard

### Purpose
Guided onboarding for admins setting up AI for the first time. Two parts: a one-time wizard modal and a persistent checklist on the AI Settings dashboard.

### Part A: One-Time Wizard Modal

#### Trigger
- Appears on first visit to `/ai/admin` (AI Settings dashboard)
- Checks `CompanyPreference` table for `ai_setup_wizard_completed` flag
- If flag is false/missing → show wizard
- "Skip setup" always available → sets flag, shows checklist instead

#### 5 Steps

**Step 1 — Verify AI Models**
- Shows pre-seeded models (Opus, Sonnet, Haiku) with connection status
- Green "Connected" badge if model is active and API key configured
- Red "Not Connected" if missing — link to Model detail page
- Auto-completes if all models show Connected

**Step 2 — Review Agents**
- Shows default agents (Copilot, Document Reader, AR Analyst, Finance Analyst)
- Each shows: name, assigned model, tool count, active status
- "Edit" link opens agent detail page
- Auto-completes if at least one agent is active

**Step 3 — Activate Skills**
- Module checkboxes: Finance, AR, AP, Sales, Purchasing, Inventory, CRM, HR, Manufacturing
- Bulk toggle per module (enables all skills for that module)
- Shows skill count per module
- Auto-completes if at least one module's skills are activated

**Step 4 — Create First Automation (Optional)**
- Offers pre-built template: "Daily AR Follow-Up"
- One-click "Activate" sets up the automation with sensible defaults (disabled by default, user enables)
- "Skip" available — this step is optional
- Auto-completes if any automation exists

**Step 5 — Test Copilot**
- Opens copilot drawer with a suggested test query
- Shows: "Try asking: 'What invoices are overdue?'"
- Button: "Open Copilot" → opens drawer with pre-filled suggestion
- Auto-completes after first copilot message is sent

#### UI
- Modal overlay with 16px border-radius, purple progress bar at top
- Step indicator: "Step X of 5 · {step title}"
- Navigation: "← Back" and "Next →" buttons, "Skip setup" text link
- Progress bar fills proportionally (20% per step)

### Part B: Persistent Checklist Card

#### Location
Top of AI Settings dashboard (`/ai/admin`), above existing content.

#### Design
- Purple gradient header card: "Getting Started with AI" + progress "3/5"
- Progress bar (white on purple)
- Below: checklist items with checkboxes
  - Completed items: green checkbox, strikethrough text
  - Pending items: empty checkbox, description text, "Go →" link to relevant page
- "Dismiss getting started" text link at bottom

#### Auto-Detection
Each checklist item auto-detects completion:
1. Models: at least 1 active model exists
2. Agents: at least 1 active agent exists
3. Skills: at least 1 skill override with `isActive=true`
4. Automation: at least 1 automation exists
5. Copilot tested: `CompanyPreference.ai_copilot_tested = true`

#### Dismissal
- "Dismiss" hides the card permanently (`CompanyPreference.ai_setup_checklist_dismissed = true`)
- Once all 5 items are complete, card auto-hides after 7 days

### Backend

**Storage:** Requires adding a `settings Json? @map("settings")` column to the `CompanyProfile` model in Prisma schema, then running `prisma migrate dev`. Wizard/checklist state stored as keys in this JSON:
- `settings.aiSetupWizardCompleted: boolean`
- `settings.aiSetupChecklistDismissed: boolean`
- `settings.aiCopilotTested: boolean`

**New endpoint:** `PATCH /system/company/ai-settings`
- Body: `{ key: string, value: unknown }` — merges a single key into the `settings` JSON column
- Used by the wizard, checklist dismiss, and copilot-tested flag
- Registered in `company.routes.ts` alongside existing company profile routes

**Step 5 auto-completion:** The WebSocket chat handler in `use-ai-chat.ts` must call `PATCH /system/company/ai-settings` with `{ key: 'aiCopilotTested', value: true }` on the first successful assistant response.

**Step 3 "Activate Skills":** Uses the existing `SkillOverrideService` and `POST /ai/skill-overrides` endpoint to bulk-toggle skills per module.

**New endpoint:** `GET /ai/admin/setup-status`
- Returns completion state for each of the 5 checklist items
- Checks: active models count, active agents count, skill overrides with `isActive=true`, automation count, `settings.aiCopilotTested` flag

---

## 5. AI Usage Analytics

### Purpose
Dedicated analytics page with full token/cost breakdown, cost alerts, anomaly detection, and CSV export.

### Route
`/ai/admin/analytics`

### Page Layout

#### Alert Banners (top, conditional)
Two types of dismissible alert banners:

**Cost Alert (red)**
- Triggered when any module exceeds 80% of its monthly token budget
- Shows: module name, current spend / threshold, projected overage date
- Action button: "Adjust Budget" → links to budget settings
- Calculation: linear projection from current month's daily average

**Anomaly Alert (amber)**
- Triggered when any agent's 7-day token average exceeds 2× its previous 7-day average
- Shows: agent name, current vs previous average, possible cause
- Action button: "Investigate" → links to agent detail with filtered run history

#### Summary KPI Cards (4-column grid)
| Card | Value | Trend |
|------|-------|-------|
| Total Tokens | Period sum, formatted as K/M | % change vs previous period |
| Total Cost | £ sum | % change vs previous period |
| AI Requests | Count, split "Chat: X · Automation: Y" | — |
| Avg Latency | Median response time in seconds | Change vs previous period |

#### Daily Token Usage Chart
- Stacked bar chart: input tokens (dark purple) + output tokens (light purple)
- X-axis: days in selected period
- Y-axis: token count
- Hover: shows exact values
- Legend: Input / Output

#### Cost by Model (sidebar)
- Horizontal bar breakdown per model
- Shows: model name, cost amount, percentage bar
- Sorted by cost descending

#### Usage by Agent Table
| Column | Type |
|--------|------|
| Agent | Text (link to agent detail) |
| Requests | Number |
| Tokens | Number (formatted K/M) |
| Cost | Currency |

Sortable by any column. Click agent name to navigate to agent detail.

#### Usage by Module Table
| Column | Type |
|--------|------|
| Module | Text |
| Requests | Number |
| Cost | Currency |
| Budget | Percentage badge (green <60%, amber 60-80%, red >80%) |

Budget column shows percentage of per-module monthly budget consumed.

#### Top Users Section
- Avatar cards (5 across) showing top users by token consumption
- Each card: initials avatar, name, token count
- "View All Users" button for full user breakdown

### Time Range Filter
- Dropdown: Last 7 days, Last 30 days, This month, Custom range
- All charts and tables update together on change
- Default: Last 7 days

### CSV Export
- "Export CSV" button in page header
- Exports raw data for current date range
- Columns: `date, agent, model, module, user_email, tokens_in, tokens_out, cost_gbp, latency_ms, request_type`
- Filename: `nexa-ai-usage-{start}-to-{end}.csv`

### Budget Configuration
- Per-module monthly token budgets stored in `CompanyProfile.settings` JSON as `settings.aiTokenBudgets: { [moduleId: string]: number }` (monthly £ limit per module)
- Configurable via a settings modal accessible from the Budget column or alert banner
- Default: no budget (alerts disabled until a module budget is configured)
- Alert threshold: 80% of configured budget (not configurable in MVP)

### Backend API

**New endpoints:**

`GET /ai/admin/analytics/summary`
- Query params: `startDate`, `endDate`
- Returns: totalTokens, totalCost, requestCount (by type), avgLatency, trends

`GET /ai/admin/analytics/breakdown`
- Query params: `startDate`, `endDate`, `groupBy` (model|agent|module|user|day)
- Returns: array of `{ group, requests, tokensIn, tokensOut, cost, avgLatency }`

`GET /ai/admin/analytics/alerts`
- Returns: active cost alerts and anomaly alerts

`GET /ai/admin/analytics/export`
- Query params: `startDate`, `endDate`, `format=csv`
- Returns: CSV file download

### Data Source

The existing `AiUsage` table (`ai_usage`) is an aggregated daily summary keyed by `(tenantId, modelId, agentId, date)` with `requestCount`, `inputTokens`, `outputTokens`, `totalCost`. It lacks `userId`, `moduleId`, `requestType`, and `latencyMs` columns.

**Schema migration required:** Add the following columns to `AiUsage`:
- `userId String?` — which user triggered the request (nullable for system/automation)
- `moduleId String?` — which module the request relates to (derived from skill/agent)
- `requestType String` — `'chat'` or `'automation'`
- `latencyMs Int?` — median latency for this aggregation bucket

**Query strategy by `groupBy` value:**
- `groupBy=model` → group `AiUsage` by `modelId`, join `AiModel` for names
- `groupBy=agent` → group `AiUsage` by `agentId`, join `AiAgent` for names
- `groupBy=module` → group `AiUsage` by `moduleId` (new column)
- `groupBy=user` → group `AiUsage` by `userId` (new column), join `User` for names/emails
- `groupBy=day` → group `AiUsage` by `date`

**Latency data:** For chat requests, latency is on `AiMessage.latencyMs`. For automations, on `AiAutomationStepRun.latencyMs`. The `AiUsage` aggregation job should compute median latency when writing daily summaries.

**Cost calculation:** Uses `costPerMillionInput` / `costPerMillionOutput` from `AiModel` at time of request (snapshot).

**Time range semantics:**
- "Last 7 days" = `date >= today - 7`
- "Last 30 days" = `date >= today - 30`
- "This month" = `date >= firstDayOfCurrentMonth` (calendar month, for UK month-end reporting)

### Analytics Service

**File:** `apps/api/src/ai/admin/analytics.service.ts` (new file)
**Class:** `AdminAnalyticsService`
**Registration:** Add to `FastifyInstance` type augmentation in `apps/api/src/ai/index.ts` alongside existing service decorators. Routes registered in `admin.routes.ts` under the existing `/admin` prefix.

---

## 6. Navigation Restructure

### Changes Table

| Type | Current | New | Route | Audience |
|------|---------|-----|-------|----------|
| KEEP | Morning Briefing | Morning Briefing | `/ai/briefing` → redirects to `/` | All users |
| KEEP | My Memory | My Memory | `/ai/memory` | All users |
| RENAME | Skills (under section header) | My Skills | `/ai/skills` | All users |
| **ADD** | — | Knowledge Base | `/ai/admin/knowledge` | All users |
| RENAME | "Skills" section header | "AI Settings" section header | — | Admin |
| RENAME | AI Administration | Dashboard | `/ai/admin` | Admin |
| RENAME | Model Registry | AI Models | `/ai/admin/models` | Admin |
| RENAME | Prompt Templates | AI Prompts | `/ai/admin/prompts` | Admin |
| RENAME | Agent Configuration | AI Agents | `/ai/admin/agents` | Admin |
| MOVE | Skill Packs (section header) | Skill Packs (under AI Settings) | `/ai/admin/skills` | Admin |
| **ADD** | — | AI Analytics | `/ai/admin/analytics` | Admin |
| RENAME | "Skill Packs" section header | "Automations" section header | — | Admin |
| KEEP | Automations | Automations | `/ai/admin/automations` | Admin |
| RENAME | Automation Runs | Run History | `/ai/admin/automations/runs` | Admin |

### Implementation

**Files to modify:**
- `apps/web/src/lib/navigation-config.ts` — restructure nav items, update labels, add new entries
- `packages/i18n/locales/en/navigation.json` — update i18n keys for renamed items
- No route file changes needed (routes stay the same, only display labels change)

**Section headers:** The current `NavigationItem` interface is a flat array with no sub-grouping. To support "AI Settings" and "Automations" as section headers within the AI module, extend `NavigationItem` with an optional `type` field:

```typescript
interface NavigationItem {
  // ...existing fields
  type?: 'item' | 'header';  // default 'item'
}
```

The active navigation renders items through `mega-menu-item.tsx` (from `NavigationModule.items` array). This component should check `type === 'header'` and render a `<p>` label instead of a clickable link. Items following a header (until the next header or end of array) are visually grouped under it. For the legacy sidebar path (`app-sidebar.tsx`, active when `VITE_USE_NEW_NAVIGATION === 'false'`), the same check should be added to `sidebar-item.tsx`. This is a minimal extension — 1 new optional field + ~5 lines of rendering logic per component.

### Nav Structure (final)

```
AI
├── Morning Briefing          (user, favouritable)
├── My Memory                 (user, favouritable)
├── My Skills                 (user, favouritable)
├── Knowledge Base            (user, favouritable) ← NEW
│
├── AI Settings               (section header, admin-only)
│   ├── Dashboard             (was "AI Administration")
│   ├── AI Models             (was "Model Registry")
│   ├── AI Prompts            (was "Prompt Templates")
│   ├── AI Agents             (was "Agent Configuration")
│   ├── Skill Packs           (was section header, now regular item)
│   └── AI Analytics          ← NEW
│
└── Automations               (section header, admin-only)
    ├── Automations
    └── Run History           (was "Automation Runs")
```

---

## 7. Design System Compliance

All new pages follow Concept D design system:

| Element | Spec |
|---------|------|
| Card radius | 12px |
| Card shadow | `0 1px 3px rgba(0,0,0,0.06)` |
| Card hover shadow | `0 4px 12px rgba(124,58,237,0.1)` |
| Primary button | `#7c3aed`, hover `#5b21b6`, 8px radius |
| Background | `#f4f2ff` (light purple) |
| Heading font | Plus Jakarta Sans |
| Body font | Inter |
| Mono font | JetBrains Mono (amounts, codes, metrics) |
| Animations | fadeInUp, slideIn, stepIn with `prefers-reduced-motion` respect |

---

## 8. Spec Documents to Update

When these features are implemented, the following spec documents must be updated per the Document Synchronisation Rule:

1. **PRD** — add Morning Briefing as FR, add AI Analytics as FR
2. **UX Design Specification** — add page templates for briefing, analytics; document wizard flow
3. **API Contracts** — add `/briefing`, `/ai/admin/analytics/*`, `/ai/admin/setup-status` endpoints
4. **Epic Files** — create new epic or extend E5b/E5c/E13b with new stories
5. **Event Catalog** — add `briefing.generated`, `analytics.alert.triggered` events
6. **Project Context** — note AI setup wizard as cross-cutting onboarding pattern

---

## 9. Mockups

Visual mockups created during design session are saved in:
- `.superpowers/brainstorm/46780-1773686795/morning-briefing.html`
- `.superpowers/brainstorm/46780-1773686795/ai-setup-wizard.html`
- `.superpowers/brainstorm/46780-1773686795/ai-analytics.html`
- `.superpowers/brainstorm/46780-1773686795/nav-redesign-v2.html`
