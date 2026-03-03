# Visual Checkpoint Manifest — Journey 16: Filter Dead Letter Queue by Event Name

## Journey Summary
Admin user logs in, navigates to the Dead Letter Queue page, applies the Event Name filter with "accessGroup.created", and verifies the filtered results show only matching entries.

---

## Checkpoint 1: Login Page
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login form visible with email input, password input, and Sign In button. No error messages visible.

## Checkpoint 2: Dashboard After Login
- **When**: After successful login (Step 3)
- **Screenshot file**: step-3-dashboard-after-login.png
- **What to look for**: Dashboard loaded with app shell. Sidebar visible with System module section containing Dead Letter Queue link.

## Checkpoint 3: DLQ Page Loaded (Unfiltered)
- **When**: After navigating to /system/dead-letter-queue (Step 4)
- **Screenshot file**: step-4-dlq-page-loaded.png
- **What to look for**: Dead Letter Queue page heading visible. Filter controls present (Event Name input, Reprocessed status filter). Data table showing DLQ entries OR empty state message. Table columns should include: ID, Event Name, Error, Retry Count, Original Timestamp, Reprocessed, Actions.

## Checkpoint 4: Filtered Results by Event Name
- **When**: After applying Event Name filter with "accessGroup.created" (Step 6)
- **Screenshot file**: step-6-filtered-by-event-name.png
- **What to look for**: DLQ table shows only entries where Event Name column reads "accessGroup.created". If no matching entries exist, an empty state message is shown. Filter input should still show "accessGroup.created". Pagination should reflect filtered count.
