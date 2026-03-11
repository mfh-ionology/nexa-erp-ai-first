# Journey 14: Delete Task from Detail Sheet - Visual Checkpoints

## Checkpoint 1: Task Detail Sheet Open
- **When**: After step 2 - clicking a task row to open detail sheet
- **Screenshot file**: step-2-detail-sheet-open.png
- **What to look for**: 480px sheet visible from right side, task title displayed, status action buttons visible (Start/Complete/Cancel for OPEN tasks), Delete Task button visible in footer with red text and Trash2 icon

## Checkpoint 2: AlertDialog Confirmation Visible
- **When**: After step 3 - clicking Delete Task button in sheet footer
- **Screenshot file**: step-3-delete-confirm-dialog.png
- **What to look for**: AlertDialog overlay visible on top of the sheet, 'Delete Task' title text, confirmation message asking 'Are you sure you want to delete this task?', Cancel button (outline) and Delete button (red bg-[#ef4444])

## Checkpoint 3: Task Deleted - List Updated
- **When**: After step 4 - clicking Delete confirmation button
- **Screenshot file**: step-4-task-deleted-list-updated.png
- **What to look for**: Detail sheet dismissed, task no longer visible in the task table, success toast 'Task deleted' visible, task count in status tabs updated
