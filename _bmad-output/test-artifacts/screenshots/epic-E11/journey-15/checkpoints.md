# Journey 15: Task Panel on Invoice Detail Page — Visual Checkpoints

## Checkpoint 1: Invoice detail page with TaskPanel visible
- **When**: After navigating to invoice detail page (step 2)
- **Screenshot file**: step-2-invoice-detail-with-task-panel.png
- **What to look for**: Invoice detail page loaded with INV-2026-0042 header. TaskPanel card visible at bottom with CheckSquare icon, "Tasks (N)" header, "+ Add Task" button. Card has 12px radius, custom shadow. Either shows active tasks or empty state with "No tasks for this record" message.

## Checkpoint 2: Create Task dialog with entity pre-filled
- **When**: After clicking "+ Add Task" in TaskPanel (step 4)
- **Screenshot file**: step-4-create-dialog-entity-prefilled.png
- **What to look for**: Create Task dialog open (560px max-w). Linked Record field shows read-only EntityLinkChip with FileText icon and "INV-2026-0042" label in purple-bordered pill. Title field empty and ready for input. Priority defaults to Normal.

## Checkpoint 3: Task created, TaskPanel refreshed
- **When**: After creating the task (step 6)
- **Screenshot file**: step-6-task-created-panel-refreshed.png
- **What to look for**: Dialog dismissed. TaskPanel now shows "Chase payment for this invoice" as a TaskPanelItem with status icon, title text, and priority badge. Success toast visible.
