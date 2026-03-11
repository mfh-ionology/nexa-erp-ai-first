# Journey 7: Status Actions in Task Detail Sheet — Visual Checkpoints

## Checkpoint 1: Detail sheet open for OPEN task
- **When**: After step 2 — clicking an OPEN task row to open the detail sheet
- **Screenshot**: `step-2-detail-sheet-open-status.png`
- **What to look for**: 480px sheet visible from right. Status section shows "Status: Open" with three action buttons: "Start" (blue), "Complete" (outline/green hover), "Cancel" (outline/red hover). Task title visible, delete button in footer.

## Checkpoint 2: Status changed to IN_PROGRESS
- **When**: After step 3 — clicking the "Start" button in the status section
- **Screenshot**: `step-3-status-in-progress.png`
- **What to look for**: Status section now shows "Status: In Progress". Only two buttons remain: "Complete" and "Cancel". The "Start" button should be gone. Toast may confirm status update.

## Checkpoint 3: Status changed to COMPLETED (terminal)
- **When**: After step 4 — clicking the "Complete" button
- **Screenshot**: `step-4-status-completed.png`
- **What to look for**: Status section shows green "Completed" text with checkmark icon and completion date. No action buttons visible. Task title has line-through styling. Priority and due date fields should be read-only (no interactive pickers).
