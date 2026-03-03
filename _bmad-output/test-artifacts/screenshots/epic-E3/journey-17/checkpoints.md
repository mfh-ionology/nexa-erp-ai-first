# Visual Checkpoint Manifest — Journey 17: Filter Dead Letter Queue by Reprocessed Status

## Checkpoint 1: Login Page
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login form visible with email input, password input, and Sign In button

## Checkpoint 2: Dashboard After Login
- **When**: After clicking Sign In (Step 3)
- **Screenshot file**: step-3-dashboard-after-login.png
- **What to look for**: Dashboard loaded with app shell; sidebar visible with System module section containing Dead Letter Queue link

## Checkpoint 3: Dead Letter Queue Page Loaded
- **When**: After navigating to /system/dead-letter-queue (Step 4)
- **Screenshot file**: step-4-dlq-page-loaded.png
- **What to look for**: DLQ page with filter controls (Event Name, Reprocessed status) and data table. Columns: ID, Event Name, Error, Retry Count, Original Timestamp, Reprocessed, Actions

## Checkpoint 4: DLQ Filtered — Pending Only (reprocessed=false)
- **When**: After clicking Apply Filters with reprocessed=false (Step 6)
- **Screenshot file**: step-6-dlq-filtered-pending.png
- **What to look for**: DLQ table shows only entries where Reprocessed column reads 'false' or shows a 'Pending' badge. All entries have Reprocess action button available. If no entries, empty state message shown.

## Checkpoint 5: DLQ Filtered — Reprocessed Only (reprocessed=true)
- **When**: After clicking Apply Filters with reprocessed=true (Step 8)
- **Screenshot file**: step-8-dlq-filtered-reprocessed.png
- **What to look for**: DLQ table shows only entries where Reprocessed column reads 'true' or shows a 'Reprocessed' badge with reprocessedAt timestamp. Reprocess button is disabled or hidden for these entries. If no entries, empty state shown.
