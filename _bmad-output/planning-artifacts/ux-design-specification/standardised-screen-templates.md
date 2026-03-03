# Standardised Screen Templates

Every screen in Nexa follows one of eight templates. Each template defines the page structure, the action bar layout, and the responsive behaviour. Developers never invent screen layouts — they pick the correct template and populate it with module-specific content.

## Screen Template Inventory

| Template | Use Count | Examples |
|----------|-----------|---------|
| **T1: Entity List** | ~30 screens | Invoice List, Customer List, Item List, Journal List, PO List |
| **T2: Record Detail** | ~30 screens | Customer Detail, Supplier Detail, Employee Detail, Item Detail |
| **T3: Header+Lines Document** | ~18 screens | Invoice, Sales Order, Purchase Order, Journal Entry, Credit Note, Delivery Note, Quotation, Goods Receipt |
| **T4: Briefing** | 1 screen | The Briefing (home screen) |
| **T5: Board/Kanban** | ~3 screens | CRM Pipeline, Production Schedule, Leave Calendar |
| **T6: Wizard** | ~5 screens | Company Setup, Payroll Run, Month-End Close, Bank Import, Year-End |
| **T7: Settings** | ~12 screens | Company Settings, Module Settings, User Preferences, Chart of Accounts Setup |
| **T8: Report** | ~15 screens | Trial Balance, Aged Debtors, VAT Return, Sales Analysis, P&L, Balance Sheet |

## T1: Entity List Template

