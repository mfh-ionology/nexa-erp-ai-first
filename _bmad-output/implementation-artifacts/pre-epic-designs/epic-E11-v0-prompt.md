# Epic E11 — Cross-cutting Tasks: v0 Prompt

> **Usage:** Paste the **Design System Base** from `epic-E5-E5b-v0-prompt.md`
> (lines 1–185) FIRST, then append the epic-specific section below.

---

## EPIC-SPECIFIC SECTION: E11 — Cross-cutting Tasks

### Epic Context

Task management system embedded across the entire ERP. Users can create tasks from any business record, assign to colleagues, track status, and manage from a centralised "My Tasks" page. Tasks appear as an embedded panel on every record detail page.

**Sidebar location:** Main section > My Tasks (below Dashboard, above module groups)

---

### Screen 1: My Tasks Page

**Template:** T1 — Entity List
**Route:** `/tasks`
**Story:** E11.S2

```
┌─────────────────────────────────────────────────────────────────┐
│ ☑ My Tasks                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ [All (12)] [Open (5)] [In Progress (4)] [Overdue (3)]            │
│                                                                   │
│ Search tasks...    [Priority ▾] [Due Date ▾]   [+ Create Task]   │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│ □  │ Task                    │ Priority  │ Status      │ Due       │ Record     │ Assignees      │
│ ── │ ─────────────────────── │ ───────── │ ─────────── │ ───────── │ ────────── │ ────────────── │
│ ○  │ Chase Acme for payment  │ 🔴 HIGH   │ ○ Open      │ ⚠ Overdue │ INV-00234  │ 👤 Sarah, Mike │
│ ◐  │ Review credit terms     │ 🟡 NORMAL │ ◐ Progress  │ 5 Mar     │ CUST-0045  │ 👤 Sarah       │
│ ○  │ Prepare Q1 report       │ 🔵 LOW    │ ○ Open      │ 15 Mar    │ —          │ 👤 Me          │
│ ◐  │ Update supplier address │ 🟡 NORMAL │ ◐ Progress  │ 10 Mar    │ SUP-0012   │ 👤 David       │
│ ○  │ Follow up on quotation  │ 🔴 URGENT │ ○ Open      │ ⚠ Overdue │ SQ-00089   │ 👤 Mike        │
│ ✓  │ Send welcome email      │ 🟡 NORMAL │ ✓ Done      │ 1 Mar     │ CUST-0032  │ 👤 Mike        │
│ ✕  │ Cancelled task example  │ 🔵 LOW    │ ✕ Cancelled │ —         │ —          │ 👤 Sarah       │
└─────────────────────────────────────────────────────────────────┘

Batch action bar (appears on row selection):
┌─────────────────────────────────────────────────────────────────┐
│ 3 selected    [Complete All]  [Reassign...]  [Cancel]  [Clear]   │
└─────────────────────────────────────────────────────────────────┘
```

**Status icon key:**
- `○` = Open (empty circle/checkbox)
- `◐` = In Progress (half-filled circle)
- `✓` = Completed (green checkmark)
- `✕` = Cancelled (grey X)

**Priority badge colours:**
- URGENT: solid red badge (`bg-red-100 text-red-800`)
- HIGH: red outline badge (`border-red-300 text-red-700`)
- NORMAL: amber badge (`bg-amber-100 text-amber-800`)
- LOW: blue badge (`bg-blue-100 text-blue-800`)

**Overdue indicator:** Red "Overdue" text + warning icon on due date cell when task is past due and not completed/cancelled.

**Record column:** Clickable entity code (e.g. `INV-00234`) that navigates to that record's detail page. Dash (—) if task has no linked entity.

**Components needed:**
- `<TaskStatusIcon status="OPEN|IN_PROGRESS|COMPLETED|CANCELLED">` — interactive, click cycles status
- `<TaskPriorityBadge priority="LOW|NORMAL|HIGH|URGENT">` — colour-coded badge
- `<TaskOverdueBadge>` — red overdue indicator with warning icon
- `<EntityLink entityType="CustomerInvoice" entityId="uuid" code="INV-00234">` — clickable code link
- Status tab chips at top — filterable, show count in parentheses
- Standard T1 EntityListPage search + filter bar
- Batch action bar on row selection

**Responsive:**
- Desktop: Full table with all columns visible
- Tablet: Hide Assignees column, compress Priority to icon only
- Phone: Card layout — each task as a card with title, priority badge, due date, status icon. Swipe actions for status change.

---

### Screen 2: Create Task Dialog

**Template:** Dialog (centered modal, 560px wide)
**Trigger:** "+ Create Task" button on My Tasks, or "+ Add Task" in Task Panel
**Story:** E11.S2

