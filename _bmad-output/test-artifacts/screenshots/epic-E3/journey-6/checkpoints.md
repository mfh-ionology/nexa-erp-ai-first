# Visual Checkpoint Manifest — Journey 6: Filter Audit Log by Date Range

## Checkpoint 1: Dashboard After Login
- **When**: After Step 3 — clicking Sign In and being redirected to dashboard
- **Screenshot file**: `step-3-dashboard-after-login.png`
- **What to look for**: Dashboard loaded with app shell. Sidebar visible with System module section containing Audit Log link.

## Checkpoint 2: Audit Log Default View
- **When**: After Step 4 — navigating to /system/audit-log
- **Screenshot file**: `step-4-audit-log-page-loaded.png`
- **What to look for**: Audit Log page loaded with filter controls visible (entity type, action, user, date range fields). Data table showing audit records with columns: Timestamp, Entity Type, Entity ID, Action, User, AI Action. Date range filter inputs are empty/default state.

## Checkpoint 3: Filtered Results by Date Range
- **When**: After Step 6 — clicking Apply Filters with today's date range set
- **Screenshot file**: `step-6-filtered-by-date-range.png`
- **What to look for**: Audit log table shows only records with timestamps from today (2026-02-21). All visible timestamps fall within the specified range (00:00:00 to 23:59:59). Filter fields show the applied dateFrom/dateTo values. Pagination count reflects filtered results.

## Checkpoint 4: Timestamp Verification
- **When**: After Step 7 — verifying all row timestamps are in range
- **Screenshot file**: `step-7-all-timestamps-in-range.png`
- **What to look for**: Final state of the filtered table confirming all visible records have timestamps within 2026-02-21. No records from other dates are visible.
