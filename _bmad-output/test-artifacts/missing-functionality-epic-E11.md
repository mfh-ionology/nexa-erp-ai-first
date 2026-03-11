# Missing Functionality - Epic E11

> Auto-generated during frontend E2E testing

## Bug: i18n translations not resolving for tasks namespace
- **Journey**: Journey 1 - My Tasks Page Shell & Navigation, all steps
- **Expected**: All UI text should display translated English strings (e.g. "My Tasks", "Create Task", "Priority", "Urgent", "High", "Open", "In Progress", "Assignees")
- **Actual**: Raw i18n keys displayed everywhere: "tasks.title", "tasks.create.title", "TASKS.PRIORITY.URGENT", "TASKS.PRIORITY.HIGH", "tasks.status.inProgress", "tasks.status.open", "tasks.tabs.all (2)", "TASKS.CREATE.PRIORITY", "TASKS.DETAIL.ASSIGNEES", sidebar shows "myTasks"
- **Related Story**: E11-2
- **Suggested Story Title**: Fix tasks i18n namespace registration so translation keys resolve to English strings
- **Root Cause Hypothesis**: The `tasks` namespace is not registered in the i18n configuration (packages/i18n/src/config.ts), or the namespace is not loaded by the i18n instance at startup. The en/tasks.json file exists with correct flat keys but they are not being picked up.

## Bug: Creating task from My Tasks page does not auto-assign creator
- **Journey**: Journey 2 - Create a New Task (Basic), Step 4
- **Expected**: When creating a task from the "My Tasks" page, the current user should be automatically assigned so the task appears in the list (which filters by `assignees: { some: { userId } }`)
- **Actual**: Task is created without any assignees. It does not appear in the "My Tasks" list because `/tasks/my` only returns tasks where the current user is an assignee. The task is invisible to the creator unless they manually add themselves as an assignee.
- **Related Story**: E11-2
- **Suggested Story Title**: Auto-assign creator when creating task from My Tasks page

## Bug: Task Detail Sheet does not update after status mutation
- **Journey**: Journey 7 - Status Actions in Task Detail Sheet, Step 3
- **Expected**: After clicking "Start" button in the detail sheet, the sheet should update to show IN_PROGRESS status with only Complete and Cancel buttons (Start button removed)
- **Actual**: The mutation succeeds (tab counts update from open(2) to open(1), inProgress(2) to inProgress(3)), but the detail sheet still shows OPEN status with all three buttons (Start, Complete, Cancel). The sheet renders from a stale `detailTask` state snapshot (`useState<Task | null>`) in MyTasksPage.tsx:72 that is never updated after mutations.
- **Related Story**: E11-2
- **Suggested Story Title**: Fix TaskDetailSheet to reflect status changes after mutations (use task ID + query instead of stale state snapshot)
- **Root Cause**: `MyTasksPage` stores `detailTask` as a `useState` snapshot set on row click (line 72). When `changeStatus.mutate()` fires in `TaskDetailSheet`, React Query invalidates the list query, but the `detailTask` state object is never replaced with the updated task data. Fix: either store only the task ID and derive the task from the query cache, or update `detailTask` in the mutation's `onSuccess` callback.
- **Also affects**: Journey 8 (Inline Edit Title & Description) — after saving title or description via inline edit, the sheet continues to display the old values. The table behind the sheet updates correctly (React Query cache refresh), but the sheet's `task` prop is stale. Closing and reopening the sheet shows the correct values.

