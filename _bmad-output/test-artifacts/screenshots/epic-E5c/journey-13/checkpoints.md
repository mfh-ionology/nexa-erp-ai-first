# Journey 13 — Automation Run History Filters: Visual Checkpoints

## Checkpoint 1: Runs List Initial Load
- **When**: After navigating to /ai/admin/automations/runs (Step 1)
- **Screenshot file**: `step-1-runs-list-loaded.png`
- **What to look for**: Page loads with "Automation Runs" heading or similar. Table/list visible with run data. Filter bar visible above the table. Purple-themed Concept D styling. Breadcrumbs showing AI Administration path.

## Checkpoint 2: Filter Bar Controls Visible
- **When**: After verifying filter bar (Step 2)
- **Screenshot file**: `step-2-filter-bar-controls.png`
- **What to look for**: Status multi-select dropdown trigger visible. Two date inputs (From/To) visible with w-36 sizing. Automation name dropdown visible. Clear Filters button present (may be hidden if no active filters). All controls in a flex row layout.

## Checkpoint 3: Status Filter Applied (COMPLETED + FAILED)
- **When**: After selecting COMPLETED and FAILED statuses and verifying filtered list (Step 4)
- **Screenshot file**: `step-4-filtered-completed-failed.png`
- **What to look for**: Only rows with green "Completed" dots/badges and red "Failed" dots/badges visible. No "Pending" (gray), "Running" (amber), or "Cancelled" (slate) rows. Status filter trigger shows "2 statuses" label. Clear Filters button now visible (active filters present).

## Checkpoint 4: Filters Cleared
- **When**: After clicking Clear Filters (Step 5)
- **Screenshot file**: `step-5-filters-cleared.png`
- **What to look for**: Full unfiltered run list visible again. All status types may appear. Status filter shows "All Statuses". Date inputs empty. Automation dropdown shows "All Automations". Clear button hidden or disabled.

## Checkpoint 5: Automation Name Filter Applied
- **When**: After filtering by "Daily AR Aging Summary" and verifying results (Steps 6-7)
- **Screenshot file**: `step-7-filtered-by-automation.png`
- **What to look for**: All visible rows show "Daily AR Aging Summary" in the automation name column. Automation dropdown shows "Daily AR Aging Summary" selected. No rows for other automations visible.
