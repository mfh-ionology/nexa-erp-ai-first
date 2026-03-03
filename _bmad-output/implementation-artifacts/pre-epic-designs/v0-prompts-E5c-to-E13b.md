# Nexa ERP — v0 Design Prompts for Epics E5c through E13b

> **Usage:** Each epic section below is a self-contained v0 prompt. Paste the **Design System Base** (from `epic-E5-E5b-v0-prompt.md` lines 1–185) FIRST, then append the epic-specific section below.
>
> **Pre-requisite:** The base design system prompt establishes: Concept D purple theme, typography, spacing, shadows, animations, status colours, action bar, responsive rules.

---

## Table of Contents

1. [E5c — AI Administration & Autonomous Workflows](#e5c)
2. [E5d — AI Knowledge Evolution & Cross-Tenant Intelligence](#e5d)
3. [E8 — Attachments, Notes & Record Links](#e8)
4. [E9 — Notifications](#e9)
5. [E10 — Email Integration](#e10)
6. [E11 — Cross-cutting Tasks](#e11)
7. [E12 — Document Templates & PDF](#e12)
8. [E13 — Printer Management](#e13)
9. [E13b — Platform Admin Portal](#e13b)

---

<a id="e5c"></a>
## EPIC E5c — AI Administration & Autonomous Workflows

### Epic Context

Admin pages for managing AI models, prompt templates, agent configuration, skill packs, and an automation builder with visual step sequencing and real-time run monitoring.

**Sidebar location:** AI section — sub-items: Configuration, Agents & Skills, Automations

### Frontend Stories: S3, S4, S5, S6

---

### Screen 1: AI Configuration Dashboard

**Template:** T5 — Dashboard
**Route:** `/ai/configuration`
**Story:** E5c.S3

```
┌─────────────────────────────────────────────────────────┐
│ AI > Configuration                                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ── Model Registry ─────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ │   │
│ │ │Claude   │ │GPT-4o   │ │Gemini   │ │+ Add     │ │   │
│ │ │Opus 4.6 │ │         │ │Pro 2    │ │  Model   │ │   │
│ │ │✓ Active │ │○ Standby│ │○ Standby│ │          │ │   │
│ │ │Default  │ │Fallback │ │         │ │          │ │   │
│ │ └─────────┘ └─────────┘ └─────────┘ └──────────┘ │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Prompt Templates ───────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Search prompts...               [+ New Template]   │   │
│ │                                                    │   │
│ │ Template Name      │ Type     │ Model   │ Updated  │   │
│ │ ─────────────────  │ ──────── │ ─────── │ ──────── │   │
│ │ System Prompt      │ SYSTEM   │ Claude  │ 2h ago   │   │
│ │ Invoice Extractor  │ EXTRACT  │ GPT-4o  │ 1d ago   │   │
│ │ Daily Briefing     │ GENERATE │ Claude  │ 3d ago   │   │
│ │ Email Draft        │ GENERATE │ Claude  │ 5d ago   │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Model cards with status badge (Active/Standby/Disabled), provider logo, "Default" tag
- Prompt template list (T1 pattern) with inline search
- Click model card → slide-out Sheet with config: API key (masked), temperature, max tokens, rate limits, fallback chain
- Click prompt row → full-screen editor (Screen 2)

---

### Screen 2: Prompt Template Editor

**Template:** T4 — Editor (full-width)
**Route:** `/ai/configuration/prompts/:id`
**Story:** E5c.S3

```
┌─────────────────────────────────────────────────────────┐
│ [← Back] Prompt: Invoice Extractor     [Test] [Save]    │
├──────────────────────────┬──────────────────────────────┤
│                          │                              │
│ ── Editor ────────────── │ ── Preview ──────────────── │
│                          │                              │
│ Name: [Invoice Extractor]│ Sample Input:                │
│ Type: [EXTRACT ▼]        │ ┌────────────────────────┐  │
│ Model: [Claude Opus ▼]   │ │ (rendered output        │  │
│                          │ │  from test execution)   │  │
│ ┌────────────────────┐   │ │                         │  │
│ │ Extract the follow │   │ │                         │  │
│ │ ing fields from    │   │ └────────────────────────┘  │
│ │ the document:      │   │                              │
│ │                    │   │ Variables Used:               │
│ │ {{company_name}}   │   │ • company_name ✓             │
│ │ {{document_type}}  │   │ • document_type ✓            │
│ │                    │   │ • currency_code ✓             │
│ │ Return as JSON:    │   │                              │
│ │ {                  │   │ ── Version History ────────  │
│ │   "invoice_no":    │   │ v3 — 2h ago (current)       │
│ │   "date":          │   │ v2 — 1d ago                  │
│ │   "total":         │   │ v1 — 5d ago                  │
│ │ }                  │   │ [View Diff]                   │
│ └────────────────────┘   │                              │
│                          │                              │
│ [Variable Autocomplete]  │                              │
│ {{cursor triggers list}} │                              │
├──────────────────────────┴──────────────────────────────┤
│ Token count: 342 │ Est. cost: $0.003 │ Last run: 2s ago │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Split-pane editor: left = code editor with syntax highlighting (use `@uiw/react-codemirror` or Monaco), right = live preview + version history
- Variable autocomplete dropdown when typing `{{` — list of DB_FIELD, SYSTEM, CONSTANT variables
- Token counter in footer (live calculation)
- Version history sidebar with diff view (green/red highlights)
- "Test" button sends sample data and shows streaming response in preview pane

---

### Screen 3: Agents & Skills Manager

**Template:** T1 — Entity List (tabbed)
**Route:** `/ai/agents-skills`
**Story:** E5c.S4

```
┌─────────────────────────────────────────────────────────┐
│ AI > Agents & Skills                                     │
├─────────────────────────────────────────────────────────┤
│ [Agents] [Skill Packs] [Skills]       ← tab bar         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ── Agents Tab ─────────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Agent Name    │ Level │ Skills │ Status  │ Actions │   │
│ │ ────────────  │ ───── │ ────── │ ─────── │ ─────── │   │
│ │ Orchestrator  │ L0    │ 3      │ ● Active│ [Edit]  │   │
│ │ Finance Agent │ L1    │ 8      │ ● Active│ [Edit]  │   │
│ │ Sales Agent   │ L1    │ 6      │ ● Active│ [Edit]  │   │
│ │ HR Agent      │ L1    │ 4      │ ○ Draft │ [Edit]  │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Test Trigger Panel (expandable) ────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Simulate: "Show me overdue invoices"                │   │
│ │ [Run Test]                                          │   │
│ │                                                    │   │
│ │ L0 Orchestrator → L1 Finance Agent → L2 AR Skill  │   │
│ │ ────●───────────────●─────────────────●────────    │   │
│ │ Route decision     Skill match       Execute        │   │
│ │ 12ms               8ms               340ms          │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Tabbed layout: Agents (T1 table), Skill Packs (accordion grouped cards), Skills (T1 table)
- Agent edit: slide-out Sheet with agent config, assigned skills, routing rules
- Test Trigger Panel: text input + horizontal flow visualization showing L0→L1→L2 routing chain with timing bubbles
- Skill Pack cards: grouped by module, show pack name, version, skill count, enable/disable toggle
- Drag-and-drop skill assignment from pack to agent (or multi-select + assign)

---

### Screen 4: Automation Builder

**Template:** T4 — Editor
**Route:** `/ai/automations/:id`
**Story:** E5c.S5

```
┌─────────────────────────────────────────────────────────┐
│ [← Back] Automation: Daily Invoice Reminder  [Run Now] [Save]│
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Name: [Daily Invoice Reminder    ]                       │
│ Trigger: [Schedule ▼]  Cron: [0 8 * * 1-5]              │
│          "Every weekday at 8:00 AM" ← human-readable     │
│ Status: [● Active ▼]                                     │
│                                                          │
│ ── Steps ──────────────────────────────────────────────  │
│                                                          │
│  ┌─ Step 1 ──────────────────────────────────────────┐   │
│  │ ☰ Query Database                          [✎] [✕] │   │
│  │ SELECT invoices WHERE dueDate < NOW()             │   │
│  │ AND status = 'POSTED'                             │   │
│  │ Output: {{step1.results}}                         │   │
│  └───────────────────────────────────────────────────┘   │
│                     │                                    │
│                     ▼                                    │
│  ┌─ Step 2 ──────────────────────────────────────────┐   │
│  │ ☰ AI Generate                             [✎] [✕] │   │
│  │ Prompt: "Summarize overdue invoices..."           │   │
│  │ Model: Claude Opus                                │   │
│  │ Variables: {{step1.results}}, {{company_name}}    │   │
│  │ Output: {{step2.summary}}                         │   │
│  └───────────────────────────────────────────────────┘   │
│                     │                                    │
│                     ▼                                    │
│  ┌─ Step 3 ──────────────────────────────────────────┐   │
│  │ ☰ Send Notification                       [✎] [✕] │   │
│  │ Channel: Email + In-App                           │   │
│  │ To: {{role:ADMIN}}                                │   │
│  │ Body: {{step2.summary}}                           │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  [+ Add Step]                                            │
│                                                          │
│ ── Variable Bindings ──────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ company_name │ SYSTEM   │ Company Profile → name   │   │
│ │ today        │ SYSTEM   │ Current Date             │   │
│ │ step1.results│ PREVIOUS │ Step 1 output            │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Step cards with drag-reorder (use `dnd-kit` or similar), vertical connector lines between steps
- Step types: Query Database, AI Generate, Send Notification, HTTP Request, Transform Data, Condition Branch
- Step editor: click [✎] opens Sheet with type-specific form fields
- Cron builder: visual cron selector with human-readable preview (e.g., "Every weekday at 8:00 AM")
- Variable bindings panel: table showing all bound variables, their source type, and resolved path
- "Run Now" button: triggers WebSocket connection showing real-time step-by-step progress

---

### Screen 5: Automation Runs List

**Template:** T1 — Entity List
**Route:** `/ai/automations/runs`
**Story:** E5c.S6

```
┌─────────────────────────────────────────────────────────┐
│ AI > Automation Runs                                     │
├─────────────────────────────────────────────────────────┤
│ [All] [Running] [Failed] [Completed]    [Date Range ▼]  │
├─────────────────────────────────────────────────────────┤
│ Automation     │ Status      │ Steps │ Duration │ Started│
│ ─────────────  │ ─────────── │ ───── │ ──────── │ ────── │
│ Daily Reminder │ ● Completed │ 3/3   │ 4.2s     │ 08:00  │
│ Sync Inventory │ ● Running   │ 2/5   │ 12s...   │ 07:45  │
│ Weekly Report  │ ● Failed    │ 1/4   │ 0.8s     │ 07:00  │
│ Daily Reminder │ ● Completed │ 3/3   │ 3.8s     │ Yest.  │
└─────────────────────────────────────────────────────────┘
```

Click a row → Run Detail:

```
┌─────────────────────────────────────────────────────────┐
│ [← Back] Run: Daily Reminder — 08:00 Today               │
├─────────────────────────────────────────────────────────┤
│ Status: ● Completed    Duration: 4.2s    Steps: 3/3     │
│                                                          │
│  Step 1: Query Database          ● Completed  1.2s       │
│  ├─ Input: { query: "SELECT..." }                        │
│  └─ Output: { results: [12 records] }                    │
│                                                          │
│  Step 2: AI Generate             ● Completed  2.8s       │
│  ├─ Input: { prompt: "Summarize...", model: "claude" }   │
│  └─ Output: { summary: "You have 12 overdue..." }       │
│                                                          │
│  Step 3: Send Notification       ● Completed  0.2s       │
│  ├─ Input: { channel: "email", to: "admin@..." }        │
│  └─ Output: { sent: true }                              │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Status badges: Running (blue, animated pulse), Completed (green), Failed (red), Paused (amber)
- Step timeline: vertical with expand/collapse for input/output JSON
- Failed steps: red highlight with error message and [Retry] / [Skip] action buttons
- Running steps: animated progress indicator
- Health summary card at top of list page: automations active, runs today, failure rate, avg duration

---

<a id="e5d"></a>
## EPIC E5d — AI Knowledge Evolution & Cross-Tenant Intelligence

### Epic Context

RAG-based knowledge management per tenant, correction/feedback loops, and cross-tenant anonymised intelligence sharing. Platform intelligence dashboard for monitoring cross-tenant patterns.

**Sidebar location:** AI section — sub-items: Knowledge Base

---

### Screen 1: Knowledge Base Manager

**Template:** T1 — Entity List with upload
**Route:** `/ai/knowledge`
**Story:** E5d.S1, E5d.S5

```
┌─────────────────────────────────────────────────────────┐
│ AI > Knowledge Base                                      │
├─────────────────────────────────────────────────────────┤
│ [Documents] [Training Examples] [Corrections]            │
├─────────────────────────────────────────────────────────┤
│ Search knowledge...              [+ Upload] [+ Add URL] │
│                                                          │
│ ── Documents Tab ──────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 📄 Name           │ Type    │ Chunks │ Status     │   │
│ │ ─────────────────  │ ─────── │ ─────  │ ────────── │   │
│ │ Employee Handbook  │ PDF     │ 84     │ ● Indexed  │   │
│ │ VAT Guidance 2026  │ URL     │ 32     │ ● Indexed  │   │
│ │ Sales Playbook     │ DOCX    │ 56     │ ○ Processing│  │
│ │ Product Catalog    │ PDF     │ --     │ ◌ Queued   │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Upload Drop Zone ───────────────────────────────────  │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│   📁 Drop files here or click to browse                  │
│      PDF, DOCX, TXT, MD — Max 50MB per file             │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Tabbed layout: Documents (uploaded files/URLs), Training Examples (manually created Q&A pairs), Corrections (AI mistakes corrected by users)
- Document upload: drag-and-drop zone with progress bars per file, chunking status
- URL ingestion: input field for web URLs, auto-scrape and chunk
- Status badges: Queued (grey), Processing (blue animated), Indexed (green), Failed (red)
- Chunk viewer: click document → slide-out showing individual chunks with embeddings info
- Training examples tab: Q&A pair list with [+ Add Example] button, edit inline
- Corrections tab: list of user corrections with original AI response vs corrected response, approval status

---

### Screen 2: Intelligence Dashboard (Platform-level)

**Template:** T8 — Report
**Route:** `/ai/intelligence` (or platform admin)
**Story:** E5d.S6

```
┌─────────────────────────────────────────────────────────┐
│ AI > Intelligence Dashboard                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ Knowledge│ │ Patterns │ │ Corrects │ │ Coverage │    │
│ │ 2,340    │ │ 156      │ │ 89       │ │ 72%      │    │
│ │ articles │ │ detected │ │ applied  │ │ modules  │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                          │
│ ── Cross-Tenant Patterns ────────────────────────────── │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Pattern              │ Tenants │ Confidence │ Action│   │
│ │ ───────────────────  │ ─────── │ ────────── │ ───── │   │
│ │ Late payment follow  │ 23/50   │ 92%        │ [Pub] │   │
│ │ Invoice rounding fix │ 18/50   │ 87%        │ [Pub] │   │
│ │ Quarterly close flow │ 12/50   │ 78%        │ [Rev] │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Knowledge Distribution ─────────────────────────────  │
│ [chart: knowledge articles created over time by module]  │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- KPI cards (Concept D style with fadeInUp animation)
- Pattern detection table: cross-tenant anonymised patterns with confidence %, publish/review actions
- Distribution chart: area chart showing knowledge growth over time
- Module coverage breakdown: horizontal bar chart showing % coverage by module

---

<a id="e8"></a>
## EPIC E8 — Attachments, Notes & Record Links

### Epic Context

Three cross-cutting panels that appear on EVERY record detail/document page via the Action Bar's persistent tools zone. These are reusable components, not standalone pages.

**Sidebar location:** None — these are embedded components

---

### Component 1: Attachment Panel

**Container:** Sheet (slide-out from right, 400px)
**Trigger:** 📎 icon button in Action Bar persistent tools
**Story:** E8.S4

```
┌─────────────────────────────────────────────────────────┐
│ Attachments (3)                                [✕ Close]│
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│   📁 Drop files here or click to browse                  │
│      Max 25MB per file                                   │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 📄 Invoice-Scan.pdf                    12 KB       │   │
│ │    Uploaded by Sarah · 2h ago          [⬇] [🗑]   │   │
│ ├────────────────────────────────────────────────────┤   │
│ │ 📷 Receipt-Photo.jpg                   2.4 MB      │   │
│ │    Uploaded by Mike · 1d ago           [⬇] [🗑]   │   │
│ ├────────────────────────────────────────────────────┤   │
│ │ 📊 Budget-Breakdown.xlsx               48 KB       │   │
│ │    Uploaded by Sarah · 3d ago          [⬇] [🗑]   │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Upload Progress ────────────────────────────────────  │
│ │ Uploading report.pdf  ████████░░  78%               │  │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Drag-and-drop zone with dashed border (`border-dashed border-2 border-border`)
- File list: icon (by MIME type), name, size, uploader, timestamp, download + delete buttons
- Upload progress bar (purple `#7c3aed` fill)
- MIME type icons: PDF (red), image (blue), spreadsheet (green), document (purple), generic (grey)
- Image files: show thumbnail preview on hover
- Empty state: "No attachments yet. Drag files here to attach them."

---

### Component 2: Notes Panel

**Container:** Sheet (slide-out from right, 400px) OR inline section on detail page
**Trigger:** 💬 icon button in Action Bar persistent tools (or Notes tab)
**Story:** E8.S4

```
┌─────────────────────────────────────────────────────────┐
│ Notes (5)                                      [✕ Close]│
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Add a note...                                      │   │
│ │ ┌──────────────────────────────────────────────┐   │   │
│ │ │ Type something...                             │   │   │
│ │ └──────────────────────────────────────────────┘   │   │
│ │ Type: [General ▼]  [Internal] [Customer Visible]   │   │
│ │                                        [Post Note] │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Timeline (newest first) ────────────────────────────  │
│                                                          │
│ 📌 Sarah · 10 min ago                          [Unpin]  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Customer confirmed payment will be made by Friday. │   │
│ │ [INTERNAL]                                         │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ 🤖 System · 2h ago                                       │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Invoice emailed to accounts@customer.co.uk         │   │
│ │ [SYSTEM]                                           │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ Mike · Yesterday                                         │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Spoke to customer about the balance. They'll pay   │   │
│ │ after the 15th. Follow up next week.               │   │
│ │ [GENERAL]                                [📌] [✎]  │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Add note form: textarea + note type selector (chips/radio: General, Internal, Customer Visible)
- Note timeline: reverse chronological, pinned notes always at top
- Note card: author avatar/icon, name, timestamp, content, type badge
- Note types: GENERAL (no badge), INTERNAL (amber badge), CUSTOMER_VISIBLE (blue badge), SYSTEM (grey, italic, robot icon)
- Pinned notes: pin icon in corner, "Pinned" indicator, always sorted to top
- System notes: read-only, grey background, robot icon, cannot be edited/deleted
- Actions: Pin/Unpin, Edit (own notes only), Delete (own notes or MANAGER role)

---

### Component 3: Record Links Panel

**Container:** Sheet (slide-out from right, 400px)
**Trigger:** 🔗 icon button in Action Bar persistent tools
**Story:** E8.S4

```
┌─────────────────────────────────────────────────────────┐
│ Record Links (4)                               [✕ Close]│
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [+ Link Record]                                          │
│                                                          │
│ ── Created From ───────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 📋 Sales Quote SQ-00012        £8,500    [→ Open]  │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Fulfils ────────────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 📦 Delivery Note DN-00003      Delivered  [→ Open] │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Payment ────────────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 💳 Payment PAY-00091           £4,250    [→ Open]  │   │
│ │ 💳 Payment PAY-00098           £4,250    [→ Open]  │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Related ────────────────────────────────────────────  │
│ (none)                                                   │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Links grouped by type: Created From, Fulfils, Payment For, Credit For, Related, Parent/Child
- Each link card: entity icon, type+number (JetBrains Mono), key value (amount/status), "Open" button
- "Link Record" dialog: entity type dropdown + search input (autocomplete) + link type selector
- System-created links (CREATED_FROM, FULFILLS, PAYMENT_FOR) show lock icon — cannot be deleted by STAFF
- Manual links (RELATES_TO) can be deleted by creator
- Empty group sections are hidden (don't show empty "Related" heading)

---

<a id="e9"></a>
## EPIC E9 — Notifications

### Epic Context

Real-time notification system with bell icon in header, notification centre dropdown, and preferences settings page.

**Sidebar location:** None for bell (header component). Preferences under System > Notification Preferences.

---

### Component 1: Notification Bell + Dropdown

**Container:** Popover from header bell icon
**Trigger:** 🔔 icon in header bar (right section)
**Story:** E9.S2

```
┌──────────────────────────────────┐
│ 🔔 ③                            │  ← Bell with unread count badge
└──────┬───────────────────────────┘
       ▼
┌──────────────────────────────────────────┐
│ Notifications                [Mark All Read]│
├──────────────────────────────────────────┤
│                                          │
│ ● NEW ─────────────────────────────────  │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ 📋 Invoice INV-00234 approved      │   │
│ │ Sarah approved your invoice        │   │
│ │ 5 min ago                  [Dismiss]│   │
│ └────────────────────────────────────┘   │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ ⚠️ Payment overdue: CUST-00045    │   │
│ │ Acme Ltd has £12,400 overdue       │   │
│ │ 1h ago                     [Dismiss]│   │
│ └────────────────────────────────────┘   │
│                                          │
│ ● EARLIER ─────────────────────────────  │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ ✅ Payroll run completed            │   │
│ │ March payroll processed — 24 slips │   │
│ │ Yesterday              [✓ Read]    │   │
│ └────────────────────────────────────┘   │
│                                          │
│ [View All Notifications →]               │
└──────────────────────────────────────────┘
```

**Components needed:**
- Bell icon with animated red badge (count > 0), pulse animation on new notification
- Popover dropdown (max-height with scroll), 380px wide
- Notification card: icon (by category), title (bold), description, relative time, dismiss button
- Grouped: "New" (unread, white background) and "Earlier" (read, slightly muted)
- Priority levels: URGENT (red left border + toast), HIGH (amber left border), NORMAL (no border), LOW (no border)
- Click notification → navigate to linked entity
- "Mark All Read" button at top
- Real-time updates via WebSocket (new notifications slide in at top with animation)
- Toast notifications for URGENT/HIGH priority (appears top-right, auto-dismiss 6s for HIGH, persistent for URGENT)

---

### Screen 1: Notification Preferences

**Template:** T7 — Settings
**Route:** `/system/notification-preferences`
**Story:** E9.S4

```
┌─────────────────────────────────────────────────────────┐
│ System > Notification Preferences                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Configure how and when you receive notifications.        │
│                                                          │
│ ── Invoice Events ─────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Event                 │ In-App │ Email  │ Push     │   │
│ │ ───────────────────── │ ────── │ ────── │ ──────── │   │
│ │ Invoice Approved      │ [✓]    │ [✓]    │ [ ]      │   │
│ │ Invoice Overdue       │ [✓]    │ [✓]    │ [✓]      │   │
│ │ Payment Received      │ [✓]    │ [ ]    │ [ ]      │   │
│ │ Credit Note Created   │ [✓]    │ [ ]    │ [ ]      │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Task Events ────────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Task Assigned to Me   │ [✓]    │ [✓]    │ [✓]      │   │
│ │ Task Completed        │ [✓]    │ [ ]    │ [ ]      │   │
│ │ Task Overdue          │ [✓]    │ [✓]    │ [ ]      │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── System Events ──────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Permission Changed    │ [✓]    │ [✓]    │ [ ]      │   │
│ │ Import Completed      │ [✓]    │ [ ]    │ [ ]      │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ [Reset to Defaults]                           [Save]     │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Matrix grid: rows = event types (grouped by module), columns = channels (In-App, Email, Push)
- Each cell: Checkbox toggle
- Module sections: collapsible groups (Invoice Events, Task Events, System Events, etc.)
- "Reset to Defaults" button restores role-based defaults
- Save triggers immediate update (optimistic UI)
- Disabled checkboxes for mandatory notifications (e.g., security events always in-app)

---

<a id="e10"></a>
## EPIC E10 — Email Integration

### Epic Context

Email template management and document-to-email composition dialog for sending invoices, POs, statements as PDF attachments.

**Sidebar location:** System > Email Templates

---

### Screen 1: Email Template Editor

**Template:** T7 — Settings with editor
**Route:** `/system/email-templates/:id`
**Story:** E10.S2

```
┌─────────────────────────────────────────────────────────┐
│ [← Back] Email Template: Sales Invoice     [Preview] [Save]│
├──────────────────────────┬──────────────────────────────┤
│ ── Editor ────────────── │ ── Live Preview ───────────  │
│                          │                              │
│ Name: [Sales Invoice   ] │ ┌────────────────────────┐  │
│ Document Type: [Invoice] │ │ Subject:                │  │
│ Language: [en ▼]         │ │ Invoice INV-00234 from  │  │
│                          │ │ Acme Ltd                │  │
│ Subject:                 │ │                         │  │
│ [Invoice {{number}} from │ │ Dear Mr Smith,          │  │
│  {{company_name}}       ]│ │                         │  │
│                          │ │ Please find attached    │  │
│ Body (HTML):             │ │ invoice INV-00234 for   │  │
│ ┌────────────────────┐   │ │ £4,250.00.              │  │
│ │ Dear {{contact}},  │   │ │                         │  │
│ │                    │   │ │ Payment is due by       │  │
│ │ Please find attach │   │ │ 15 March 2026.          │  │
│ │ ed invoice {{numb  │   │ │                         │  │
│ │ er}} for {{total}} │   │ │ Kind regards,           │  │
│ │                    │   │ │ Acme Ltd                │  │
│ │ Payment due:       │   │ │                         │  │
│ │ {{due_date}}.      │   │ └────────────────────────┘  │
│ │                    │   │                              │
│ │ {{signature}}      │   │ Variables Available:         │
│ └────────────────────┘   │ • number, total, due_date   │
│                          │ • contact, company_name     │
│ Variable Autocomplete:   │ • signature, bank_details   │
│ {{cursor triggers list}} │                              │
├──────────────────────────┴──────────────────────────────┤
│ Version: 3  │  Last edited: 2h ago by Sarah              │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Split-pane: left = form + code editor (HTML with Handlebars syntax highlighting), right = rendered preview
- Subject line with variable support (same `{{` autocomplete)
- Available variables panel: list of valid variables for selected document type
- Preview updates on keystroke (debounced 500ms)
- "Preview" button shows rendered email with sample data in dialog
- Version badge in footer

---

### Component 1: Email Composition Dialog

**Container:** Dialog (centered modal, 600px wide)
**Trigger:** "Email" action in Action Bar overflow menu or Document Actions
**Story:** E10.S3

```
┌─────────────────────────────────────────────────────────┐
│ Send Invoice INV-00234 via Email                 [✕]     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ From: [accounts@acme.co.uk ▼]                            │
│ To:   [accounts@customer.co.uk          ] [+ Add]        │
│ Cc:   [                                 ] [+ Add]        │
│                                                          │
│ Subject: [Invoice INV-00234 from Acme Ltd           ]    │
│                                                          │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Dear Mr Smith,                                     │   │
│ │                                                    │   │
│ │ Please find attached invoice INV-00234 for         │   │
│ │ £4,250.00 dated 1 March 2026.                      │   │
│ │                                                    │   │
│ │ Payment is due by 15 March 2026.                   │   │
│ │                                                    │   │
│ │ Kind regards,                                      │   │
│ │ Acme Ltd                                           │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ Attachments:                                             │
│ 📄 Invoice-INV-00234.pdf (auto-generated)        [✕]    │
│ [+ Attach File]                                          │
│                                                          │
│ Template: [Sales Invoice ▼]    [Reset to Template]       │
│                                                          │
│                              [Cancel]  [Send Email]      │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Pre-filled from email template (auto-resolved variables from record data)
- From: dropdown of company email aliases
- To: pre-filled from customer/supplier contact email, multi-email with chips
- Cc/Bcc: collapsible, multi-email
- Rich text editor for body (or plain text toggle)
- Auto-generated PDF attachment shown with remove option
- Additional file attachments via file picker
- Template selector: switch templates, "Reset" repopulates from template
- Send button: shows loading state, success toast with "View in Sent" link

---

<a id="e11"></a>
## EPIC E11 — Cross-cutting Tasks

### Epic Context

Task management embedded in every record page. "My Tasks" standalone page. Task notifications.

**Sidebar location:** Main > My Tasks

---

### Component 1: Task Panel (embedded in record pages)

**Container:** Tab or Section within T2/T3 detail pages
**Story:** E11.S2

```
┌─────────────────────────────────────────────────────────┐
│ Tasks (3)                                  [+ Add Task]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌────────────────────────────────────────────────────┐   │
│ │ [ ] Chase payment — overdue 3 days         🔴 HIGH │   │
│ │     Assigned: Sarah, Mike · Due: 28 Feb            │   │
│ │     [Start] [Complete]                             │   │
│ ├────────────────────────────────────────────────────┤   │
│ │ [◐] Review credit terms                    🟡 NORMAL│   │
│ │     Assigned: Sarah · Due: 5 Mar                   │   │
│ │     [Complete]                                     │   │
│ ├────────────────────────────────────────────────────┤   │
│ │ [✓] Send welcome email                    ✅ Done  │   │
│ │     Completed by Mike · 1d ago                     │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 1: My Tasks Page

**Template:** T1 — Entity List
**Route:** `/tasks`
**Story:** E11.S2

```
┌─────────────────────────────────────────────────────────┐
│ My Tasks                                                 │
├─────────────────────────────────────────────────────────┤
│ [All] [Open] [In Progress] [Overdue]   [+ Create Task]  │
├─────────────────────────────────────────────────────────┤
│ □ │ Task               │ Priority │ Due     │ Record    │
│ ──│ ────────────────── │ ──────── │ ─────── │ ───────── │
│ □ │ Chase payment       │ 🔴 HIGH  │ Overdue │ INV-00234│
│ □ │ Review credit terms │ 🟡 NORMAL│ 5 Mar   │ CUST-0045│
│ □ │ Prepare Q1 report   │ 🔵 LOW   │ 15 Mar  │ —        │
│ □ │ Update supplier addr│ 🟡 NORMAL│ 10 Mar  │ SUP-0012 │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Task list with status icon (checkbox: open=empty, in-progress=half, completed=check, cancelled=X)
- Priority badges: URGENT (red), HIGH (red), NORMAL (amber), LOW (blue)
- Overdue indicator: red text + "Overdue" badge
- Record link: click entity code navigates to that record
- Quick actions: click checkbox to toggle status (Open→In Progress→Completed)
- Filters: status chips, priority dropdown, date range, overdue toggle
- Batch actions: select multiple + "Complete All" / "Reassign"
- "Create Task" dialog: title, description, priority, due date, assignees (multi-select users), optional entity link
- Task detail: click task row → Sheet with full detail, status timeline, edit fields

---

<a id="e12"></a>
## EPIC E12 — Document Templates & PDF

### Epic Context

Admin page for managing Handlebars HTML document templates with preview and version history.

**Sidebar location:** System > Document Templates

---

### Screen 1: Document Template Manager

**Template:** T7 — Settings (list + editor)
**Route:** `/system/document-templates`
**Story:** E12.S2

```
┌─────────────────────────────────────────────────────────┐
│ System > Document Templates                              │
├─────────────────────────────────────────────────────────┤
│ Search templates...                    [+ New Template]  │
│                                                          │
│ ── Invoice Templates ──────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Sales Invoice          │ Default │ v3    │ [Edit]  │   │
│ │ Credit Note            │ Default │ v2    │ [Edit]  │   │
│ │ Proforma Invoice       │ Default │ v1    │ [Edit]  │   │
│ │ Customer Statement     │ Default │ v1    │ [Edit]  │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Purchase Templates ─────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Purchase Order         │ Default │ v2    │ [Edit]  │   │
│ │ Goods Receipt Note     │ Default │ v1    │ [Edit]  │   │
│ │ Supplier Remittance    │ Default │ v1    │ [Edit]  │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Payroll Templates ──────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Payslip                │ Default │ v1    │ [Edit]  │   │
│ │ P45                    │ Default │ v1    │ [Edit]  │   │
│ │ P60                    │ Default │ v1    │ [Edit]  │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

Click Edit → Template Editor:

```
┌─────────────────────────────────────────────────────────┐
│ [← Back] Template: Sales Invoice        [Preview] [Save] │
├──────────────────────────┬──────────────────────────────┤
│ ── HTML Editor ───────── │ ── PDF Preview ───────────── │
│                          │                              │
│ Settings:                │ ┌────────────────────────┐  │
│ Page: [A4 ▼]             │ │ ┌──────────────────┐   │  │
│ Orientation: [Portrait]  │ │ │   ACME LTD       │   │  │
│ Show Logo: [✓]           │ │ │   Invoice        │   │  │
│ Show Bank: [✓]           │ │ │                  │   │  │
│ Show VAT: [✓]            │ │ │   To: Customer   │   │  │
│                          │ │ │   INV-00234      │   │  │
│ ┌────────────────────┐   │ │ │   Date: 1/3/26   │   │  │
│ │ <div class="head"> │   │ │ │                  │   │  │
│ │   {{#if showLogo}} │   │ │ │   Items:         │   │  │
│ │   <img src="{{log  │   │ │ │   Widget  £4,250 │   │  │
│ │   o}}"/>           │   │ │ │                  │   │  │
│ │   {{/if}}          │   │ │ │   Total: £4,250  │   │  │
│ │   <h1>INVOICE</h1> │   │ │ │                  │   │  │
│ │   ...              │   │ │ │   Bank: Sort...  │   │  │
│ │ </div>             │   │ │ └──────────────────┘   │  │
│ └────────────────────┘   │ └────────────────────────┘  │
│                          │                              │
│ Versions: v1 v2 [v3]    │ Variables:                    │
│           [View Diff]    │ number, date, customer_name  │
│                          │ lines[], total, vat, bank    │
└──────────────────────────┴──────────────────────────────┘
```

**Components needed:**
- Template list grouped by document category (Invoices, Purchases, Payroll)
- Split-pane editor: left = settings + HTML code editor, right = PDF preview (rendered from Handlebars)
- Code editor: HTML + Handlebars syntax highlighting, `{{` autocomplete for variables
- PDF preview: shows rendered A4-sized preview (scaled to fit), refreshes on change (debounced)
- Settings panel: page size (A4/Letter), orientation, toggle switches for logo/bank/VAT
- Version selector: version pills, diff view between versions
- "Preview" button: opens full-size PDF in new tab/dialog

---

<a id="e13"></a>
## EPIC E13 — Printer Management

### Epic Context

Print preferences per document type (user-level and company-level) and print action components.

**Sidebar location:** System > Print Preferences

---

### Screen 1: Print Preferences

**Template:** T7 — Settings
**Route:** `/system/print-preferences`
**Story:** E13.S1

```
┌─────────────────────────────────────────────────────────┐
│ System > Print Preferences                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Choose what happens when you save or approve a document. │
│                                                          │
│ ── Your Preferences (overrides company defaults) ──────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Document Type       │ On Save Action               │   │
│ │ ──────────────────  │ ──────────────────────────── │   │
│ │ Sales Invoice       │ [Auto Download PDF ▼]        │   │
│ │ Credit Note         │ [Open Print Dialog  ▼]       │   │
│ │ Sales Order         │ [Do Nothing         ▼]       │   │
│ │ Purchase Order      │ [Auto Download PDF ▼]        │   │
│ │ Delivery Note       │ [Open Print Dialog  ▼]       │   │
│ │ Payslip             │ [Do Nothing         ▼]       │   │
│ │ Customer Statement  │ [Auto Download PDF ▼]        │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Company Defaults (Admin only) ──────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Sales Invoice       │ [Auto Download PDF ▼]        │   │
│ │ Credit Note         │ [Do Nothing         ▼]       │   │
│ │ ...                                                │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ [Reset to Company Defaults]                   [Save]     │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Two sections: "Your Preferences" (all users) and "Company Defaults" (Admin only, collapsible)
- Each row: document type label + Select dropdown (Auto Download PDF, Open Print Dialog, Do Nothing)
- "Use Company Default" option in user dropdowns (inherits without override)
- Reset button clears all user overrides
- Save is instant (optimistic UI with toast)

---

### Component 1: Print Action Trigger (invisible, integrated into record save flow)

**Story:** E13.S2

This is not a visible screen but a behaviour:
- On record save/approve, check user print preference for that document type
- If AUTO_DOWNLOAD: call `/documents/generate`, trigger browser file download
- If BROWSER_PRINT: call `/documents/generate`, load into hidden iframe, call `window.print()`
- Show loading toast: "Generating PDF..." with progress
- For batch operations: generate ZIP of all PDFs or sequential print dialogs
- Non-blocking: user can navigate away while PDF generates

**Component needed:**
- `<PrintActionProvider>` — context provider wrapping record pages
- `usePrintAction(documentType)` — hook that returns `{ triggerPrint, isGenerating }`
- Loading toast with cancel option
- Batch print dialog: "Print 12 invoices?" with options [Download ZIP] [Print All] [Cancel]

---

<a id="e13b"></a>
## EPIC E13b — Platform Admin Portal

### Epic Context

**SEPARATE APPLICATION** — `apps/platform-admin`. Dark-themed admin portal for managing tenants, billing, AI usage, impersonation, and audit logs. Uses the **platform-api** database (not the tenant ERP database).

**Important:** This uses a DARK sidebar theme with "PLATFORM ADMIN" branding, distinct from the tenant ERP's white sidebar. The colour scheme shifts to darker tones while keeping purple as the accent.

### Platform Admin Design Tokens (overrides for this app only)

```
--sidebar-bg: #1e1b4b (dark indigo)
--sidebar-text: #e0e7ff (light indigo)
--sidebar-active: #7c3aed (purple, same as ERP)
--sidebar-active-text: #ffffff
--sidebar-hover: #312e81 (darker indigo)
--background: #f8fafc (light grey, not purple — professional admin feel)
--header-bg: #1e1b4b (matches sidebar)
--header-text: #ffffff
--accent: #7c3aed (purple)
```

**Navigation items:** Dashboard, Tenants, Plans, AI Usage, Billing, Support Console, Audit Log, Settings

---

### Screen 1: Platform Dashboard

**Template:** T5 — Dashboard
**Route:** `/dashboard`
**Story:** E13b.S1

```
┌─────────────────────────────────────────────────────────┐
│ PLATFORM ADMIN │ Dashboard                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ Tenants  │ │ Revenue  │ │ AI Usage │ │ Alerts   │    │
│ │ 247      │ │ £42,800  │ │ 2.1M tkn │ │ 3        │    │
│ │ Active   │ │ MRR      │ │ today    │ │ active   │    │
│ │ +12 MTD  │ │ +8% MoM  │ │ +15%     │ │ ⚠️ 2 crit│    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                          │
│ ┌────────────────────────┐ ┌────────────────────────┐   │
│ │ Tenant Health          │ │ Revenue Trend (12mo)   │   │
│ │ ● Active: 232         │ │ [area chart]            │   │
│ │ ● Suspended: 8        │ │                         │   │
│ │ ● Read-Only: 5        │ │                         │   │
│ │ ● Provisioning: 2     │ │                         │   │
│ │ [donut chart]         │ │                         │   │
│ └────────────────────────┘ └────────────────────────┘   │
│                                                          │
│ ── Recent Alerts ──────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ ⚠️ Acme Corp — AI quota 92% used (soft limit)     │   │
│ │ ⚠️ Beta Inc — Payment overdue (Dunning Level 2)   │   │
│ │ ℹ️ Gamma Ltd — New tenant provisioned             │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 2: Tenant List

**Template:** T1 — Entity List
**Route:** `/tenants`
**Story:** E13b.S2

```
┌─────────────────────────────────────────────────────────┐
│ Tenants                              [+ Provision Tenant]│
├─────────────────────────────────────────────────────────┤
│ Search tenants...        [Active ▼] [Plan ▼] [Billing ▼]│
├─────────────────────────────────────────────────────────┤
│ Tenant          │ Plan    │ Users │ Status    │ Billing  │
│ ──────────────  │ ─────── │ ───── │ ───────── │ ──────── │
│ Acme Corp       │ Pro     │ 45    │ ● Active  │ Current  │
│ Beta Inc        │ Core    │ 12    │ ● Active  │ ⚠️ Overdue│
│ Gamma Ltd       │ Enterprise│ 120 │ ● Active  │ Current  │
│ Delta Co        │ Core    │ 8     │ ◐ Suspended│ Blocked │
│ Epsilon Ltd     │ Pro     │ 0     │ ◌ Provisioning│ —    │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 3: Tenant Detail

**Template:** T2 — Record Detail (tabbed)
**Route:** `/tenants/:id`
**Story:** E13b.S2

```
┌─────────────────────────────────────────────────────────┐
│ [← Back] Acme Corp                                       │
│ Status: ● Active  │  Plan: Pro  │  Since: Jan 2025      │
│                                                          │
│ [Overview] [Modules] [Users] [AI Usage] [Billing] [Audit]│
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ── Overview Tab ───────────────────────────────────────  │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │ Companies   │ │ Users       │ │ AI Tokens   │        │
│ │ 3           │ │ 45/50       │ │ 180K/250K   │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
│                                                          │
│ Connection: db-prod-01:5432/acme_corp                    │
│ Created: 15 Jan 2025  │  Last Login: 2h ago              │
│                                                          │
│ ── Actions ────────────────────────────────────────────  │
│ [Suspend Tenant] [Change Plan] [Impersonate ▼]          │
│                                                          │
│ ── Modules & Flags Tab ────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Module              │ Plan Default │ Override      │   │
│ │ ──────────────────  │ ──────────── │ ───────────── │   │
│ │ Finance             │ ✓ Included   │ —             │   │
│ │ Manufacturing       │ ✗ Not in plan│ [Enable ▼]    │   │
│ │ HR/Payroll          │ ✓ Included   │ [Disable ▼]   │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ Feature Flags:                                           │
│ ┌────────────────────────────────────────────────────┐   │
│ │ AI Co-Pilot         │ [✓ Enabled]                  │   │
│ │ Document AI         │ [✓ Enabled]                  │   │
│ │ Beta: Voice Input   │ [ Disabled]                  │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 4: AI Usage Dashboard

**Template:** T8 — Report
**Route:** `/ai-usage`
**Story:** E13b.S4

```
┌─────────────────────────────────────────────────────────┐
│ AI Usage                                    [Export CSV]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Period: [Last 30 Days ▼]                                 │
│                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ Total    │ │ Cost     │ │ Avg/Day  │ │ Tenants  │    │
│ │ 12.4M    │ │ £2,340   │ │ 413K     │ │ 198      │    │
│ │ tokens   │ │ estimate │ │ tokens   │ │ active   │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                          │
│ ── Usage by Feature ───────────────────────────────────  │
│ [horizontal bar chart: Chat 45%, Doc AI 30%, Briefing 15%, Other 10%]│
│                                                          │
│ ── Daily Trend ────────────────────────────────────────  │
│ [line chart: 30-day token usage with provider breakdown] │
│                                                          │
│ ── Top Consumers ──────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Tenant          │ Tokens  │ Cost    │ Quota % │ Alert│  │
│ │ ──────────────  │ ─────── │ ─────── │ ─────── │ ───  │  │
│ │ Acme Corp       │ 1.2M    │ £220    │ 92%     │ ⚠️   │  │
│ │ Gamma Ltd       │ 890K    │ £165    │ 68%     │      │  │
│ │ Beta Inc        │ 450K    │ £84     │ 45%     │      │  │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Alerts ─────────────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ ⚠️ Acme Corp: Soft quota limit reached (92%)      │   │
│ │ ⚠️ Delta Co: Usage spike detected (3x average)    │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 5: Billing Overview

**Template:** T8 — Report
**Route:** `/billing`
**Story:** E13b.S3

```
┌─────────────────────────────────────────────────────────┐
│ Billing                                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ MRR      │ │ Active   │ │ Overdue  │ │ Churn    │    │
│ │ £42,800  │ │ 232      │ │ 8        │ │ 1.2%     │    │
│ │ +8% MoM  │ │ tenants  │ │ tenants  │ │ monthly  │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                          │
│ ── Revenue by Plan ────────────────────────────────────  │
│ [stacked bar chart: Core, Pro, Enterprise over 12 months]│
│                                                          │
│ ── Enforcement Distribution ───────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ None (Current)  ████████████████████████  218      │   │
│ │ Warning         ████                     8         │   │
│ │ Read-Only       ██                       4         │   │
│ │ Suspended       █                        2         │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Overdue Tenants ────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Tenant     │ Plan │ Dunning │ Grace    │ Action   │   │
│ │ ─────────  │ ──── │ ─────── │ ──────── │ ──────── │   │
│ │ Beta Inc   │ Core │ Level 2 │ 5 days   │ [Enforce]│   │
│ │ Zeta Ltd   │ Pro  │ Level 1 │ 12 days  │ [Warn]   │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 6: Support Console

**Template:** Custom (search-first layout)
**Route:** `/support`
**Story:** E13b.S5

```
┌─────────────────────────────────────────────────────────┐
│ Support Console                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 🔍 Search tenant by name, domain, email, or ID... │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Search Results ─────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Acme Corp (acme.nexa.app)                          │   │
│ │ Status: ● Active │ Plan: Pro │ 45 users            │   │
│ │ [View Details] [Impersonate] [View Audit Log]      │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Active Impersonation Sessions ──────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Admin: j.smith@nexa.app                            │   │
│ │ Tenant: Beta Inc │ Reason: Billing investigation   │   │
│ │ Started: 14:30 │ Expires: 15:30 │ [End Session]    │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Impersonation Dialog ───────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Impersonate: Acme Corp                             │   │
│ │                                                    │   │
│ │ Reason: [                              ] (required)│   │
│ │ Duration: [60 minutes ▼]                           │   │
│ │                                                    │   │
│ │ ⚠️ This will open the tenant's ERP as a logged-in │   │
│ │    user. All actions will be dual-logged.          │   │
│ │                                                    │   │
│ │                    [Cancel]  [Start Impersonation]  │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 7: Audit Log Viewer

**Template:** T1 — Entity List
**Route:** `/audit-log`
**Story:** E13b.S6

```
┌─────────────────────────────────────────────────────────┐
│ Audit Log                                   [Export CSV]  │
├─────────────────────────────────────────────────────────┤
│ [Action ▼] [Target Type ▼] [Admin ▼] [Date Range]       │
├─────────────────────────────────────────────────────────┤
│ Timestamp        │ Admin        │ Action        │ Target │
│ ────────────────│ ──────────── │ ───────────── │ ────── │
│ 14:32 Today      │ j.smith      │ impersonate   │ Acme   │
│ 14:15 Today      │ m.jones      │ suspend       │ Delta  │
│ 12:00 Today      │ j.smith      │ update_plan   │ Beta   │
│ 09:45 Today      │ m.jones      │ toggle_module │ Gamma  │
│ Yesterday 16:20  │ j.smith      │ create_tenant │ Epsilon│
└─────────────────────────────────────────────────────────┘
```

Click row → Detail view:
```
┌────────────────────────────────────────────────────────┐
│ Audit Entry Detail                              [✕]     │
├────────────────────────────────────────────────────────┤
│ Timestamp: 2026-03-02 14:15:00 UTC                     │
│ Admin: m.jones@nexa.app                                │
│ Action: suspend_tenant                                 │
│ Target: Delta Co (tenant-uuid)                         │
│ IP: 185.24.68.102                                      │
│ User Agent: Chrome 124/macOS                           │
│                                                        │
│ ── Changes ────────────────────────────────────────── │
│ ┌──────────────────────────────────────────────────┐  │
│ │ Field    │ Before      │ After                   │  │
│ │ status   │ ACTIVE      │ SUSPENDED               │  │
│ │ reason   │ —           │ "Payment overdue 30d"   │  │
│ └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

**Components needed:**
- Filterable log table with action-type badges (colour-coded)
- Date range picker for time-based filtering
- Detail Sheet showing full JSON payload, before/after diff
- CSV export of filtered results
- Action types: create, update, delete, suspend, reactivate, archive, impersonate, toggle_module, update_plan
- Immutable: no edit/delete actions on audit entries

---

### Impersonation Banner (ERP-side component)

**Container:** Fixed bar at top of ERP app (above header)
**Story:** E13b.S5

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ SUPPORT SESSION: j.smith@nexa.app viewing Acme Corp │
│    Expires in 42:18  │  All actions are logged          │
│                                        [End Session]     │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Non-dismissable amber/warning banner (`bg-amber-500 text-white`)
- Shows: admin email, tenant name, countdown timer (mm:ss), "End Session" button
- Countdown: live ticking, flashes red at < 5 minutes
- Position: fixed top, z-50, pushes all content down
- Cannot be hidden, closed, or scrolled away
- Shown in the TENANT ERP app (not platform admin)

---

## Summary: Component Inventory

| Epic | New Pages | New Components | Template Types |
|------|-----------|----------------|----------------|
| E5c | 5 pages | Step builder, Cron builder, Flow visualizer, Test trigger | T1, T4, T5 |
| E5d | 2 pages | Knowledge upload, Chunk viewer, Pattern table | T1, T8 |
| E8 | 0 pages | AttachmentPanel, NotesPanel, LinksPanel (3 Sheets) | Sheet |
| E9 | 1 page | NotificationBell, NotificationDropdown, Preference matrix | T7, Popover |
| E10 | 1 page | Email template editor, Email compose dialog | T7, Dialog |
| E11 | 1 page | TaskPanel (embedded), My Tasks list | T1, Section |
| E12 | 1 page | Document template editor with PDF preview | T7 |
| E13 | 1 page | Print preferences, PrintActionProvider (invisible) | T7 |
| E13b | 7 pages | Dark admin shell, Impersonation dialog/banner, Provider key mgmt | T1, T2, T5, T8 |
| **Total** | **19 pages** | **~25 components** | |
