# Epic E5 + E5b — Page Inventory

## Summary

E5's backend is complete. Its frontend is **partially implemented** — the Co-Pilot drawer, chat components, and briefing template all exist but are NOT wired to the real backend (placeholder responses, local-only chat history, stub action proposals). E5b adds new settings pages for memory and skills management, plus the inline entity mentions feature for the chat textbox.

- **E5 pages to complete (wire to backend):** 4
- **E5b new pages:** 3
- **E5b component enhancements:** 1 (chat textbox)
- **Total frontend work items:** 8
- **Templates used:** T4 (Briefing), T7 (Settings), Custom (Co-Pilot Drawer)
- **New Shadcn components needed:** None (all installed)
- **New custom components needed:** `MemoryList`, `MemoryCard`, `MemoryEditDialog`, `ForgetAllDialog`, `MemorySettingsPanel`, `SkillPackAccordion`, `SkillCard`, `TriggerPhraseTag`, `EntityMentionInput`, `EntityAutocompleteDropdown`, `EntityChip`, `ConnectionStatusDot`

---

## E5 Pages (Complete / Wire to Backend)

### 1. Co-Pilot Chat — Wire to Real WebSocket

- **Template:** Custom (CopilotDrawer — already built)
- **Story:** E5.S2
- **Route:** N/A (drawer overlay, mounted in AppLayout)
- **What exists:** Full component suite — CopilotDrawer, CopilotChat, CopilotInput, ChatHistory, QuickPrompts, CopilotMinimisedPill, DataCard. All rendered. `useAiChat` hook implemented but NOT mounted.
- **What's needed:**
  - Mount `useAiChat()` hook in CopilotDrawer or CopilotChat
  - Replace `store.submitUserMessage()` placeholder with real `sendMessage()` from hook
  - Wire `confirmAction(actionId)` / `rejectAction(actionId)` to ActionProposalCard approve/reject buttons
  - Add `ConnectionStatusDot` component to drawer header (green/amber/red based on connectionStatus)
  - Wire server-side chat history (`GET /ai/chat/history`) to ChatHistory component
- **New components:** `ConnectionStatusDot`
- **v0 candidate:** SKIP — wiring changes, not new UI
- **v0 priority:** N/A

### 2. AI Briefing Page

- **Template:** T4 Briefing (template exists at `components/templates/briefing-page.tsx`)
- **Story:** E5.S5
- **Route:** `/ai/briefing` (new route, under top-level AI sidebar section)
- **What exists:** `BriefingPage` template component + `BriefingCard` component. Dashboard at `/` has mock KPI cards but is NOT the briefing — it's a static dashboard.
- **What's needed:**
  - Create route `_authenticated/ai/briefing/index.tsx`
  - Wire to `GET /ai/briefing` API endpoint
  - Role-based briefing content (Finance Manager vs Business Owner vs Sales etc.)
  - Actionable links on each briefing item (one-tap approve, chase, review)
  - Loading skeleton while briefing generates
  - "Refresh" button to regenerate stale briefing
  - Add "Morning Briefing" link to sidebar navigation under top-level "AI" section
- **New components:** None (template exists)
- **v0 candidate:** MEDIUM — template exists but the role-specific briefing card layouts and actionable items need design thought
- **v0 priority:** MEDIUM

### 3. Dashboard AI Integration

- **Template:** Custom (existing dashboard at `_authenticated/index.tsx`)
- **Story:** E5.S5
- **Route:** `/` (existing)
- **What exists:** Static mock data in KPI cards, charts, tasks, recent activity
- **What's needed:**
  - Wire KPI cards to real data endpoints
  - Add AI suggestion chips to dashboard (from `POST /ai/suggestions`)
  - Add a "Daily Briefing Summary" card linking to full briefing page
  - Wire `AiChip` component to mark any AI-generated data values
- **New components:** None
- **v0 candidate:** SKIP — incremental changes to existing page
- **v0 priority:** N/A

### 4. Unified Search — Entity Search Wiring

