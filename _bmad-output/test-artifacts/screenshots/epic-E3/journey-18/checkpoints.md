# Visual Checkpoint Manifest — Journey 18: Reprocess a Dead Letter Queue Entry

## Checkpoint 1: DLQ Page with Pending Entry
- **When**: After navigating to /system/dead-letter-queue (Step 5)
- **Screenshot file**: `step-5-dlq-pending-entry.png`
- **What to look for**: DLQ table visible with at least one entry that has reprocessed=false. The entry should display: event name, error details, retry count (3), and a "Reprocess" action button that is enabled/clickable.

## Checkpoint 2: Reprocess Confirmation Dialog
- **When**: After clicking the Reprocess button on a pending entry (Step 6)
- **Screenshot file**: `step-6-reprocess-confirmation-dialog.png`
- **What to look for**: A confirmation dialog/modal overlay visible asking "Are you sure you want to reprocess this event?" or similar. The dialog should have a Confirm/Yes button and a Cancel/No button. The DLQ table should be dimmed or behind the modal.

## Checkpoint 3: Reprocess Success Result
- **When**: After confirming the reprocess action (Step 7)
- **Screenshot file**: `step-7-reprocess-success.png`
- **What to look for**: Success toast/notification visible with text like "Event reprocessed successfully". The DLQ entry that was reprocessed should now show reprocessed=true (or a "Reprocessed" badge). A reprocessedAt timestamp should be visible. The Reprocess button should be disabled or hidden for this entry.
