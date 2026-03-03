# Visual Checkpoint Manifest — Journey 15: View Dead Letter Queue Entry Details

## Journey Summary
Admin user logs in, navigates to the Dead Letter Queue page, clicks on a DLQ entry to view its details, and verifies all required fields are present.

## Checkpoints

### Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login form visible with email input, password input, and Sign In button

### Checkpoint 2: Dashboard After Login
- **When**: After clicking Sign In (Step 3)
- **Screenshot file**: step-3-dashboard-after-login.png
- **What to look for**: Dashboard loaded with app shell; sidebar visible with System module section containing Dead Letter Queue link

### Checkpoint 3: Dead Letter Queue Page Loaded
- **When**: After navigating to /system/dead-letter-queue (Step 4)
- **Screenshot file**: step-4-dlq-page-loaded.png
- **What to look for**: DLQ page with data table showing columns: ID, Event Name, Error, Retry Count, Original Timestamp, Reprocessed, Actions. If entries exist, at least one row should be visible. If empty, an empty state message should be shown.

### Checkpoint 4: DLQ Entry Detail View (KEY CHECKPOINT)
- **When**: After clicking first DLQ entry row to expand/view details (Step 5)
- **Screenshot file**: step-5-dlq-entry-detail.png
- **What to look for**: Detail panel/view showing all required fields:
  - Event Name (e.g., 'accessGroup.created')
  - Payload (formatted JSON)
  - Error message
  - Stack trace (collapsible)
  - Retry Count (3)
  - Original Timestamp
  - Created At
  - Reprocessed status (false)
  - Reprocess action button visible

### Checkpoint 5: After Field Verification
- **When**: After verifying all required fields are present (Step 6)
- **Screenshot file**: step-6-fields-verified.png
- **What to look for**: Confirmation that eventName, payload, error, retryCount, originalTimestamp, and reprocessed fields are all present and populated with data