```
┌─────────────────────────────────────────────────────────────┐
│ App Header (56px)                                            │
│  [N] logo │ Search 🔍 │ [🔔] [★ Favourites] [Avatar]       │
├─────────────────────────────────────────────────────────────┤
│ Page Header                                                  │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Breadcrumb: Module > Entity Type                        │  │
│ │ Title: "Invoices"          [+ New] [AI ✦] [⋯ More]     │  │
│ │                                                         │  │
│ │ Toolbar Row:                                            │  │
│ │ [Saved View ▾] │ Search 🔍 │ [Views & Columns]         │  │
│ │                              [Filter & Sort] (badge: 3) │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ ☐ │ Number ↕ │ Customer  │ Date  ↕ │ Amount  │ Status  │  │
│ │───┼──────────┼───────────┼─────────┼─────────┼─────────│  │
│ │ ☐ │ INV-0047 │ Acme Ltd  │ 15 Feb  │ £4,250  │ ● ⏳   │  │
│ │ ☐ │ INV-0046 │ Beta Inc  │ 14 Feb  │ £1,800  │ ● ✓    │  │
│ │ ☐ │ INV-0045 │ Gamma Co  │ 12 Feb  │ £12,400 │ ● ⚠    │  │
│ │   │     ↕ drag to resize column borders ↕               │  │
│ │              [Load More]                                 │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ Batch Action Bar (appears when rows selected):               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ 3 selected  [Approve All] [Export] [⋯ More]  [✕]       │  │
│ └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### T1 Toolbar Buttons

Two dedicated buttons replace the single settings cog:

1. **[Views & Columns]** — Opens a modal/slideout with two tabs:
   - **Views Tab:** Grouped sections (My Views, Team Views, Global Views). Star toggle, edit/delete on hover, "Set as Default" radio, "Save Current View" (only when a named view is loaded), "Save as New View" button
   - **Columns Tab:** Checkbox list with drag-handle reorder, pin toggle (L/R). Column widths are NOT set here — they are adjusted by dragging column borders on the table itself

2. **[Filter & Sort]** — Opens a wider modal (~640px) with two tabs:
   - **Filters Tab:** Toggle between Simple and Advanced mode
     - **Simple Mode:** Vertical field list (only fields with `filterable=true`). Each field shows a searchable multi-select dropdown. Date fields use a preset dropdown (from `date_range_presets` table) with CUSTOM option for date pickers
     - **Advanced Mode:** AND/OR toggle, condition rows (field/operator/value), group bracketing with `( )` for complex logic. All fields available (including `advancedFilterOnly=true`)
   - **Sort Tab:** Priority-numbered rules, drag reorder, direction toggle (ASC/DESC)

Both buttons show badge counts when active (e.g., "3" for 3 active filters).

### T1 Saved View Selector

A dropdown in the toolbar row that shows the currently active view name. Lists available views grouped by scope:
- **My Views** (PERSONAL)
- **Team Views** (ROLE-scoped)
- **Global Views** (admin-created)

Selecting a view loads its complete configuration: filters, sort, and column layout.

### T1 Header Favourites (★)

A star icon in the **app header** (NOT in the page header) — visible on every page. Click opens a dropdown of starred views from ALL data_views, grouped by `groupName` (e.g., "Invoices", "Sales", "CRM"). Clicking a favourite navigates to that entity list with the saved view applied.

### T1 List Actions
- **Always visible:** `[+ New]` (primary, hidden if user lacks `canNew` permission for this resource), `[AI ✦]` (AI command input), `[⋯ More]` (overflow)
- **Overflow menu:** Export CSV, Export Excel, Print List
- **Batch actions:** Appear in sticky bar when rows selected — actions depend on entity type and user permissions (Approve, Delete, Change Status, Export Selected). Batch Delete is hidden if user lacks `canDelete` permission.

### T1 Column Behaviour
- **Drag-resize:** Users drag column border handles on the table to resize. Width persists to `user_column_preferences` (or `saved_views.column_config` when a view is active)
- **Pinning:** Left/right sticky columns with shadow indicator during horizontal scroll
- **Sort:** Click column header to cycle sort direction (ASC → DESC → none). Sort indicator (↕) shown on sortable columns
- **Metadata-driven:** All columns, filters, sort options, and LOV dropdowns are auto-generated from `data_view_fields` — zero custom UI code per entity type

## T2: Record Detail Template

```
┌─────────────────────────────────────────────────────────┐
│ Page Header                                              │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Breadcrumb: Module > Entity Type > Record Name      │  │
│ │ Title: "Acme Ltd"  StatusBadge: ● Active            │  │
│ │                                                     │  │
│ │ Action Bar:                                         │  │
│ │ [Save] [Cancel]  [📎 Attach] [🔗 Links]  [⋯ More]  │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Tabs: [Primary] [Details] [Financial] [History]     │  │
│ │─────────────────────────────────────────────────────│  │
│ │                                                     │  │
│ │  Company Name: [Acme Ltd          ]                 │  │
│ │  Contact:      [John Smith        ]                 │  │
│ │  Email:        [john@acme.co.uk   ]                 │  │
│ │  Phone:        [+44 20 7946 0958  ]                 │  │
│ │  Address:      [123 Business Park ]                 │  │
│ │                                                     │  │
│ │  ── Related Entities ──────────────────────         │  │
│ │  Recent Invoices (3)  |  Open Orders (1)            │  │
│ │  Contacts (4)         |  Activity Log               │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ EventFlowTracker (if applicable)                    │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## T3: Header+Lines Document Template

