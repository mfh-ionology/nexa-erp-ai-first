# Epic E11: Cross-cutting Tasks

**Tier:** 1 | **Dependencies:** E6 (Frontend Shell) | **FRs:** FR181-FR183 | **NFRs:** NFR2 (CRUD <500ms)

---

## Story E11.S1: Task Service

**User Story:** As a user, I want to create tasks linked to any business record, assign them to multiple users, manage status transitions, and set due dates, so that action items are tracked in the context of business operations.

**Acceptance Criteria:**
1. GIVEN any business record WHEN a user creates a task THEN it is stored with title, description, priority (LOW/NORMAL/HIGH/URGENT), status (OPEN), due date, and polymorphic entityType + entityId link
2. GIVEN a task WHEN the user assigns it to one or more users THEN TaskAssignee records are created and assignees are notified
3. GIVEN a task with status OPEN WHEN the assignee starts work THEN they can transition it to IN_PROGRESS
4. GIVEN a task with status IN_PROGRESS WHEN the assignee completes it THEN they transition it to COMPLETED and completedAt is set
5. GIVEN a task WHEN it is cancelled THEN the status transitions to CANCELLED from either OPEN or IN_PROGRESS
6. GIVEN a task with a due date WHEN the due date is approaching (within 24 hours) THEN a notification is triggered for assignees