```
┌─────────────────────────────────────────────────────┐
│ Create Task                                    [✕]   │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Title *                                               │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Chase Acme Ltd for outstanding payment          │   │
│ └─────────────────────────────────────────────────┘   │
│                                                       │
│ Description                                           │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Follow up on invoice INV-00234 which is 15 days │   │
│ │ overdue. Contact accounts@acme.co.uk            │   │
│ └─────────────────────────────────────────────────┘   │
│                                                       │
│ Priority                    Due Date                  │
│ ┌──────────────────┐        ┌──────────────────┐      │
│ │ High           ▾ │        │ 📅 10 Mar 2026   │      │
│ └──────────────────┘        └──────────────────┘      │
│                                                       │
│ Assignees                                             │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 👤 Sarah Chen [✕]  👤 Mike Davis [✕]  [Search…] │   │
│ └─────────────────────────────────────────────────┘   │
│                                                       │
│ Linked Record                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 📄 Invoice INV-00234 — Acme Ltd           [✕]   │   │
│ └─────────────────────────────────────────────────┘   │
│ (pre-filled when created from a record's Task Panel)  │
│                                                       │
├─────────────────────────────────────────────────────┤
│              [Cancel]  [Create & Add Another] [Create] │
└─────────────────────────────────────────────────────┘
```

**Components needed:**
- Form with Zod validation (title required, 1-255 chars)
- Priority Select: Low, Normal (default), High, Urgent
- Date picker (Calendar + Popover) for due date
- `<UserMultiSelect>` — Combobox searching users in the company, shows avatar + name chips
- `<EntityLinkChip>` — Read-only chip when entity is pre-linked (from Task Panel context)
- Two submit buttons: "Create" (close dialog) and "Create & Add Another" (keep open, clear fields)

**Responsive:**
- Desktop/Tablet: Modal dialog as shown
- Phone: Full-screen Sheet (bottom slide-up) instead of centered dialog

---

### Screen 3: Task Detail Sheet

**Template:** Sheet (slide-in from right, 480px wide)
**Trigger:** Click task row in My Tasks page or Task Panel
**Story:** E11.S2

```
┌──────────────────────────────────────────────┐
│ Task Detail                             [✕]   │
├──────────────────────────────────────────────┤
│                                                │
│ ┌────────────────────────────────────────────┐ │
│ │ Chase Acme Ltd for outstanding payment  ✏️ │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ Status: ○ Open                                 │
│ ┌──────────────────────────────────────┐       │
│ │ [▶ Start]  [✓ Complete]  [✕ Cancel]  │       │
│ └──────────────────────────────────────┘       │
│                                                │
│ ── Details ──────────────────────────────────  │
│                                                │
│ Description                                    │
│ ┌────────────────────────────────────────────┐ │
│ │ Follow up on invoice INV-00234 which is    │ │
│ │ 15 days overdue. Contact accounts@acme...  │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ Priority        │ Due Date                     │
│ [🔴 High    ▾]  │ [📅 10 Mar 2026]             │
│                                                │
│ ── Assignees ────────────────────────────────  │
│ 👤 Sarah Chen                          [✕]    │
│ 👤 Mike Davis                          [✕]    │
│ [+ Add Assignee]                               │
│                                                │
│ ── Linked Record ────────────────────────────  │
│ 📄 Invoice INV-00234 — Acme Ltd        [→]    │
│                                                │
│ ── Activity ─────────────────────────────────  │
│ ┌────────────────────────────────────────────┐ │
│ │ ○──── Created by Mohammed · 2 Mar 14:30    │ │
│ │ │                                          │ │
│ │ ○──── Assigned to Sarah · 2 Mar 14:30      │ │
│ │ │                                          │ │
│ │ ○──── Assigned to Mike · 3 Mar 09:15       │ │
│ └────────────────────────────────────────────┘ │
│                                                │
├────────────────────────────────────────────────┤
│ Created: 2 Mar 2026 14:30 by Mohammed          │
│                                                │
│ [🗑 Delete Task]                                │
└────────────────────────────────────────────────┘
```

**Status action buttons change based on current status:**
- **OPEN:** Show [Start] [Complete] [Cancel]
- **IN_PROGRESS:** Show [Complete] [Cancel]
- **COMPLETED:** Show greyed out "Completed ✓" with completedAt timestamp
- **CANCELLED:** Show greyed out "Cancelled" — no actions

**Components needed:**
- `<TaskStatusActions status currentStatus>` — renders context-sensitive action buttons
- `<TaskTimeline entries>` — vertical timeline of status changes, assignments, etc.
- Inline-edit fields for title, description (click to edit, press Enter/Escape)
- Priority Select dropdown
- Date picker for due date
- Assignee list with remove (X) and "+ Add Assignee" using UserMultiSelect
- Entity link with navigation arrow (→) to open source record
- Delete button with confirmation AlertDialog

**Responsive:**
- Desktop/Tablet: 480px Sheet from right
- Phone: Full-screen Sheet (bottom slide-up)

---

### Component 4: Task Panel (embedded in record detail pages)

**Container:** Tab section or collapsible card within T2/T3 detail pages
**Props:** `entityType: string, entityId: string`
**Story:** E11.S2