- **Template:** Custom (UnifiedSearch command palette in header)
- **Story:** E5.S1 (AI service layer provides search context)
- **Route:** N/A (Cmd+K overlay)
- **What exists:** Command palette with pages search + "Ask AI" fallback. Entity search section is disabled/placeholder.
- **What's needed:**
  - Wire entity search results to real API endpoints (search customers, invoices, etc.)
  - Group results by entity type with icons
  - Show entity results alongside page results and AI suggestions
- **New components:** None
- **v0 candidate:** SKIP — wiring, not new design
- **v0 priority:** N/A

---

## E5b Pages (New)

### 5. Memory Management Page

- **Template:** T7 Settings
- **Story:** E5b.S5
- **Route:** `/ai/memory` (new, under top-level AI sidebar section)
- **Description:** Full user memory management — view, edit, delete memories. Grouped by category with search/filter. Privacy controls (enable/disable, category toggles, retention period). "Forget Everything" destructive action.
- **Layout:**
  ```
  ┌─────────────────────────────────────────────────┐
  │ AI > My Memory                                    │
  ├─────────────────────────────────────────────────┤
  │ [Memory Settings Panel]                          │
  │ ┌─────────────────────────────────────────────┐ │
  │ │ ☑ Enable AI Memory    [Forget Everything]   │ │
  │ │ Categories: ☑Preferences ☑Workflows         │ │
  │ │            ☑Decisions  ☑Instructions        │ │
  │ │ Retention: [90 days ▾]                      │ │
  │ └─────────────────────────────────────────────┘ │
  │                                                  │
  │ [Search memories...]           [Filter by ▾]     │
  │                                                  │
  │ ── Preferences (4) ──────────────────────────── │
  │ ┌─ Memory Card ──────────────────────────────┐ │
  │ │ "Prefers overdue invoices sorted by amount" │ │
  │ │ 📌 PREFERENCE  |  Explicit  |  3 Feb 2026  │ │
  │ │ Last used: 2 days ago         [Edit] [🗑️]  │ │
  │ └────────────────────────────────────────────┘ │
  │ ┌─ Memory Card ──────────────────────────────┐ │
  │ │ "Always use Net 30 for new customers"       │ │
  │ │ 📌 INSTRUCTION  |  Explicit  |  15 Jan 2026│ │
  │ │ Last used: 5 days ago         [Edit] [🗑️]  │ │
  │ └────────────────────────────────────────────┘ │
  │                                                  │
  │ ── Workflows (2) ───────────────────────────── │
  │ ┌─ Memory Card ──────────────────────────────┐ │
  │ │ "Usually reviews AR aging on Fridays"       │ │
  │ │ 🔄 WORKFLOW  |  Learned  |  28 Jan 2026    │ │
  │ │ Last used: today              [Edit] [🗑️]  │ │
  │ └────────────────────────────────────────────┘ │
  └─────────────────────────────────────────────────┘
  ```
- **New components:** `MemoryCard`, `MemoryEditDialog`, `ForgetAllDialog`, `MemorySettingsPanel`
- **Action bar:** N/A (settings page)
- **Interactions:**
  - Edit: inline dialog with text editor for memory content
  - Delete: confirmation dialog per memory
  - Forget Everything: destructive confirmation dialog (type "FORGET" to confirm)
  - Category filter: multi-select filter chips
  - Search: debounced text search across memory content
- **v0 candidate:** YES — the memory card layout with category grouping, source badges, and settings panel is a novel pattern worth designing
- **v0 priority:** HIGH

### 6. AI Skills Browser Page