## Bug: Task creation from TaskPanel on Invoice Detail page fails silently
- **Journey**: Journey 15 - Task Panel on Invoice Detail Page, Step 6
- **Expected**: After filling in the title "Chase payment for this invoice" and clicking Create, the dialog should close, the TaskPanel should refresh showing the new task, and a success toast should appear
- **Actual**: The Create button is clicked but the dialog remains open. The API call to POST /tasks fails. No error toast is visible (the mutation's onError should show a destructive toast but it was not detected). The dialog stays open with the form data intact.
- **Related Story**: E11-2
- **Suggested Story Title**: Fix task creation API call from TaskPanel context (entityType/entityId parameter handling)
- **Root Cause Hypothesis**: The invoice detail page passes `entityType="CustomerInvoice"` and `entityId="00000000-0000-0000-0000-000000000001"` (a mock UUID). The API POST /tasks endpoint may reject the entityId because it references a non-existent record (the invoice is mock/static data, not in the database). Alternatively, the `createTask.mutateAsync()` may throw and the error is swallowed — the dialog's `doCreate` function awaits the mutation but doesn't have explicit error handling around it (the `onError` in useMutation fires a toast, but react-hook-form's `handleSubmit` may catch the thrown error). The dialog should either close on error or show a clear error state.

## Blocked: Journey 16 — TaskPanelItem interactions cannot be tested (no entity-linked tasks)
- **Journey**: Journey 16 - Task Panel Item Interactions, Steps 3-5
- **Expected**: Invoice detail page should have active tasks in the TaskPanel so that status cycling via quick action buttons, completed state styling, and PanelDetailSheet opening can be tested
- **Actual**: TaskPanel shows "tasks.empty.noEntityTasks" with 0 tasks. Creating a task via the panel's Add Task button fails (same bug as Journey 15 — API rejects entity-linked task creation). Without tasks in the panel, steps 3 (verify TaskPanelItem), 4 (Complete quick action), and 5 (open PanelDetailSheet) cannot be executed.
- **Related Story**: E11-2
- **Suggested Story Title**: Fix entity-linked task creation so TaskPanel interactions can function (same fix as Journey 15 bug)
- **Dependency**: Resolving the Journey 15 task creation bug will unblock this journey. Alternatively, seed data could include pre-existing tasks linked to the mock invoice.

## Visual Issue: i18n keys not resolved in CreateTaskDialog (TaskPanel context)
- **Journey**: Journey 15 - Task Panel on Invoice Detail Page, Step 4
- **Expected**: Dialog labels should show translated text: "Create Task", "Title", "Description", "Priority", "Due Date", "Assignees", "Linked Record", "Create", "Create & Add Another"
- **Actual**: Raw i18n keys displayed: "tasks.create.title", "TASKS.CREATE.TITLEFIELD", "TASKS.CREATE.DESCRIPTION", "TASKS.CREATE.PRIORITY", "TASKS.CREATE.DUEDATE", "TASKS.CREATE.ASSIGNEES", "TASKS.CREATE.LINKEDRECORD", "tasks.create.submit", "tasks.create.submitAndAnother", "tasks.detail.cancel"
- **Related Story**: E11-2 (same root cause as the i18n bug in Journey 1)
- **Suggested Story Title**: (same as Journey 1 i18n bug — fix tasks namespace registration)

## Visual Issue: Mobile task cards do not open TaskDetailSheet on click
- **Journey**: Journey 20 - Responsive Mobile Card Layout, Step 2
- **Expected**: Clicking a task card on mobile (375x812 viewport) should open the TaskDetailSheet sliding in from the right, taking full width on mobile
- **Actual**: The mobile card layout renders correctly (table hidden, cards visible), but clicking a card does not open the detail sheet. The cards may be missing an `onClick` handler or the click target area may not be properly wired to `setDetailTask`. The test used `[data-testid="task-card"]` and `tbody tr` selectors — neither triggered sheet opening on mobile.
- **Related Story**: E11-2
- **Suggested Story Title**: Wire onClick handler on mobile task cards to open TaskDetailSheet

## Visual Issue: Status tab "In Progress" label truncated on mobile viewport
- **Journey**: Journey 20 - Responsive Mobile Card Layout, Step 1
- **Expected**: All status chip tabs should be fully visible and readable on mobile
- **Actual**: The "In Progress" tab text is cut off at the right edge of the 375px viewport. Only "tasks.tabs.inProgre" is visible. The tabs row should either scroll horizontally or use abbreviated labels on mobile.
- **Related Story**: E11-2
- **Suggested Story Title**: Make status chip tabs horizontally scrollable on mobile or use abbreviated labels

## Blocked: Journey 17 — Task Panel Completed/Cancelled Section Toggle cannot be tested (no entity-linked tasks)
- **Journey**: Journey 17 - Task Panel Completed/Cancelled Section Toggle, Steps 3-4
- **Expected**: Invoice detail page TaskPanel should have completed/cancelled tasks so that the collapsible "Completed (N)" toggle can be tested — clicking it should expand to show completed tasks with line-through styling, green CheckCircle2 icons, and ChevronUp indicator
- **Actual**: TaskPanel shows 0 tasks (empty state). Creating a task via the panel's "+ Add Task" button fails (same bug as Journey 15/16 — API rejects entity-linked task creation). Without tasks in the panel, no tasks can be completed, so the "Completed (N)" toggle never appears and cannot be tested.
- **Related Story**: E11-2
- **Suggested Story Title**: Fix entity-linked task creation so TaskPanel completed section toggle can function (same fix as Journey 15 bug)
- **Dependency**: Resolving the Journey 15 task creation bug will unblock this journey. Once tasks can be created and completed on entity records, the collapsible completed section will appear and can be tested. The toggle code itself exists in TaskPanel.tsx lines 128-155 and appears correct.

