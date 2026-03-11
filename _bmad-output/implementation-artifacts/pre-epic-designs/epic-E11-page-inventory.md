# Epic E11 — Cross-cutting Tasks: Page Inventory

**Date:** 2026-03-04
**Epic:** E11 — Cross-cutting Tasks
**Dependencies:** E9 (Notifications — task event delivery), E5b (EntityListPage template)
**Status:** Pending Approval

---

## Page / Component Inventory

### 1. My Tasks Page

| Property | Value |
|----------|-------|
| **Type** | Full page |
| **Template** | T1 — Entity List |
| **Route** | `/tasks` |
| **Story** | E11.S2 |
| **Sidebar** | Main section > My Tasks (below Dashboard) |
| **Role** | VIEWER+ |

**Description:** Central task list showing all tasks assigned to the current user. Uses the standard EntityListPage template with status chip tabs (All / Open / In Progress / Overdue), priority badges, due date formatting with overdue highlighting, and linked entity codes that navigate to the source record. Default sort is due date ascending with overdue tasks first.

**Key Interactions:**
- Status chip tabs filter the list (All, Open, In Progress, Overdue)
- Click task row to open Task Detail Sheet (slide-in from right)
- Click entity code (e.g. INV-00234) to navigate to that record
- Click checkbox icon to quick-toggle status (Open → In Progress → Completed)
- "+ Create Task" primary button opens Create Task Dialog
- Batch select + "Complete All" or "Reassign" batch actions
- Filter bar: priority dropdown, date range picker, overdue toggle
- Search by task title

**Components Needed:**
- `<TaskStatusIcon>` — Checkbox-style icon (empty=Open, half-fill=In Progress, check=Completed, X=Cancelled)
- `<TaskPriorityBadge>` — Colour-coded badge (URGENT=red, HIGH=red outline, NORMAL=amber, LOW=blue)
- `<TaskOverdueBadge>` — Red "Overdue" badge + red due date text
- `<EntityLink>` — Clickable entity code that navigates to the source record (e.g. INV-00234 → /finance/invoices/uuid)

---

### 2. Create Task Dialog

| Property | Value |
|----------|-------|
| **Type** | Dialog modal (560px wide) |
| **Template** | Dialog (centered modal) |
| **Route** | N/A (triggered from "+ Create Task" button or "+ Add Task" in Task Panel) |
| **Story** | E11.S2 |
| **Trigger** | Primary action on My Tasks page, or "+ Add Task" button in Task Panel on any record |
| **Role** | STAFF+ |

