# Visual Checkpoint Manifest — Journey #3: View Access Group List with Pre-Built Groups

## Checkpoint 1: Access Groups Page Loaded
- **When**: After step 2 — page title verified
- **Screenshot file**: `step-2-access-groups-page.png`
- **What to look for**:
  - T1 Entity List page with "Access Groups" heading
  - `[+ New Access Group]` button visible in action bar
  - Table with columns: Code, Name, Description, System badge, Active Users, Created
  - All 12 pre-built system groups listed in the table
  - Each row shows a "System" badge/indicator (all are system groups)

## Checkpoint 2: Search Filtered to "manager"
- **When**: After step 6 — search input filled with "manager"
- **Screenshot file**: `step-6-search-manager-filtered.png`
- **What to look for**:
  - Search box contains "manager"
  - Table filtered to show exactly 4 groups: FINANCE_MANAGER, SALES_MANAGER, PURCHASE_MANAGER, HR_MANAGER
  - Other groups (FULL_ACCESS, SALES_STAFF, etc.) are NOT visible
  - System badge still visible on filtered rows