```
┌─────────────────────────────────────────────────────────┐
│ Tasks (3)                                  [+ Add Task]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌────────────────────────────────────────────────────┐   │
│ │ ○ Chase payment — overdue 3 days          🔴 HIGH  │   │
│ │   👤 Sarah, Mike · Due: 28 Feb                     │   │
│ │   [▶ Start]  [✓ Complete]                          │   │
│ ├────────────────────────────────────────────────────┤   │
│ │ ◐ Review credit terms                   🟡 NORMAL  │   │
│ │   👤 Sarah · Due: 5 Mar                            │   │
│ │   [✓ Complete]                                     │   │
│ ├────────────────────────────────────────────────────┤   │
│ │ ✓ Send welcome email                     ✅ Done   │   │
│ │   Completed by Mike · 1d ago                       │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Completed (1) ──────────────────────── [▾ Collapse]   │
│ ┌────────────────────────────────────────────────────┐   │
│ │ ✓ Initial setup complete                 ✅ Done   │   │
│ │   Completed by Sarah · 5d ago                      │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ Empty state (when no tasks):                             │
│ ┌────────────────────────────────────────────────────┐   │
│ │         ☑                                          │   │
│ │   No tasks for this record                         │   │
│ │   [+ Add Task]                                     │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Queries `/tasks?entityType=X&entityId=Y` for this specific record
- Active tasks (Open, In Progress) shown first, sorted by due date
- Completed/Cancelled tasks collapsed by default under "Completed (N)" section
- Overdue tasks show red "overdue X days" indicator
- Click task title → opens Task Detail Sheet
- "+ Add Task" → opens Create Task Dialog with entityType+entityId pre-filled
- Quick status actions inline: Start, Complete buttons
- Count in header updates on status changes

**Components needed:**
- `<TaskPanel entityType entityId>` — main container, handles data fetching
- `<TaskPanelItem task onStatusChange>` — compact row with status icon, title, meta, actions
- Reuses: `<TaskStatusIcon>`, `<TaskPriorityBadge>`, `<TaskOverdueBadge>`

**Responsive:**
- Desktop/Tablet: Full panel as shown
- Phone: Simplified — hide action buttons, tap row to open detail Sheet

---

### Component 5: Tasks Today Card (Briefing Dashboard Update)

**Container:** Existing `<BottomCards>` component on Dashboard
**Route:** `/` (Dashboard)
**Story:** E11.S2

```
Current (mock data):                    After (real API data):
┌─────────────────────┐                ┌─────────────────────────────┐
│ ☑ Tasks Today       │                │ ☑ Tasks Today (4)           │
│ ☐ Chase Acme...     │                │ ○ Chase Acme payment  🔴    │
│ ☐ Review pricing    │                │ ○ Review credit terms 🟡    │
│ ☐ Approve POs       │                │ ◐ Approve POs         🟡    │
└─────────────────────┘                │ ○ Follow up quotation 🔴    │
                                       │                             │
                                       │ View all tasks →            │
                                       └─────────────────────────────┘
```

**Components needed:**
- Update existing `bottom-cards.tsx` to fetch from `/tasks/my?status=OPEN,IN_PROGRESS&dueDate=today`
- Reuse `<TaskStatusIcon>` for inline status toggle
- "View all tasks →" link navigates to `/tasks`
- Empty state: "No tasks due today — you're all clear!"

---

## Generation Instructions

Generate all screens listed above as React components using:
- Shadcn UI components (all already installed — see page inventory)
- Tailwind CSS 4 classes
- TypeScript
- Lucide React icons (CheckCircle2, Circle, CircleDot, XCircle, AlertTriangle, Plus, Calendar, Users, ExternalLink, Trash2, Play, Check, X, ChevronDown, Search, Flag)

For each screen, provide:
1. The main page/dialog/sheet component
2. All sub-components listed under "Components needed"
3. Mock data that demonstrates the layout with realistic UK ERP data (company names like Acme Ltd, Baxter & Co; GBP amounts; realistic invoice/PO codes)

Ensure:
- Page background is `#f4f2ff` throughout
- All cards use 12px radius and purple-tinted hover shadow
- Amounts use JetBrains Mono font
- Status badges use the semantic colour palette defined in the base
- Priority badges: URGENT/HIGH=red variants, NORMAL=amber, LOW=blue
- Overdue dates shown in red with warning icon
- All animations use fadeInUp/slideIn/stepIn as specified
- Loading states use skeleton patterns, not spinners
- Empty states have illustration + message + CTA
- Focus rings use `ring-2 ring-[#7c3aed]/30` on all interactive elements
- Task status icons are interactive (clickable to cycle status)
- Entity code links use monospace font (JetBrains Mono) and purple hover colour
- The overall feel is premium and polished — NOT generic SaaS
- Sheet and Dialog use the `stepIn` animation on open
- Task Panel is a self-contained component that can be dropped into any record detail page
