# Visual Checkpoint Manifest — Journey 10: Paginate Through Audit Log Records

## Checkpoint 1: First Page of Audit Log (limit=5)
- **When**: After navigating to `/system/audit-log?limit=5` and table loads
- **Screenshot file**: `step-4-first-page-audit-log.png`
- **What to look for**:
  - Audit log table shows exactly 5 records (or fewer if < 5 total exist)
  - Pagination area visible indicating more records available (hasMore / "Next" enabled)
  - Next Page button is visible and enabled (not greyed out)
  - Records sorted by timestamp descending (newest first)

## Checkpoint 2: Second Page After Clicking Next
- **When**: After clicking the Next Page button and the second page loads
- **Screenshot file**: `step-5-second-page-audit-log.png`
- **What to look for**:
  - Table shows a different set of records than page 1
  - Previous Page button is now enabled (was disabled/hidden on page 1)
  - Records on page 2 have earlier timestamps than page 1's last record
  - Page indicator or pagination state reflects being on page 2
