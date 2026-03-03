# Visual Checkpoints — Journey 19: Reprocess Already-Reprocessed Entry Returns 409

## Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login form visible with email input, password input, and Sign In button

## Checkpoint 2: Dashboard After Login
- **When**: After successful login (Step 3)
- **Screenshot file**: step-3-dashboard-loaded.png
- **What to look for**: Dashboard loaded with sidebar visible, System section with Dead Letter Queue link

## Checkpoint 3: DLQ Page Filtered to Reprocessed Entries
- **When**: After navigating to /system/dead-letter-queue?reprocessed=true (Step 4)
- **Screenshot file**: step-4-dlq-reprocessed-filter.png
- **What to look for**: Dead Letter Queue page loaded showing only entries where Reprocessed status is 'true' or shows 'Reprocessed' badge. All entries should already be reprocessed. Reprocess button should be disabled/hidden for these entries, OR if visible (for testing 409), it should be clickable.

## Checkpoint 4: 409 Conflict Error After Reprocess Attempt
- **When**: After clicking Reprocess on an already-reprocessed entry (Step 5)
- **Screenshot file**: step-5-409-conflict-error.png
- **What to look for**: Error toast or inline message showing 'Dead-letter entry has already been reprocessed' or 'Conflict' / '409'. The entry state remains unchanged. No success message should be visible.
