# Journey 15 — Failed Run: View Error & Retry from Failed Step

## Visual Checkpoints

### CP-1: Run List Page Loaded
- **When**: After navigating to /ai/admin/automations/runs
- **Screenshot**: `step-1-run-list-loaded.png`
- **What to look for**: Automation Runs page heading visible, table with columns (Automation, Trigger, Status, etc.), filter bar present with Status filter button

### CP-2: Filtered to FAILED Runs
- **When**: After applying FAILED status filter
- **Screenshot**: `step-2-filtered-failed-runs.png`
- **What to look for**: Status filter button shows "Failed" or active state (purple border), all visible rows show red FAILED status dots, non-FAILED runs are hidden

### CP-3: Failed Run Detail Page
- **When**: After clicking first FAILED run row
- **Screenshot**: `step-3-failed-run-detail.png`
- **What to look for**: Run detail page with red "Failed" status badge in header. Error banner visible: red-bordered alert card with "Run Failed" title and error message text. "Retry" primary button visible in header action bar. Metrics cards showing tokens, cost, steps, duration

### CP-4: Failed Step in Timeline
- **When**: After verifying the step timeline
- **Screenshot**: `step-4-failed-step-timeline.png`
- **What to look for**: Step timeline showing: completed steps with green check circles, one failed step with red X circle and red left-border accent (border-l-4 border-l-red-500) with error message in red alert box. If subsequent steps exist, they should show grey "Skipped" with italic label and reduced opacity

### CP-5: Retry Confirmation Dialog
- **When**: After clicking "Retry from This Step" button (or "Retry" header button)
- **Screenshot**: `step-5-retry-confirmation-dialog.png`
- **What to look for**: Confirmation dialog with title "Retry from Failed Step", description showing which step will be retried, automation name and run ID details, Cancel and Retry buttons

### CP-6: Retry Initiated Result
- **When**: After confirming retry
- **Screenshot**: `step-6-retry-initiated.png`
- **What to look for**: Either a success toast "Retry started" or navigation to new run detail page, or error if retry endpoint not available. If successful, new run detail page should show retryOfRunId linking to original
