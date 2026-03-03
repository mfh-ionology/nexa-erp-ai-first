# Visual Checkpoint Manifest — Journey 4: Sidebar Module Navigation

## Checkpoint 1: Dashboard with Sidebar Loaded
- **When**: After Step 1 — navigate to `/`, dashboard loads
- **Screenshot file**: `step-1-dashboard-with-sidebar.png`
- **What to look for**:
  - Full app shell visible with sidebar on the left
  - Sidebar shows module groups (System, Finance, Sales) with Lucide icons and translated labels
  - Header bar at top with user avatar
  - Main content area shows Dashboard heading
  - Sidebar is in expanded mode (~256px wide, text labels visible)

## Checkpoint 2: Finance Group Expanded
- **When**: After Step 2 — click Finance module group
- **Screenshot file**: `step-2-finance-expanded.png`
- **What to look for**:
  - Finance group is expanded (aria-expanded=true, chevron rotated)
  - Sub-items visible: Chart of Accounts, Journals, Financial Periods, Bank Reconciliation, Budgets
  - Each sub-item has an icon and text label
  - Other module groups remain collapsed

## Checkpoint 3: Journals Active with Highlighting
- **When**: After Step 3 — click Journals sub-item under Finance
- **Screenshot file**: `step-3-journals-active.png`
- **What to look for**:
  - Journals item has active styling: bold text, purple left border (`border-l-2 border-primary`), light background (`bg-background`)
  - URL has changed to `/finance/journals`
  - Journals item has `aria-current="page"` attribute
  - Main content area shows Journals page content (may be placeholder)

## Checkpoint 4: Quotes Active, Journals Deactivated
- **When**: After Step 5 — click Quotes sub-item under Sales
- **Screenshot file**: `step-5-quotes-active.png`
- **What to look for**:
  - Sales > Quotes item now has active purple highlight styling
  - Finance > Journals is no longer highlighted (no purple border, muted text)
  - URL has changed to `/sales/quotes`
  - Sales module group is expanded showing its sub-items

## Checkpoint 5: Sidebar Collapsed to Icon-Only
- **When**: After Step 6 — click sidebar collapse toggle
- **Screenshot file**: `step-6-sidebar-collapsed.png`
- **What to look for**:
  - Sidebar collapsed to narrow width (~64px, `w-16` class)
  - Only icons visible, no text labels
  - Main content area expanded to fill the freed space
  - Collapse button now shows expand chevron (ChevronRight icon)