```
┌─────────────────────────────────────────────────────────┐
│ Page Header                                              │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Breadcrumb: Finance > Invoices > INV-2026-0047      │  │
│ │ Title: "Invoice INV-2026-0047"  StatusBadge: ● Draft│  │
│ │                                                     │  │
│ │ Action Bar:                                         │  │
│ │ [Approve] [Save Draft] [Cancel]                     │  │
│ │ [📎 Attach] [🔗 Links]  [⋯ More]                    │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ HEADER SECTION                                      │  │
│ │ Tabs: [Main] [Terms] [Delivery] [Custom Fields]     │  │
│ │─────────────────────────────────────────────────────│  │
│ │  Customer: [Acme Ltd ▾      ]   Date: [15/02/2026] │  │
│ │  Currency: [GBP ▾]   Due Date: [17/03/2026]        │  │
│ │  Reference: [PO-ACM-2026-03]   Payment: [Net 30 ▾] │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ LINE ITEMS                               [+ Add Line]│  │
│ │─────────────────────────────────────────────────────│  │
│ │ # │ Item        │ Desc      │ Qty │ Price  │ Total  │  │
│ │ 1 │ WDG-001     │ Widgets   │ 100 │ £25.00 │£2,500  │  │
│ │ 2 │ WDG-002     │ Gadgets   │  50 │ £35.00 │£1,750  │  │
│ │ [+ Add Line]                                        │  │
│ │─────────────────────────────────────────────────────│  │
│ │                          Subtotal:     £4,250.00    │  │
│ │                          VAT (20%):      £850.00    │  │
│ │                          Total:        £5,100.00    │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ EventFlowTracker: [Quote] → [SO ✓] → [DN ✓] → ►INV│  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## T4: Briefing (Dashboard) Template

The Briefing is the authenticated home screen. It provides a personalised overview of the business with KPI metrics, charts, tasks, and recent activity.

```
┌─────────────────────────────────────────────────────────┐
│ Greeting & Date                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ "Good morning, Sarah"                               │  │
│ │ Monday, 17 February 2026                            │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ KPI Cards (3-column grid, responsive to 2-col / 1-col)  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│ │ Icon+Lbl │ │ Icon+Lbl │ │ Icon+Lbl │                  │
│ │ £347,200 │ │ £127,400 │ │ £89,300  │                  │
│ │ +11% ▲   │ │ +29% ▲   │ │ -12% ▼   │                  │
│ │ ~~~~~~~~ │ │ ~~~~~~~~ │ │ ~~~~~~~~ │  (sparklines)    │
│ └──────────┘ └──────────┘ └──────────┘                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│ │ Overdue  │ │ Pipeline │ │ Margin   │                  │
│ │ 7        │ │ £215,000 │ │ 34.2%    │                  │
│ │ +75% ▲   │ │ +14% ▲   │ │ -2.6pp ▼ │                  │
│ │ ~~~~~~~~ │ │ ~~~~~~~~ │ │ ~~~~~~~~ │                  │
│ └──────────┘ └──────────┘ └──────────┘                  │
│                                                          │
│ Charts (2-column grid)                                   │
│ ┌─────────────────────┐ ┌─────────────────────┐         │
│ │ Revenue & Payments  │ │ Cash Flow Forecast   │         │
│ │ (bar chart)         │ │ (area chart + safety │         │
│ │                     │ │  threshold line)     │         │
│ └─────────────────────┘ └─────────────────────┘         │
│                                                          │
│ Bottom Cards (2-column grid)                             │
│ ┌─────────────────────┐ ┌─────────────────────┐         │
│ │ ☑ Tasks Today       │ │ 🕐 Recent Activity   │         │
│ │ ☐ Chase Acme...     │ │ SC Approved PO...    │         │
│ │ ☐ Review pricing    │ │ AI Matched payment   │         │
│ │ ☐ Approve POs       │ │ DM Posted journal    │         │
│ └─────────────────────┘ └─────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

**KPI Card Pattern (reusable element):**
Each KPI card contains: icon in coloured background circle, label, large mono-font value, trend badge (green/amber/red pill), comparison text, and SVG sparkline. The trend badge colour follows: green for positive trends, red for negative trends, amber for neutral/expected changes.

**Reference implementation:** `components/dashboard/kpi-cards.tsx`, `charts.tsx`, `bottom-cards.tsx` composed in `routes/_authenticated/index.tsx`. Currently uses static mock data — will be wired to real API endpoints in later epics.

## The Action Bar System

The action bar is the most critical consistency element across all screen templates. Every record screen (T2, T3, T5, T6, T7) uses the same action bar pattern.

**Action Bar Layout:**

```
┌─────────────────────────────────────────────────────────┐
│ [Primary Action]  [Secondary Actions...]                 │
│ [📎 Attachments (3)]  [🔗 Links (2)]  [⋯ More Actions]  │
└─────────────────────────────────────────────────────────┘
```

**Three zones:**

| Zone | Position | Visibility | Contents |
|------|----------|-----------|----------|
| **Primary Actions** | Left | Always visible | 1-2 most important actions for current status (e.g., Approve, Save) |
| **Persistent Tools** | Centre-right | Always visible | Attachments (with count badge), Links (with count badge) |
| **Overflow Menu** | Far right | Always visible (⋯ button) | All other actions, grouped by category |

**Always-Visible Actions (present on every record screen):**