**Description:** Modal for creating a new task. Fields: title (required), description (optional textarea), priority (select: Low/Normal/High/Urgent, default Normal), due date (date picker, optional), assignees (multi-select user combobox), and optional entity link (pre-filled when opened from a record's Task Panel). On submit, creates the task and notifies assignees.

**Key Interactions:**
- Title is required; other fields optional
- Priority defaults to NORMAL
- Assignees multi-select with user search/combobox
- When opened from Task Panel on a record, entityType+entityId pre-filled and shown as read-only chip
- "Create" button submits and closes, showing success toast
- "Create & Add Another" button submits but keeps dialog open with cleared fields

**Components Needed:**
- `<UserMultiSelect>` — Combobox with search for selecting multiple users as assignees
- `<EntityLinkChip>` — Read-only chip showing linked entity (e.g. "Invoice INV-00234")

---

### 3. Task Detail Sheet

| Property | Value |
|----------|-------|
| **Type** | Sheet (slide-in from right, 480px wide) |
| **Template** | Sheet |
| **Route** | N/A (triggered by clicking a task row in My Tasks or Task Panel) |
| **Story** | E11.S2 |
| **Role** | VIEWER+ |

**Description:** Right-side slide-in sheet showing full task detail with editable fields. Shows title, description, status with transition buttons, priority badge, due date, assignees with add/remove, linked entity with navigation link, created by, and timestamps. Status action buttons change based on current status (e.g. Open shows "Start" + "Complete", In Progress shows "Complete").

**Key Interactions:**
- Edit title and description inline (click to edit)
- Change priority via select dropdown
- Change due date via date picker
- Add/remove assignees via user multi-select
- Status action buttons: Start (Open→In Progress), Complete (→Completed), Cancel (→Cancelled)
- Click entity link to navigate to source record
- "Delete Task" in footer (destructive, with confirmation)

**Components Needed:**
- `<TaskStatusActions>` — Context-sensitive status transition buttons based on current status
- `<TaskTimeline>` — Compact timeline showing status changes with timestamps and who made them

---

### 4. Task Panel (embedded in record detail pages)

| Property | Value |
|----------|-------|
| **Type** | Embedded component (Tab or collapsible section) |
| **Template** | Section within T2/T3 detail pages |
| **Route** | N/A (embedded in existing record detail pages) |
| **Story** | E11.S2 |
| **Appears on** | All T2/T3 record detail pages (Customers, Invoices, POs, etc.) |
| **Role** | VIEWER+ |

**Description:** Compact task list embedded as a tab or section in every record detail page. Shows tasks linked to that specific entity (entityType + entityId). Displays task count in section header. Each task shows title, assignees, due date, priority badge, and quick action buttons. "+ Add Task" button opens Create Task Dialog with entityType/entityId pre-filled.

**Key Interactions:**
- Section header shows "Tasks (N)" with count
- "+ Add Task" opens Create Task Dialog with entity pre-linked
- Click task title to open Task Detail Sheet
- Quick status toggle via checkbox icon
- Overdue tasks highlighted with red indicator
- Completed tasks shown muted at bottom (collapsible)
- Empty state: "No tasks for this record" with "+ Add Task" CTA

**Components Needed:**
- `<TaskPanel>` — Container component accepting entityType + entityId props
- `<TaskPanelItem>` — Compact task row with status icon, title, assignees, due date, priority
- Reuses `<TaskStatusIcon>`, `<TaskPriorityBadge>`, `<TaskOverdueBadge>` from My Tasks page

---

### 5. Briefing Dashboard — Tasks Today Card (wiring)

| Property | Value |
|----------|-------|
| **Type** | Existing component update |
| **Template** | T4 — Briefing Dashboard (existing) |
| **Route** | `/` (Dashboard) |
| **Story** | E11.S2 |
| **Role** | VIEWER+ |

**Description:** Wire the existing "Tasks Today" card on the Briefing Dashboard to real task data from the API. Currently shows static mock data. Replace with API call to `/tasks/my?status=OPEN,IN_PROGRESS&dueDateBefore=endOfToday` and show today's due + overdue tasks with checkbox toggle.

**Key Interactions:**
- Show today's due tasks and overdue tasks
- Click checkbox to mark task complete (inline)
- Click task title to navigate to My Tasks page (or open Task Detail Sheet)
- "View All Tasks" link at bottom navigates to `/tasks`
- Empty state: "No tasks due today"

**Components Needed:**
- Update existing `<BottomCards>` component — replace mock data with real API call
- Reuses `<TaskStatusIcon>` for checkbox toggle

---

## Template Assignment Summary

| # | Page/Component | Template | Story | New Components |
|---|---------------|----------|-------|----------------|
| 1 | My Tasks Page | T1 (Entity List) | E11.S2 | TaskStatusIcon, TaskPriorityBadge, TaskOverdueBadge, EntityLink |
| 2 | Create Task Dialog | Dialog (modal) | E11.S2 | UserMultiSelect, EntityLinkChip |
| 3 | Task Detail Sheet | Sheet (slide-in) | E11.S2 | TaskStatusActions, TaskTimeline |
| 4 | Task Panel (embedded) | Section in T2/T3 | E11.S2 | TaskPanel, TaskPanelItem |
| 5 | Tasks Today Card | T4 (existing update) | E11.S2 | (update existing BottomCards) |

---

## Shadcn Components Required

| Component | Status | Notes |
|-----------|--------|-------|
| `Sheet` | Already installed | Task Detail slide-in |
| `Dialog` | Already installed | Create Task modal |
| `Form` | Already installed | Create Task form |
| `Input` | Already installed | Task title |
| `Textarea` | Already installed | Task description |
| `Select` | Already installed | Priority dropdown |
| `Calendar` | Already installed | Due date picker |
| `Popover` | Already installed | Date picker container |
| `Command` | Already installed | User search in multi-select |
| `Checkbox` | Already installed | Task status toggle |
| `Badge` | Already installed | Priority, status, overdue badges |
| `Button` | Already installed | Actions, CTA |
| `Card` | Already installed | Task panel container |
| `Tabs` | Already installed | Status filter chips on My Tasks |
| `Separator` | Already installed | Section dividers |
| `Tooltip` | Already installed | Action button hints |
| `Sonner/Toast` | Already installed | Success/error feedback |
| `Scroll Area` | Already installed | Task panel with many tasks |

---

## Notes

- **No dedicated Task Detail Page (T2)** — Task detail uses a Sheet (slide-in panel) rather than a full page, since tasks are lightweight records. This keeps the user's context on the list/record they came from.
- **Task Panel integration** — The `<TaskPanel>` component must be generic enough to embed in all existing T2/T3 detail pages. It accepts `entityType` and `entityId` props and queries `/tasks?entityType=X&entityId=Y`.
- **User Multi-Select** — The assignee picker needs to search users within the company. Can reuse the user search pattern from Access Group member assignment (E5b).
- **Entity Link routing** — The `<EntityLink>` component needs a mapping from entityType (e.g. "CustomerInvoice") to route path (e.g. `/finance/invoices/:id`). This should be a shared utility.
- **Briefing Dashboard dependency** — The Tasks Today card wiring is a lightweight update to existing code, not a new page.