**Key Tasks:**
- [ ] Implement CRUD endpoints for `/tasks` (AC: #1)
  - [ ] `POST /tasks` — create with title, description, priority, dueDate, entityType, entityId
  - [ ] `GET /tasks` — list with filters (status, priority, dueDate, entityType/entityId, assigneeId)
  - [ ] `PATCH /tasks/:id` — update fields
  - [ ] `DELETE /tasks/:id` — soft delete (MANAGER role)
- [ ] Implement task assignment endpoint (AC: #2)
  - [ ] `POST /tasks/:id/assign` — add assignees (array of userIds)
  - [ ] Create TaskAssignee records with unique constraint
  - [ ] Emit notification event for each assignee
- [ ] Implement status transition endpoints (AC: #3, #4, #5)
  - [ ] `POST /tasks/:id/start` — OPEN -> IN_PROGRESS
  - [ ] `POST /tasks/:id/complete` — IN_PROGRESS -> COMPLETED (set completedAt)
  - [ ] `POST /tasks/:id/cancel` — OPEN|IN_PROGRESS -> CANCELLED
  - [ ] Validate transitions in service layer
- [ ] Implement due date notification via BullMQ scheduled job (AC: #6)
  - [ ] Check for tasks due within 24 hours
  - [ ] Emit notification event for assignees
- [ ] Validate entity existence for polymorphic link (AC: #1)
  - [ ] Enforce BR-SYS-013 pattern

**FR/NFR:** FR181, FR182; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Cross-cutting task system |
| API Contracts | N/A | /tasks CRUD, /tasks/:id/assign, /tasks/:id/complete (defined in Project Context) |
| Data Models | N/A | Task, TaskAssignee (defined in Project Context §4, not in data-models.md) |
| State Machines | N/A | Task status: OPEN -> IN_PROGRESS -> COMPLETED / CANCELLED |
| Event Catalog | N/A | Task events to be defined: `task.created`, `task.assigned`, `task.completed` |
| Business Rules | §12 Cross-Cutting Rules | BR-SYS-013 (polymorphic validation), BR-SYS-014 (entityType registry) |
| UX Design Spec | N/A | N/A — task UI covered in E11.S2 |
| Project Context | §4 Cross-Cutting Task System | Task/TaskAssignee Prisma models, TaskPriority/TaskStatus enums |

---

## Story E11.S2: Task UI

**User Story:** As a user, I want a task panel on every record view and a centralised "My Tasks" list, so that I can create tasks from any record and manage all my tasks from one place.

**Acceptance Criteria:**
1. GIVEN any record detail screen (T2, T3) WHEN a "Tasks" section is visible THEN it shows tasks linked to this record with status, priority, assignee, and due date
2. GIVEN the tasks section on a record WHEN the user clicks "Add Task" THEN a form appears pre-linked to the current entity with fields for title, description, priority, due date, and assignee search
3. GIVEN the "My Tasks" page WHEN accessed from the sidebar THEN it uses the T1 Entity List template showing all tasks assigned to the current user with filters for status, priority, and due date
4. GIVEN a task in any list WHEN the user clicks on it THEN a detail view shows full task information, linked entity (with navigation link), assignees, and status transition actions

**Key Tasks:**
- [ ] Build `<TaskPanel>` component for record screens (AC: #1, #2)
  - [ ] Embedded in T2/T3 templates as a tab or collapsible section
  - [ ] List tasks for current entity (entityType + entityId)
  - [ ] "Add Task" form with entity pre-linked
  - [ ] Inline status transition buttons (Start, Complete, Cancel)
- [ ] Build "My Tasks" page using T1 Entity List template (AC: #3)
  - [ ] Route: `/tasks`
  - [ ] Columns: title, priority badge, status badge, due date, source entity link
  - [ ] Filters: status, priority, due date range, overdue toggle
  - [ ] Default sort: due date ascending (overdue first)
- [ ] Build task detail view (AC: #4)
  - [ ] Show linked entity with click-to-navigate
  - [ ] Assignee list with avatars
  - [ ] Status timeline
  - [ ] Action bar with status transition buttons

**FR/NFR:** FR183; NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2 Component Architecture | Feature-based organisation for task components |
| API Contracts | N/A | /tasks endpoints (from Project Context) |
| Data Models | N/A | Task, TaskAssignee (from Project Context §4) |
| State Machines | N/A | Task status transitions: OPEN -> IN_PROGRESS -> COMPLETED / CANCELLED |
| Event Catalog | N/A | N/A — UI component, no events emitted |
| Business Rules | N/A | N/A — no additional business rules for UI |
| UX Design Spec | §Standardised Screen Templates | T1 for My Tasks list, T2 tab for record-embedded tasks |
| Project Context | §4 Cross-Cutting Task System | Tasks from ANY record, multi-assignee |

---

## Story E11.S3: Task Notifications

**User Story:** As a task assignee, I want to be notified when I am assigned a task, when a due date is approaching, and when a task I created changes status, so that I stay on top of action items.

**Acceptance Criteria:**
1. GIVEN a task is assigned to a user WHEN the assignment is created THEN the assignee receives an in-app notification with task title and source entity link
2. GIVEN a task with a due date WHEN it is within 24 hours of the due date and not completed THEN assignees receive a "due soon" notification
3. GIVEN a task is overdue WHEN the due date has passed and status is not COMPLETED/CANCELLED THEN assignees receive an "overdue" notification (once)
4. GIVEN a task status changes WHEN it moves to COMPLETED or CANCELLED THEN the task creator receives a notification

**Key Tasks:**
- [ ] Create NotificationTemplates for task events (AC: #1, #4)
  - [ ] `task.assigned` — notify assignee
  - [ ] `task.completed` — notify creator
  - [ ] `task.cancelled` — notify creator
- [ ] Implement due date reminder BullMQ scheduled job (AC: #2, #3)
  - [ ] Run every hour
  - [ ] Find tasks due within 24h that have not been reminded
  - [ ] Find overdue tasks that have not been flagged
  - [ ] Emit notification events
  - [ ] Track reminder state to prevent duplicates
- [ ] Wire task service events to notification system (AC: #1, #4)
  - [ ] Emit `task.assigned`, `task.completed`, `task.cancelled` events
  - [ ] NotificationTemplate matching routes to assignees/creators

**FR/NFR:** FR182; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | BullMQ scheduled jobs for reminders |
| API Contracts | N/A | N/A — notification delivery is internal |
| Data Models | §3.18 Communications Module | NotificationTemplate for task events |
| State Machines | N/A | N/A — notifications track delivery status |
| Event Catalog | §14 Communications Events | NotificationTemplate event matching system |
| Business Rules | §13 Communications Rules | BR-COM-014 (preference cascade) |
| UX Design Spec | N/A | N/A — notifications display via E9 components |
| Project Context | §4 Cross-Cutting Task System | Task notification on assignment and status change |

---