| Action | Icon | Behaviour | Notes |
|--------|------|-----------|-------|
| **Save** / **Save Draft** | — | Primary button (purple) | Label changes based on entity status |
| **Cancel** / **Back** | — | Ghost button | Returns to previous context |
| **Attachments** | 📎 | Opens attachment panel | Badge shows count; upload via drag-drop or file picker |
| **Links** | 🔗 | Opens linked records panel | Shows related entities; add manual links |
| **More Actions** | ⋯ | Opens overflow dropdown menu | Grouped by category (see below) |

**Overflow Menu Structure (⋯ More Actions):**

The overflow menu groups actions into logical sections with dividers. Only applicable actions appear — irrelevant actions are hidden, not disabled.

```
┌──────────────────────────────┐
│ Document Actions              │
│   📄 Print                    │
│   📧 Email                    │
│   📥 Export PDF               │
│   📋 Duplicate                │
│───────────────────────────────│
│ Status Actions                │
│   ✓ Approve                  │  ← Only if status allows
│   ✕ Reject                   │  ← Only if status allows
│   ⊘ Void                     │  ← Only if status allows
│   🔒 Close                   │  ← Only if status allows
│───────────────────────────────│
│ Record Actions                │
│   ✏️ Edit (if read-only view) │
│   🔄 Convert to Invoice      │  ← Context-dependent
│   📦 Create Delivery Note    │  ← Context-dependent
│   🗑️ Delete                   │  ← Only for Draft status
│───────────────────────────────│
│ AI Actions                    │
│   ✦ AI Explain This Record   │
│   ✦ AI Suggest Improvements  │
│   ✦ AI Find Similar          │
│───────────────────────────────│
│ History                       │
│   📜 View Audit Log          │
│   🕐 Status Timeline         │
└──────────────────────────────┘
```

**Action Bar Rules:**

1. **Status-driven and permission-driven visibility** — Actions in the overflow menu appear/hide based on **two independent checks**: (a) the entity's current status (only valid state machine transitions are shown) and (b) the user's access group permissions (only actions where the corresponding `canNew`/`canEdit`/`canDelete` flag is true are shown). Both checks must pass for an action to appear. A posted invoice cannot be "Approved" again (status check). A user without `canDelete` permission cannot see the Delete option even on a Draft record (permission check). Fields may also be hidden or rendered read-only based on `AccessGroupFieldOverride` entries for the user's access groups.

2. **Primary action changes with status** — For a Draft invoice, the primary action is "Approve." For an Approved invoice, it's "Email to Customer." For a Paid invoice, there is no primary action (just the persistent tools). The action bar adapts.

3. **Maximum 2 primary actions** — Never more than 2 visible action buttons (excluding persistent tools and overflow). If there are competing primary actions (e.g., Approve and Reject on an approval screen), both are visible — Approve as primary (purple), Reject as destructive (red).

4. **Persistent tools never hide** — Attachments and Links are always visible on every record screen, even if the count is zero. This teaches users that every record supports attachments and links.

5. **Overflow sections hide when empty** — If there are no valid Status Actions for the current state, that entire section is hidden from the overflow menu. No empty groups, no disabled items.

6. **Keyboard shortcut hints** — Overflow menu items show keyboard shortcuts where available (e.g., "Print ⌘P", "Save ⌘S"). Primary actions also respond to keyboard shortcuts.

**Action Bar by Template:**

| Template | Primary Action(s) | Overflow Sections |
|----------|-------------------|-------------------|
| **T1: Entity List** | `[+ New]`, `[AI ✦]` | Export, Print, Manage Columns, Manage Views |
| **T2: Record Detail** | Status-dependent (Save / Edit) | Document, Status, Record, AI, History |
| **T3: Header+Lines** | Status-dependent (Approve / Save Draft) | Document, Status, Record, AI, History |
| **T5: Board** | `[+ New Card]` | Export, Filter, Board Settings |
| **T6: Wizard** | `[Next Step]` / `[Complete]` | Save Progress, Cancel Wizard |
| **T7: Settings** | `[Save Settings]` | Reset to Defaults, Export Config, Import Config |
| **T8: Report** | `[Run Report]` | Export PDF, Export Excel, Schedule, Save Parameters |

