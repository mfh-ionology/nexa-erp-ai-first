# Visual Checkpoints — Journey 6: Status Cycling via Table Icon Click

## Checkpoint 1: Tasks page loaded with OPEN tasks visible
- **When**: After navigating to /tasks and waiting for data
- **Screenshot file**: step-1-tasks-page-loaded.png
- **What to look for**: My Tasks page with table visible, at least one task row with grey Circle status icon (OPEN status), table headers visible, #f4f2ff background

## Checkpoint 2: After first click — OPEN -> IN_PROGRESS
- **When**: After clicking the status icon of an OPEN task
- **Screenshot file**: step-2-status-in-progress.png
- **What to look for**: Status icon changed from grey Circle to blue CircleDot, status label column shows 'In Progress' in blue text, possible toast confirming status update

## Checkpoint 3: After second click — IN_PROGRESS -> COMPLETED
- **When**: After clicking the same task's status icon again
- **Screenshot file**: step-3-status-completed.png
- **What to look for**: Status icon changed to green CheckCircle2, task title shows line-through text in muted foreground, status label shows 'Completed' in green text

## Checkpoint 4: Terminal state — COMPLETED icon is disabled
- **When**: After attempting to click the COMPLETED task's status icon
- **Screenshot file**: step-4-terminal-state-no-change.png
- **What to look for**: Icon remains green CheckCircle2, no further status change, button has opacity-70 and cursor-default (disabled state)
