# Epic E11: Cross-cutting Tasks

**Tier:** 1 | **Dependencies:** E9 (Notifications), E5b (EntityListPage) | **FRs:** FR181-FR183 | **NFRs:** NFR2 (CRUD < 500ms p95), NFR41 (TypeScript strict)

---

## v0 Reference Components (MANDATORY)

**All frontend stories MUST use these v0-generated reference components as the design source of truth.** The Dev agent should read these files and replicate their visual design, layout, component structure, and interaction patterns — adapting from Next.js/static to TanStack Router/React Query/i18n as needed.

| v0 Reference File | Purpose | Use In Story |
|---|---|---|
| `v0-nexa-design/components/tasks/task-types.ts` | Type definitions (`TaskStatus`, `TaskPriority`, `TaskItem`), priority colour config (`PRIORITY_CONFIG`), status labels, mock data | E11.2 (all components) |
| `v0-nexa-design/components/tasks/task-components.tsx` | `TaskStatusIcon`, `TaskPriorityBadge`, `TaskOverdueBadge`, `EntityLink`, `AssigneeAvatars` — shared atomic components | E11.2 (all components) |
| `v0-nexa-design/components/tasks/task-panel.tsx` | `TaskPanel` (embedded in record pages), `TaskPanelItem`, `PanelCreateDialog`, `PanelDetailSheet` | E11.2 (Task Panel) |
| `v0-nexa-design/app/(authenticated)/tasks/page.tsx` | `MyTasksPage` (full T1 list page), `CreateTaskDialog`, `TaskDetailSheet`, status cycling, batch actions, filtering | E11.2 (My Tasks page) |
| `v0-nexa-design/components/dashboard/bottom-cards.tsx` | `TasksCard` (Tasks Today card for briefing dashboard), `RecentActivityCard` | E11.2 (Dashboard wiring) |

### Adaptation Rules

When converting v0 components to production code:
1. **Replace** `"use client"` / Next.js `Link` / `next/link` → TanStack Router `Link` / `useNavigate`
2. **Replace** local `useState` mock data → React Query hooks (`useQuery`, `useMutation`, `useInfiniteQuery`)
3. **Replace** hardcoded strings → i18n `t()` calls with keys under `tasks.*` namespace
4. **Preserve** all Tailwind classes, colour values, spacing, animations, and visual hierarchy exactly
5. **Preserve** component structure — keep the same atomic components (`TaskStatusIcon`, `TaskPriorityBadge`, etc.) as separate files
6. **Preserve** interaction patterns — status cycling, batch actions, sheet/dialog open/close, overdue highlighting
7. **Add** proper TypeScript interfaces matching the API response types (from E11.1 endpoints)
8. **Add** error handling, loading skeletons, empty states with Concept D styling
9. **Add** `companyId` scoping and RBAC guards (`createStaffBeforeLoad` or similar)

---

## Story E11.1: Task Service (Backend)

**User Story:** As a system, I want a task CRUD service with assignment, status transitions, and polymorphic entity linking, so that users can create and manage tasks from any business record.

**Acceptance Criteria:**
1. GIVEN a user creates a task WHEN they provide title, priority, and optional due date THEN a Task record is created with status OPEN, scoped to companyId
2. GIVEN a task with entityType and entityId WHEN created THEN the task is linked to that specific business record (polymorphic FK pattern matching Attachment/Note/RecordLink)
3. GIVEN a user assigns users to a task WHEN TaskAssignee records are created THEN a `task.assigned` event is emitted for each assignee (FR182)
4. GIVEN a task in OPEN status WHEN status changes to IN_PROGRESS THEN the transition is recorded
5. GIVEN a task WHEN status changes to COMPLETED THEN `completedAt` timestamp is set to now, and a `task.status_changed` event is emitted
6. GIVEN a task in COMPLETED or CANCELLED status WHEN a further status change is attempted THEN the request is rejected (terminal states, BR-TASK-006)
7. GIVEN a user WHEN they request `/tasks/my` THEN only tasks where they are a TaskAssignee are returned, scoped by companyId
8. GIVEN query params `entityType` and `entityId` WHEN filtering tasks THEN only tasks linked to that specific record are returned

