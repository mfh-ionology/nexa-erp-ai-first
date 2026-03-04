# Journey 15: Run Automation Manually (Run Now) — Visual Checkpoints

## Checkpoint 1: Automation list loaded
- **When**: After navigating to /ai/admin/automations and data loads
- **Screenshot**: `step-1-automation-list-loaded.png`
- **What to look for**: T1 Entity List with automation rows visible. "Daily AR Aging Summary" row present with name, trigger badge, schedule, steps count, last run status, and active toggle. Overflow menu (three dots) visible on each row.

## Checkpoint 2: Overflow menu open with Run Now option
- **When**: After clicking overflow menu on "Daily AR Aging Summary" row
- **Screenshot**: `step-2-overflow-menu-open.png`
- **What to look for**: Dropdown menu visible with 4 options: Edit, View Runs, Run Now (with Play icon), Delete (red text). Menu positioned near the clicked row.

## Checkpoint 3: Run Now confirmation dialog
- **When**: After clicking "Run Now" in the overflow menu
- **Screenshot**: `step-3-run-now-confirmation-dialog.png`
- **What to look for**: AlertDialog modal visible with title "Run Automation", description asking confirmation to run now, automation name displayed, Cancel and Run Now (purple) buttons.

## Checkpoint 4: Automation started toast
- **When**: After clicking "Run Now" confirm button in dialog
- **Screenshot**: `step-4-automation-started-toast.png`
- **What to look for**: Success toast "Automation started" visible. Dialog should be closed. Automation list should have refreshed.

## Checkpoint 5: Status badge updated on row
- **When**: After toast appears and list refreshes
- **Screenshot**: `step-5-status-badge-updated.png`
- **What to look for**: The "Daily AR Aging Summary" row should show an updated Last Run column with a status badge (Running amber, Completed green, or Pending). Last Run Time should show a recent timestamp.