## T8: Report Template

```
┌─────────────────────────────────────────────────────────┐
│ Page Header                                              │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Breadcrumb: Reports > Aged Debtors                  │  │
│ │ Title: "Aged Debtors Report"                        │  │
│ │                                                     │  │
│ │ Action Bar:                                         │  │
│ │ [Run Report]  [⋯ More]                              │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ PARAMETERS                                          │  │
│ │  As at Date: [17/02/2026]  Currency: [GBP ▾]       │  │
│ │  Customer:   [All ▾]       Aging: [30/60/90/120 ▾]  │  │
│ │  Include Zero Balances: [ ]   Show Detail: [✓]      │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ AI Summary:                                         │  │
│ │ "Total receivables £284K. 12% overdue (£34K).       │  │
│ │  Acme Ltd accounts for 45% of overdue balance.      │  │
│ │  Overdue trend: ↓8% vs last month."                 │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ RESULTS                                             │  │
│ │ Customer  │ Current │ 30 Days │ 60 Days │ 90+ │Total│  │
│ │───────────┼─────────┼─────────┼─────────┼─────┼─────│  │
│ │ Acme Ltd  │ £8,200  │ £12,400 │ £3,100  │  —  │£23.7│  │
│ │ Beta Inc  │ £4,500  │   —     │   —     │  —  │£4.5K│  │
│ │                                                     │  │
│ │                    Total: £284,350.00                │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Screen Template Responsive Behaviour

| Template | Phone (375px) | Tablet (768px) | Desktop (1024px) |
|----------|--------------|----------------|-----------------|
| **T1: List** | Cards instead of table rows; search + filter at top; `[+ New]` as FAB | Table with priority columns; full action bar | Full table; all columns; inline batch actions |
| **T2: Detail** | Stacked fields; action bar collapses to `[Save]` + `[⋯]`; tabs become accordion | Single-column form; full action bar | Multi-column form; related entities in side panel |
| **T3: Header+Lines** | Header fields stacked; line items as cards; sticky `[Approve]` at bottom | Header single-column; line items in narrow table | Full layout as shown in wireframe |
| **T5: Board** | Single column visible; swipe between columns | 3 columns visible; scroll for more | All columns visible |
| **T6: Wizard** | Full-width steps; progress bar at top | Centered content with step sidebar | Side step nav + centered content |
| **T7: Settings** | Stacked sections; accordion collapse | Single-column form | Two-column form (label left, input right) |
| **T8: Report** | Parameters collapsible; results as cards; AI summary prominent | Parameters visible; table results | Full layout as shown in wireframe |

## Design System Components (from Shadcn UI)

**Foundation components used directly from Shadcn UI:**

| Component | Shadcn Name | Nexa Usage |
|-----------|-------------|-----------|
| Button | `button` | Primary (purple), secondary (outline), destructive (red), ghost |
| Input | `input` | All text inputs, with custom confidence indicator overlay |
| Select | `select` | Dropdown selections, searchable for large lists |
| Textarea | `textarea` | Description fields, notes, AI input area |
| Checkbox | `checkbox` | Batch selection, boolean fields, filter options |
| Radio Group | `radio-group` | Exclusive option selection (payment method, entity type) |
| Switch | `switch` | Toggle settings, boolean preferences |
| Tabs | `tabs` | Form tabbed layout (primary/secondary/tertiary field groups) |
| Dialog | `dialog` | Confirmation dialogs, quick-edit modals |
| Sheet | `sheet` | Side panels for related entity preview, AI suggestions |
| Popover | `popover` | Inline details, quick actions, field suggestions |
| Tooltip | `tooltip` | "AI suggested because..." explanations, field help |
| Card | `card` | Briefing items, dashboard cards, list items |
| Table | `table` | Entity lists, line items, data grids |
| Badge | `badge` | Status indicators (customised with semantic colours) |
| Toast | `toast` (Sonner) | Success/error/info notifications (auto-dismiss) |
| Command | `command` | AI command palette (Cmd+K) |
| Calendar | `calendar` | Date pickers, date range selection |
| Dropdown Menu | `dropdown-menu` | Action menus, context menus |
| Breadcrumb | `breadcrumb` | Module → Entity → Record navigation |
| Progress | `progress` | Upload progress, month-end checklist progress |
| Skeleton | `skeleton` | Loading placeholders for cards, tables, forms |
| Separator | `separator` | Section dividers within forms and panels |
| Scroll Area | `scroll-area` | Scrollable panels, sidebar navigation |

## Custom Components

**Tier 1 — Core ERP Components (Story 0–1):**

**`<StatusBadge>`**
- **Purpose:** Display any entity's status with semantic colour, icon, and label
- **Props:** `status: string`, `entityType: string`, `size: 'sm' | 'md' | 'lg'`, `showIcon: boolean`
- **Behaviour:** Looks up status in config map → resolves to semantic category → renders Badge with correct colour + icon
- **Config-driven:** Adding a new entity type requires only a config entry, not component changes
- **States:** Default, animated (pulse on transition), interactive (click to see status history)
- **Accessibility:** ARIA label describes status in full ("Invoice status: Awaiting Approval")

**`<StatusTimeline>`**
- **Purpose:** Show status history for any entity with timestamps and user attribution
- **Props:** `entityId: string`, `entityType: string`, `compact: boolean`
- **Behaviour:** Vertical timeline with coloured dots matching `<StatusBadge>` colours, timestamps, user names
- **Embedded in:** Entity detail views, side panels

**`<EventFlowTracker>`**
- **Purpose:** Horizontal visualisation of cross-module business process lifecycle
- **Props:** `flowType: 'order-to-cash' | 'procure-to-pay' | ...`, `currentEntityId: string`
- **Behaviour:** Shows chain of entities (Quote → SO → DN → INV → Payment) with status badges, clickable nodes to navigate to each entity
- **States:** Current entity highlighted (purple), completed entities (green), pending (grey), error (red)
- **Accessibility:** ARIA role="navigation" with labels for each step

**`<HeaderLinesForm>`**
- **Purpose:** Generic header + line items layout for all 18 document types (invoices, POs, journals, credit notes, etc.)
- **Props:** `entityType: string`, `schema: ZodSchema`, `lineItemSchema: ZodSchema`, `aiPrefilled: boolean`
- **Behaviour:** Header fields in tabbed layout, line items in editable table below, totals row auto-calculated
- **Variants:** Full (desktop), compact (tablet), read-only (approval view)
- **AI integration:** When `aiPrefilled=true`, all fields show confidence indicators

**`<EntityList>`**
- **Purpose:** Sortable, filterable, paginated table for any entity type
- **Props:** `entityType: string`, `columns: ColumnDef[]`, `savedViews: SavedView[]`
- **Features:** Column sorting, multi-filter, search, cursor-based pagination ("Load More"), batch select, saved views dropdown, export
- **AI integration:** Natural language filter ("show overdue invoices over £1,000") via AI command input

**Tier 2 — AI Components (Story 2–3):**

**`<ConfidenceIndicator>`**
- **Purpose:** Show AI confidence level on any form field
- **Props:** `confidence: number`, `reason: string`, `fieldId: string`
- **Behaviour:** Coloured dot (green/amber/red) next to field, expandable tooltip with reasoning
- **Interaction:** Click dot to see "AI suggested because..." explanation

**`<AICommandInput>`**
- **Purpose:** Natural language input for AI interactions
- **Props:** `placeholder: string`, `onSubmit: (intent: string) => void`, `streaming: boolean`
- **Behaviour:** Text input with streaming response display, suggestion chips, recent commands
- **Variants:** Header bar (always visible), command palette modal (Cmd+K), inline (within form)

**`<DocumentViewer>`**
- **Purpose:** Side-by-side original document + extracted data display
- **Props:** `documentUrl: string`, `extractedFields: ExtractedField[]`, `onApprove: () => void`
- **Behaviour:** Left panel: PDF/image with bounding boxes highlighting extracted regions. Right panel: form with confidence indicators on each field.

**`<BriefingCard>`**
- **Purpose:** Individual briefing item with period comparison and one-tap action
- **Props:** `item: BriefingItem`, `onAction: (action: string) => void`
- **Content:** Title, value with delta/trend, contextual description, primary action button
- **Variants:** KPI card (with sparkline), action card (with approve/reject), alert card (with severity)

**Tier 3 — Supporting Components (Story 3+):**

**`<NotificationCentre>`**
- **Purpose:** Notification panel with 3-tier display
- **Props:** `notifications: Notification[]`, `unreadCount: number`
- **Behaviour:** Bell icon with badge count, dropdown panel with tabs (All/Actions/Mentions), inline action buttons

**`<RealtimeIndicator>`**
- **Purpose:** Show that data is live/stale and who else is viewing
- **Props:** `lastUpdated: Date`, `activeUsers: User[]`
- **Behaviour:** Green dot for live, amber for >30s stale, user avatars for concurrent viewers

**`<PeriodComparison>`**
- **Purpose:** Display any metric with period-over-period comparison
- **Props:** `current: number`, `previous: number`, `label: string`, `format: 'currency' | 'number' | 'percent'`
- **Behaviour:** Shows current value, delta arrow (↑↓), percentage change, coloured (green for positive, red for negative)

**`<SavedViewSelector>`**
- **Purpose:** Dropdown to switch between saved views for an entity list
- **Props:** `entityType: string`, `views: SavedView[]`, `activeView: string`
- **Behaviour:** Dropdown with star/unstar, create new, edit, delete. AI can create views from natural language.

## Component Implementation Strategy

**Build sequence follows story dependencies:**

| Phase | Story | Components Built |
|-------|-------|-----------------|
| Foundation | Story 0 | All Shadcn base components installed + theme configured |
| Core | Story 1 | `<StatusBadge>`, `<StatusTimeline>`, `<EntityList>`, `<HeaderLinesForm>` |
| System | Story 1b | `<SavedViewSelector>`, `<NotificationCentre>`, `<RealtimeIndicator>` |
| AI | Story 2 | `<AICommandInput>`, `<ConfidenceIndicator>`, `<BriefingCard>`, `<PeriodComparison>` |
| Documents | Story 3 | `<DocumentViewer>`, `<EventFlowTracker>` |
| All modules | Story 4+ | Compose above components into module-specific pages |

**Component file structure:**
```
src/
  components/
    ui/           # Shadcn base components (Button, Card, Table, etc.)
    layout/       # Shell and navigation components
      app-layout.tsx        # AppShell (sidebar + header + content)
      app-sidebar.tsx       # Sidebar navigation
      app-header.tsx        # Header bar
      user-menu.tsx         # User avatar dropdown
      company-switcher.tsx  # Company selector
    header/       # Header sub-components
      UnifiedSearch.tsx     # Combined search + AI input
    dashboard/    # T4 Briefing components
      kpi-cards.tsx         # KPI card grid with sparklines
      charts.tsx            # Revenue & Cash Flow charts
      bottom-cards.tsx      # Tasks + Recent Activity
    templates/    # Reusable page templates
      data-table.tsx        # Generic data table component
      entity-list-page.tsx  # T1 Entity List template wrapper
      page-header.tsx       # Shared page header
      module-placeholder.tsx # Coming-soon module placeholder
    erp/          # Custom ERP components (planned — future epics)
      StatusBadge.tsx
      StatusTimeline.tsx
      EventFlowTracker.tsx
      HeaderLinesForm.tsx
      EntityList.tsx
      NotificationCentre.tsx
      RealtimeIndicator.tsx
    ai/           # AI-specific components (planned — future epics)
      AICommandInput.tsx
      ConfidenceIndicator.tsx
      DocumentViewer.tsx
      BriefingCard.tsx
```

**Reference implementations (E6-15):**
- Invoice list page: `features/ar/invoices/invoice-list-page.tsx` (T1 pattern)
- Invoice detail page: `features/ar/invoices/invoice-detail-page.tsx` (T3 pattern)
- User detail page: `features/admin/users/user-detail-page.tsx` (T2 variant)

These serve as visual design references for future business module epics. They use static mock data and demonstrate the Concept D visual treatment applied to each template type.