**Key Tasks:**
- [ ] Create Prisma migration for Task, TaskAssignee models + TaskStatus, TaskPriority enums
- [ ] Implement task.service.ts with CRUD, status transitions, assignee management
- [ ] Implement task.routes.ts with endpoints:
  - `GET /tasks` (list with filters: status, priority, entityType, entityId, assigneeId)
  - `GET /tasks/my` (current user's assigned tasks)
  - `GET /tasks/:id` (detail)
  - `POST /tasks` (create)
  - `PATCH /tasks/:id` (update)
  - `PATCH /tasks/:id/status` (status transition)
  - `POST /tasks/:id/assignees` (add assignee)
  - `DELETE /tasks/:id/assignees/:userId` (remove assignee)
  - `DELETE /tasks/:id` (delete — STAFF+ if creator, MANAGER+ otherwise)
- [ ] Implement companyId scoping on all queries
- [ ] Emit typed events: `task.assigned`, `task.status_changed`
- [ ] Add Zod schemas for request validation

**FR/NFR:** FR181, FR182; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §7 Infrastructure | BullMQ for scheduled jobs |
| API Contracts | §2.5 Cross-cutting | Task endpoints (to be added — gap identified in pre-epic analysis) |
| Data Models | §3.9 Cross-cutting | Task, TaskAssignee (defined in project-context.md §4) |
| State Machines | N/A | TaskStatus: OPEN → IN_PROGRESS → COMPLETED / CANCELLED (to be added) |
| Event Catalog | N/A | `task.assigned`, `task.status_changed` (to be added) |
| Business Rules | N/A | BR-TASK-001 to BR-TASK-008 (to be defined — see pre-epic analysis) |
| UX Design Spec | N/A | N/A — backend service |
| Project Context | §4 Cross-cutting Models | Task + TaskAssignee Prisma schema, polymorphic pattern |

---

## Story E11.2: Task UI (Frontend)

**User Story:** As a user, I want to view, create, and manage tasks from a centralised "My Tasks" page and from embedded panels on every record detail page, so that I can track action items across the entire ERP.

**IMPORTANT — v0 Reference Components:** The Dev agent MUST read and use the v0 reference components listed in the table at the top of this epic file. These files contain the exact visual design, component structure, and interaction patterns approved by Mohammed. Do NOT invent new layouts — replicate the v0 output, adapting only for TanStack Router, React Query, and i18n.

**Acceptance Criteria:**
1. GIVEN a user navigates to `/tasks` WHEN the page loads THEN the My Tasks page displays using the T1 Entity List template with status chip tabs (All/Open/In Progress/Overdue), search, priority filter, and task table — matching `v0-nexa-design/app/(authenticated)/tasks/page.tsx`
2. GIVEN the task table WHEN a row is clicked THEN a Task Detail Sheet slides in from the right with full task info, status action buttons, assignee list, linked record, and activity timeline — matching the `TaskDetailSheet` component in the v0 reference
3. GIVEN the user clicks "+ Create Task" WHEN the dialog opens THEN it shows title, description, priority, due date, assignees (multi-select), and optional linked record fields — matching `CreateTaskDialog` in the v0 reference
4. GIVEN a record detail page (T2/T3) WHEN the Tasks tab/section renders THEN a `TaskPanel` component shows tasks linked to that entity with inline status actions — matching `v0-nexa-design/components/tasks/task-panel.tsx`
5. GIVEN the Task Panel's "+ Add Task" button WHEN clicked THEN the Create Task Dialog opens with entityType and entityId pre-filled as a read-only linked record chip
6. GIVEN the briefing dashboard WHEN it loads THEN the "Tasks Today" card shows today's due + overdue tasks from the API with interactive status toggles — matching `TasksCard` in `v0-nexa-design/components/dashboard/bottom-cards.tsx`
7. GIVEN batch selection on the My Tasks page WHEN tasks are selected THEN a batch action bar appears with "Complete All", "Reassign...", and "Cancel" actions
8. GIVEN a task status icon WHEN clicked THEN it cycles: Open → In Progress → Completed (matching the `cycleStatus` function in the v0 reference)
9. GIVEN any viewport WHEN the pages render THEN desktop shows full table, tablet hides Assignees column, phone shows card layout

**Key Tasks:**
- [ ] Create feature directory `apps/web/src/features/tasks/` with API hooks, types, components
- [ ] Build shared atomic components from v0 reference: `TaskStatusIcon`, `TaskPriorityBadge`, `TaskOverdueBadge`, `EntityLink`, `AssigneeAvatars`
- [ ] Build My Tasks page using EntityListPage template with status tabs, search, filters — replicate `v0-nexa-design/app/(authenticated)/tasks/page.tsx`
- [ ] Build Create Task Dialog — replicate `CreateTaskDialog` from v0 reference, add React Hook Form + Zod validation
- [ ] Build Task Detail Sheet — replicate `TaskDetailSheet` from v0 reference, add inline editing and activity timeline
- [ ] Build Task Panel component — replicate `v0-nexa-design/components/tasks/task-panel.tsx`, wire to API with `entityType`/`entityId` query params
- [ ] Wire Tasks Today card on dashboard — update `bottom-cards.tsx` to use real API data, replicate `TasksCard` from v0 reference
- [ ] Build `UserMultiSelect` combobox for assignee selection (reference E5b Access Group member assignment pattern)
- [ ] Build `EntityLink` routing utility — map `entityType` to route path for navigation
- [ ] Add sidebar navigation entry "My Tasks" in Main section
- [ ] Add i18n keys under `tasks.*` namespace
- [ ] Add TanStack Router routes: `/tasks` (list), integrate Task Panel into existing record detail pages

**FR/NFR:** FR181, FR183; NFR41 (TypeScript strict), NFR2 (CRUD < 500ms p95)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| PRD | FR181, FR183 | Task creation from records, centralised task list |
| Architecture | N/A | Frontend feature module pattern |
| UX Design Spec | §T1 Entity List, §T2/T3 Detail | My Tasks uses T1, TaskPanel embeds in T2/T3 |
| API Contracts | §2.5 Cross-cutting | Task endpoints from E11.1 |
| Data Models | §3.9 Cross-cutting | Task, TaskAssignee — response types |
| Business Rules | N/A | BR-TASK-001 (title required), BR-TASK-006 (terminal states immutable) |
| Event Catalog | N/A | N/A — frontend consumes API |
| Project Context | §4 Cross-cutting Models | Task model shape |
| **v0 Reference** | **See table above** | **MANDATORY — all 5 v0 files must be read and replicated** |
| Pre-Epic Designs | `pre-epic-designs/epic-E11-page-inventory.md` | Page inventory with template assignments |
| Pre-Epic Designs | `pre-epic-designs/epic-E11-v0-prompt.md` | v0 prompt with wireframes |

---

## Story E11.3: Task Notifications

**User Story:** As a task assignee, I want to receive notifications when I'm assigned a task, when a task's status changes, and when a task becomes overdue, so that I stay informed about my responsibilities.

**Acceptance Criteria:**
1. GIVEN a TaskAssignee record is created WHEN the `task.assigned` event is emitted THEN each assignee receives an in-app + email notification (per their notification preferences)
2. GIVEN a task status changes to COMPLETED WHEN the `task.status_changed` event is emitted THEN the task creator and all assignees receive a notification
3. GIVEN a task with a due date WHEN the due date passes and status is OPEN or IN_PROGRESS THEN a `task.overdue` event is emitted and assignees are notified
4. GIVEN notification preferences WHEN a user has disabled task notifications for a channel THEN that channel is skipped (leverages E9 notification preferences system)
5. GIVEN the overdue check WHEN it runs THEN it executes daily as a BullMQ scheduled job

**Key Tasks:**
- [ ] Create NotificationTemplate seeds for TASK_ASSIGNED, TASK_COMPLETED, TASK_OVERDUE event types
- [ ] Wire `task.assigned` event handler → notification dispatch (using E9 notification service)
- [ ] Wire `task.status_changed` event handler → notification dispatch for COMPLETED status
- [ ] Implement BullMQ cron job for overdue task detection (daily at 08:00 UTC)
  - Query: `status IN (OPEN, IN_PROGRESS) AND dueDate < now()`
  - Emit `task.overdue` event for each overdue task (with deduplication — don't re-notify same task daily)
- [ ] Add TASK_ASSIGNED, TASK_COMPLETED, TASK_OVERDUE to notification preference categories (if not already seeded from E9)

**FR/NFR:** FR182; NFR31 (retry logic on notification delivery)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §7 Infrastructure | BullMQ cron jobs |
| API Contracts | N/A | Uses E9 notification dispatch internally |
| Data Models | §3.17 Notifications | NotificationTemplate, NotificationPreference |
| State Machines | N/A | N/A |
| Event Catalog | N/A | `task.assigned`, `task.status_changed`, `task.overdue` (to be added) |
| Business Rules | N/A | BR-TASK-005 (notify on assignment), BR-TASK-007 (daily overdue check) |
| UX Design Spec | §Notification Preferences | Task Events section in preferences matrix |
| Project Context | §4 Cross-cutting | Task model, E9 notification infrastructure |

---

## Spec Gaps to Address During Story Creation

The following gaps were identified during the pre-epic frontend design gate and MUST be addressed by the SM agent when creating detailed stories:

| Document | Gap | Action |
|----------|-----|--------|
| `data-models/3-module-by-module-models.md` | Task and TaskAssignee not in §3.9 | Add to Cross-Cutting section |
| `data-models/4-enum-reference.md` | TaskPriority and TaskStatus missing from §4.9 | Add to Cross-Cutting enums |
| `api-contracts/2-endpoint-summary.md` | Task endpoints missing from §2.5 | Add CRUD + /my + /status + /assignees |
| `api-contracts/4-fr-to-endpoint-mapping.md` | FR181-183 not mapped | Add mappings |
| `state-machine-reference.md` | No Task Status state machine | Add section |
| `event-catalog.md` | `task.assigned`, `task.status_changed`, `task.overdue` missing | Add events |
| `business-rules-compendium.md` | No BR-TASK-xxx rules | Add BR-TASK-001 to BR-TASK-008 |

---

## Story Status Summary

| Story | Title | Status |
|-------|-------|--------|
| E11.1 | Task Service (Backend) | backlog |
| E11.2 | Task UI (Frontend) | backlog |
| E11.3 | Task Notifications | backlog |
