# Journey 16: Task Panel Item Interactions - Visual Checkpoints

## Checkpoint 1: Invoice Detail with TaskPanel Items
- When: After navigating to invoice detail page (step 2)
- Screenshot file: step-2-invoice-detail-task-panel-items.png
- What to look for: Invoice detail page loaded with TaskPanel card visible showing active task items. Each TaskPanelItem should have: status icon (Circle for OPEN), task title, priority badge, secondary row with assignees/due date, quick action buttons (Start/Complete).

## Checkpoint 2: TaskPanelItem Active Task Detail
- When: After verifying an active task panel item (step 3)
- Screenshot file: step-3-active-task-panel-item.png
- What to look for: TaskPanelItem in rounded-lg border card with status Circle icon (clickable), title text, priority badge inline. Secondary row with assignee names and due date. Quick action buttons: 'Start' (outline, blue hover) and 'Complete' (outline, green hover) with h-6 height, text-[10px].

## Checkpoint 3: After Completing Task via Quick Action
- When: After clicking Complete quick action button (step 4)
- Screenshot file: step-4-task-completed-via-quick-action.png
- What to look for: Task title now has line-through and muted text, status icon is green CheckCircle2, quick action buttons removed, secondary row shows 'Completed' with completion date.

## Checkpoint 4: PanelDetailSheet Open
- When: After clicking task item body to open PanelDetailSheet (step 5)
- Screenshot file: step-5-panel-detail-sheet-open.png
- What to look for: 480px Sheet from right showing task title, status actions, description, priority, due date, assignees, linked record (entity chip), and delete button.
