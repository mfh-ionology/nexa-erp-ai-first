# Journey 18: Failed Run — Error Display and Retry from Failed Step

## Visual Checkpoints

### Checkpoint 1: Automation Runs List Loaded
- **When**: After step 1 — navigate to /ai/admin/automations/runs
- **Screenshot**: `step-1-automation-runs-list-loaded.png`
- **What to look for**: Page heading "Automation Runs", filter bar with status/date filters, table with run rows showing columns (Automation, Trigger, Status, Started, Duration, Tokens, Cost, Steps, Actions)

### Checkpoint 2: FAILED Status Filter Applied
- **When**: After step 2 — filter to FAILED runs only
- **Screenshot**: `step-2-failed-filter-applied.png`
- **What to look for**: Status filter shows "FAILED" selected, table rows all show red FAILED status badges, other statuses filtered out

### Checkpoint 3: Failed Run Detail Page
- **When**: After step 3 — click first FAILED run row
- **Screenshot**: `step-3-failed-run-detail-page.png`
- **What to look for**: Run detail page with red FAILED StatusBadge in header, error banner (red-bordered alert card with error message text), "Retry" or "Retry from Failed Step" button visible, metrics cards row (Total Tokens, Total Cost, Steps, Duration)

### Checkpoint 4: Failed Step Timeline with Skipped Steps
- **When**: After step 5 — verify step timeline
- **Screenshot**: `step-5-failed-step-timeline.png`
- **What to look for**: Step timeline showing: completed steps with green circles, failed step with red status circle and red left-border accent, subsequent steps showing as SKIPPED (grey) with "Skipped" label. Failed step should be auto-expanded showing error in red alert box.

### Checkpoint 5: Retry Confirmation Dialog
- **When**: After step 7 — click "Retry from This Step"
- **Screenshot**: `step-7-retry-confirmation-dialog.png`
- **What to look for**: AlertDialog overlay with title explaining retry action, description mentioning starting from the failed step with previous outputs preserved, "Cancel" and "Confirm"/"Continue" buttons visible

### Checkpoint 6: Retry Started — New Run Detail
- **When**: After step 8 — confirm retry
- **Screenshot**: `step-8-retry-started-new-run.png`
- **What to look for**: Toast notification "Retry started" (or similar), new run detail page showing PENDING or RUNNING status badge, retryOfRunId link to original failed run visible in metadata