- **Template:** T7 Settings (read-only for STAFF, editable for ADMIN)
- **Story:** E5b.S5
- **Route:** `/ai/skills` (new, under top-level AI sidebar section)
- **Description:** Browse all available AI skill packs grouped by module. Each skill shows name, description, trigger phrases as tags, negative triggers as red tags, orchestration pattern badge, active/inactive toggle (ADMIN only).
- **Layout:**
  ```
  ┌─────────────────────────────────────────────────┐
  │ AI > Skills                                       │
  ├─────────────────────────────────────────────────┤
  │ [Search skills...]      [Filter by module ▾]     │
  │                                                  │
  │ ▼ Views Module (5 skills) ──────────────────── │
  │ ┌─ Skill Card ───────────────────────────────┐ │
  │ │ Open Entity List                    [🟢 On] │ │
  │ │ Navigate to an entity list page             │ │
  │ │ Triggers: [show] [open] [view] [list]       │ │
  │ │ Blocks:   [create] [new] [edit]     🔴      │ │
  │ │ Pattern: CONTEXT_AWARE                      │ │
  │ └────────────────────────────────────────────┘ │
  │ ┌─ Skill Card ───────────────────────────────┐ │
  │ │ Apply Filter                        [🟢 On] │ │
  │ │ Apply ad-hoc filter to a list               │ │
  │ │ Triggers: [filter] [show only] [where]      │ │
  │ │ Pattern: ITERATIVE                          │ │
  │ └────────────────────────────────────────────┘ │
  │                                                  │
  │ ▼ Finance Module (4 skills) ───────────────── │
  │   ...                                            │
  │                                                  │
  │ ▶ AR Module (5 skills) ────────────────────── │
  │ ▶ Purchasing Module (4 skills) ────────────── │
  └─────────────────────────────────────────────────┘
  ```
- **New components:** `SkillPackAccordion`, `SkillCard`, `TriggerPhraseTag` (green for positive, red for negative)
- **Interactions:**
  - Accordion expand/collapse per module
  - Active toggle (ADMIN only) — optimistic update
  - Click skill → slide-out detail panel (or modal) for ADMIN editing
  - Search filters across all skills (name, trigger phrases)
  - Module filter dropdown
- **v0 candidate:** YES — the module-grouped accordion with trigger phrase tags is a unique pattern
- **v0 priority:** HIGH

### 7. Inline Entity Mentions — Chat Textbox Enhancement

- **Template:** Custom (enhancement to existing CopilotInput)
- **Story:** E5b.S7
- **Route:** N/A (inside Co-Pilot drawer)
- **Description:** Enhance the chat textbox to detect entity trigger words and show context-aware autocomplete. User types "Send invoice 1042 to contact jo..." and a dropdown shows matching contacts scoped to that customer.
- **Layout:**
  ```
  ┌─────────────────────────────────────────────────┐
  │ CopilotInput (existing textarea)                 │
  │ ┌───────────────────────────────────────────┐   │
  │ │ Send invoice 1042 to contact jo█          │   │
  │ └───────────────────────────────────────────┘   │
  │ ┌─ Entity Autocomplete ─────────────────────┐   │
  │ │ Contacts for Acme Ltd                      │   │
  │ │ ─────────────────────────────────────────  │   │
  │ │ 👤 John Smith     john@acme.com       ← ▸ │   │
  │ │ 👤 Jane Jones     jane@acme.com            │   │
  │ │ 👤 James Oliver   james@acme.com           │   │
  │ └───────────────────────────────────────────┘   │
  │                                                  │
  │ After selection:                                 │
  │ ┌───────────────────────────────────────────┐   │
  │ │ Send invoice 1042 to [John Smith] asap    │   │
  │ └───────────────────────────────────────────┘   │
  │ (chip: purple-tinted pill with entity name)      │
  └─────────────────────────────────────────────────┘

  Mobile: dropdown becomes bottom sheet above keyboard
  ```
- **New components:** `EntityMentionInput` (wraps/enhances CopilotInput), `EntityAutocompleteDropdown`, `EntityChip` (inline pill), `EntityBottomSheet` (mobile)
- **Interactions:**
  - Trigger detection: as user types, local matching against cached trigger words
  - Autocomplete dropdown: appears below cursor, keyboard navigable (↑↓ Enter Escape)
  - Entity chip: styled inline pill, removable with backspace
  - Context scoping: if message mentions "invoice 1042" (customer known), scope "contact" search to that customer
  - Debounced search: 300ms debounce on server search call
  - Mobile: bottom sheet instead of dropdown (above virtual keyboard)
