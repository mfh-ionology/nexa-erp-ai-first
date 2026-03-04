# Journey 20: Automation List — Run Status Links and View Runs Action

## Visual Checkpoints

### Checkpoint 1: Automation list loaded
- **When**: After navigating to /ai/admin/automations and data loads
- **Screenshot**: `step-1-automation-list-loaded.png`
- **What to look for**: Automation list page with "Daily AR Aging Summary" row visible. The row should have a Last Run status badge (colored dot + status text with dotted underline indicating it's clickable). The overflow menu button (three dots) should be visible on the row.

### Checkpoint 2: Run detail page after clicking status badge
- **When**: After clicking the Last Run status badge on "Daily AR Aging Summary" row
- **Screenshot**: `step-2-run-detail-page.png`
- **What to look for**: Run detail page loaded showing run information. The page should display the automation name "Daily AR Aging Summary", run status, timing metrics (started at, duration), and token usage. URL should contain `/ai/admin/automations/runs/` followed by a run ID.

### Checkpoint 3: Automation Runs list filtered by automation
- **When**: After clicking "View Runs" from the overflow menu
- **Screenshot**: `step-5-runs-filtered-by-automation.png`
- **What to look for**: Automation Runs list page loaded and scoped to "Daily AR Aging Summary" runs only. The page heading or filter should indicate the automation name filter is active. All visible run rows should show "Daily AR Aging Summary" as the automation name.
