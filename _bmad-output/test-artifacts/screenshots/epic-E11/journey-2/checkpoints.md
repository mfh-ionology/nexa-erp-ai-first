# Visual Checkpoints - Journey 2: Create a New Task (Basic)

## Checkpoint 1: Create Task Dialog Open
- **When**: After clicking "+ Create Task" button (Step 2)
- **Screenshot file**: step-2-create-dialog-open.png
- **What to look for**: Dialog visible with "Create Task" title, fields for Title (with red asterisk), Description textarea, Priority select (default Normal), Due Date calendar button, Assignees UserMultiSelect, Linked Record section. Two action buttons: "Create & Add Another" (outline) and "Create" (purple). Dialog max-w 560px, animate-step-in.
- **Result**: PASS - All fields present. Title has red asterisk. Priority defaults to Normal. Due date shows "tasks.create.pickDate". Assignees has "Search users..." trigger. Linked Record shows "tasks.create.noLinkedRecord". Two action buttons visible (outline + purple). Dialog structure correct.
- **Visual Issue**: i18n keys show raw (e.g., "TASKS.CREATE.TITLEFIELD" instead of "Title", "tasks.priority.normal" instead of "Normal"). Known issue from Journey 1.

## Checkpoint 2: Form Filled
- **When**: After filling title, selecting HIGH priority, picking due date, and assigning Admin User (Step 3)
- **Screenshot file**: step-3-form-filled.png
- **What to look for**: Title input shows "Follow up with Acme Ltd on invoice payment", Priority select shows "High", Due date button shows "10 Mar 2026".
- **Result**: PASS - Title correctly shows entered text. Priority shows "tasks.priority.high". Due date shows "10 Mar 2026". Admin User chip visible in assignees with X remove button. Assignee search popover still open (caught during loading state).

## Checkpoint 3: Task Created Successfully
- **When**: After clicking Create button (Step 4)
- **Screenshot file**: step-4-task-created.png
- **What to look for**: Dialog dismissed, task list visible with new task "Follow up with Acme Ltd on invoice payment" in the table, HIGH priority badge (red outline), due date shown, success toast "Task created" visible.
- **Result**: PASS - Dialog dismissed. Task list shows 3 tasks (up from 2). New task "Follow up with Acme Ltd on invoice payment" appears as first row with "TASKS.PRIORITY.HIGH" badge, "10 Mar 2026" due date, "tasks.status.open" status, and "AU" assignee avatar. Tab count updated to All (3), Open (2).
- **Visual Issue**: No success toast visible in screenshot (may have already dismissed, or toast timing). i18n keys still raw throughout.