- **v0 candidate:** YES — the inline mention system with context-aware autocomplete is a complex interaction pattern that benefits significantly from v0 prototyping
- **v0 priority:** HIGH

---

## v0 Candidates Summary

| # | Page | v0 Priority | Why |
|---|------|-------------|-----|
| 5 | Memory Management | HIGH | Novel card layout with category grouping, source badges, settings panel, destructive "Forget All" flow |
| 6 | AI Skills Browser | HIGH | Module-grouped accordion with colour-coded trigger phrase tags, active toggles, unique to ERP |
| 7 | Entity Mentions | HIGH | Complex inline autocomplete with context scoping, entity chips, mobile bottom sheet — hardest to get right without visual reference |
| 2 | AI Briefing Page | MEDIUM | Template exists but role-specific layouts and actionable briefing items need design |
| 1 | Co-Pilot Wiring | SKIP | Code wiring, no new visual design needed |
| 3 | Dashboard AI | SKIP | Incremental changes to existing page |
| 4 | Unified Search | SKIP | Wiring entity results to existing command palette |

---

## New Shadcn Components Needed

None — all required Shadcn components are already installed (accordion, dialog, switch, tabs, badge, input, button, card, separator, sheet, tooltip, command, popover, scroll-area, skeleton).

## Mohammed's Decisions (27 Feb 2026)

1. **AI Settings pages (prompts, parameters, models, agents)?** — Already fully designed in E5c (S3: Model & Prompt Admin, S4: Agent & Skill Admin, S5: Automation Builder) and E5d (S5: Knowledge Management). Those pages will go through their own pre-epic design gate when E5c/E5d are up for implementation.
2. **AI Briefing** — Kept as separate route (`/briefing`). Briefing is a role-aware AI-generated daily summary with actionable items (chase, approve, review). Template component already exists.
3. **Entity Mentions scope** — To be determined during story implementation. Can start with subset and expand.
4. **v0 treatment** — Review after epic done; add a refinement story if needed. No v0 prototyping for E5/E5b pages at this stage.
5. **Sidebar placement** — New **top-level "AI" sidebar section** (NOT under Settings). Separate AI user-facing pages (Memory, Skills, Briefing) from AI admin configuration (which stays under Settings in E5c). Routes updated: `/ai/memory`, `/ai/skills`, `/ai/briefing`.

## Sidebar Structure (Approved)

```
AI (top-level)
├── Morning Briefing     → /ai/briefing      (E5)
├── My Memory            → /ai/memory        (E5b)
└── Skills               → /ai/skills        (E5b)

Settings > AI Configuration  (E5c — future)
├── Dashboard            → /system/settings/ai/dashboard
├── Models               → /system/settings/ai/models
├── Prompts              → /system/settings/ai/prompts
├── Agents               → /system/settings/ai/agents
├── Skills Admin         → /system/settings/ai/skills-admin
├── Automations          → /system/settings/ai/automations
└── Knowledge            → /system/settings/ai/knowledge   (E5d)
```

## E5c/E5d Configuration Pages (Future — Separate Design Gate)

These admin pages are fully designed in E5c and E5d but will go through their own pre-epic frontend design gate:

| Page | Epic/Story | Template |
|------|-----------|----------|
| AI Configuration Dashboard | E5c.S3 | T5 Dashboard |
| Model Registry | E5c.S3 | T1 List + T3 Detail |
| Prompt Templates | E5c.S3 | T1 List + T4 Editor |
| Agent Configuration | E5c.S4 | T1 List + T3 Detail |
| Skill Pack Manager (Admin) | E5c.S4 | T1 List + T3 Detail |
| Automation Builder | E5c.S5 | T1 List + T4 Editor |
| Automation Runs | E5c.S5 | T1 List + T2 Detail |
| Knowledge Management | E5d.S5 | T7 Settings + Tabs |
