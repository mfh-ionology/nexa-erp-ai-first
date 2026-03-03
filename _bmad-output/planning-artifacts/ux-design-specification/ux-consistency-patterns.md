# UX Consistency Patterns

## Button Hierarchy

| Level | Variant | Visual | Usage |
|-------|---------|--------|-------|
| **Primary** | `variant="default"` | Purple filled (#7c3aed), white text | One per page section: Approve, Save, Create |
| **Secondary** | `variant="outline"` | Purple border, purple text, transparent bg | Alternative actions: Save Draft, Export, Filter |
| **Destructive** | `variant="destructive"` | Red filled, white text | Irreversible actions: Delete, Void, Reject |
| **Ghost** | `variant="ghost"` | No border, purple text on hover | Tertiary actions: Cancel, Back, Clear |
| **Link** | `variant="link"` | Underlined purple text | Navigation: View Details, See More |

**Button rules:**
- Maximum 1 primary button per form section
- Destructive buttons require confirmation dialog
- "Approve" is always primary; "Reject" is always destructive
- Mobile: buttons are full-width at `sm` breakpoint
- Loading state: spinner replaces label, button disabled

## Feedback Patterns

**Toast Notifications (Sonner):**

| Type | Duration | Icon | Colour | Use Case |
|------|----------|------|--------|----------|
| Success | 4s auto-dismiss | Checkmark | Green border | Record created, action completed |
| Error | Persistent (dismiss button) | X-circle | Red border | Save failed, validation error |
| Warning | 6s auto-dismiss | Triangle-alert | Amber border | Approaching limit, stale data |
| Info | 4s auto-dismiss | Info circle | Blue border | Status changed, notification |
| Action | Persistent until acted | Custom | Purple border | "Undo" available for 30 seconds |

**Inline Feedback:**
- Field validation: appears below field on blur, red text with icon for errors, green checkmark for valid
- Form-level: banner at top of form for submission errors, scrolls to first error field
- Empty states: illustration + message + primary action ("No invoices yet. Create your first invoice.")
- Loading states: skeleton placeholders matching content shape, never spinners in content areas (spinners only for buttons and small indicators)

## Form Patterns

**Five form types (mapped to entity types):**

| Pattern | Type | Usage | Examples |
|---------|------|-------|---------|
| **A** | Simple Entity | Single-page form, <20 fields | Customer, Supplier, Item, Employee |
| **B** | Header + Lines | Tabbed header + line items table | Invoice, PO, SO, Journal, Credit Note, DN |
| **C** | Wizard | Multi-step for complex setup | Company Setup, Payroll Run, Period Close |
| **D** | Kanban Board | Column-based drag-and-drop | CRM Pipeline, Production Scheduling |
| **E** | Singleton Settings | Single-instance configuration | Company Settings, Module Settings |

**Form behaviour rules:**
- Auto-save to draft every 30 seconds (no explicit save needed for drafts)
- Unsaved changes warning on navigation away
- Tab key moves between fields; Enter submits on simple forms, moves to next field on Header+Lines
- Required fields marked with red asterisk (*); optional fields have no marker
- Field help: `?` icon opens tooltip with description from data model
- AI confidence indicators overlay standard form fields (same layout, added visual layer)

## Navigation Patterns

**Global Navigation:**
- **Sidebar** (desktop/tablet): Module icons + labels in flat grouped navigation (Main, Operations, Other, Admin), collapsed state shows icons only with tooltips. Groups are separated by uppercase group titles and optional dividers. Items are permission-filtered — only modules the user has access to appear.
- **Bottom tabs** (phone): 5 tabs: Briefing, Modules, AI, Notifications, Profile
- **Breadcrumbs**: Always visible below header: Module → Entity Type → Record Name
- **Command palette** (Cmd+K): Search entities, run AI commands, navigate to any page

**In-Page Navigation:**
- **Tabs** within forms: Primary, Details, History, Related — click any tab, non-linear
- **Side panel** (Sheet): Preview related entity without leaving current page — click entity link to open in side panel, click "Open Full" to navigate
- **Back button**: Browser back always works (React Router history); also explicit "Back to List" link

**Cross-Module Navigation:**
- Entity links (e.g., customer name on invoice) open side panel preview
- `<EventFlowTracker>` nodes are clickable — navigate to related entity
- Briefing items link directly to the relevant entity detail page
- Notification actions deep-link to the specific record requiring action

## Loading & Empty States

**Loading States:**
- **Page load**: Full skeleton matching page layout (sidebar + header + content skeletons)
- **Card load**: Individual card skeletons within existing layout
- **Table load**: Row skeletons with column widths matching header
- **AI processing**: Pulsing purple bar + "AI is preparing your invoice..." message
- **File upload**: Progress bar with percentage and file name

**Empty States:**
- **First use**: Welcoming illustration + "Get started" primary action + brief description
- **No results**: Search icon + "No matches found" + suggestion to broaden search
- **No data**: Module-specific illustration + "No invoices yet" + "Create Invoice" button
- **Error state**: Warning icon + clear error message + retry action + help link

## Table & List Patterns

**Entity list standard features:**
- Column sorting (click header, toggle asc/desc/none)
- Multi-column filtering (filter icon opens filter row below header)
- Search (text search across key columns)
- Cursor-based pagination ("Load More" button, never page numbers)
- Batch selection (checkbox column, "Select All" in header, batch action bar appears)
- Saved views (dropdown in toolbar: My Views, Shared Views, + Create View)
- Column customisation (gear icon: show/hide columns, reorder)
- Export (CSV, Excel — secondary action in toolbar)

**Row interactions:**
- Click row: navigate to entity detail page
- Hover row: subtle highlight (`#f5f3ff` at 50% opacity — `hover:bg-[#f5f3ff]/50`)
- Right-click row: context menu (View, Edit, Duplicate, Delete)
- Status badge: visible in first data column, colour-coded
