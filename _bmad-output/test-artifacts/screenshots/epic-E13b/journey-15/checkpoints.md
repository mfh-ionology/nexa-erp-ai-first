# Journey 15: Export AI Usage Data as CSV — Visual Checkpoints

## Checkpoint 1: AI Usage Overview Tab Loaded
- **When**: After navigating to /ai-usage and page loads
- **Screenshot file**: 01-ai-usage-overview-loaded.png
- **What to look for**: AI Usage page with heading visible, Overview tab active, KPI cards displayed (Tokens Today, Tokens This Month, Cost Estimate), Export CSV button visible in top-right toolbar area

## Checkpoint 2: Date Range Selector Shown
- **When**: After clicking the Export CSV button
- **Screenshot file**: 02-date-range-selector-visible.png
- **What to look for**: A dropdown/popover appears below the Export CSV button with Start Date and End Date input fields (type=date), a Download button, and a Cancel button. Date fields should be pre-filled with last 30 days range

## Checkpoint 3: Export Initiated / Download Triggered
- **When**: After clicking the Download button to trigger CSV export
- **Screenshot file**: 03-export-initiated.png
- **What to look for**: The date range selector should close. The Export CSV button may briefly show a loading spinner. If a success toast appears, it should be visible. The page should return to normal state after export completes
