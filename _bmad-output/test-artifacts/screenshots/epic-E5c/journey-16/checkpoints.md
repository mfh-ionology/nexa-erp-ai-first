# Visual Checkpoint Manifest — Journey 16: Automation Runs List with Filters

## Checkpoint 1: Automation Runs list page loaded
- **When**: After navigating to /ai/admin/automations/runs (Step 1)
- **Screenshot**: `step-1-automation-runs-list-loaded.png`
- **What to look for**:
  - T1 Entity List layout with "Automation Runs" heading
  - Filter bar at top with status, date range, and automation name filter controls
  - Table columns: automation name (bold/link), trigger type badge, triggered by, started at, duration, status (StatusBadge), tokens (mono), cost (mono £)
  - At least one run row visible (from prior manual "Run Now" or seed data)
  - Concept D purple theme (#f4f2ff background)

## Checkpoint 2: Status filter — COMPLETED only
- **When**: After selecting COMPLETED in the status filter (Step 3)
- **Screenshot**: `step-3-status-filter-completed.png`
- **What to look for**:
  - Run list filtered to show only rows with green "Completed" status badges
  - Status filter control shows COMPLETED selection active
  - Filter bar visually indicates an active filter state (purple border/highlight)

## Checkpoint 3: Automation name filter applied
- **When**: After filtering by automation name "Daily AR Aging Summary" (Step 7)
- **Screenshot**: `step-7-automation-name-filtered.png`
- **What to look for**:
  - Run list scoped to only runs from "Daily AR Aging Summary"
  - Automation name column consistently shows "Daily AR Aging Summary" on all visible rows
  - Automation name dropdown shows the selected filter value
  - Clear Filters button visible (active filters detected)
