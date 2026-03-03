# Visual Checkpoints — Journey #11: Assign Zero Access Groups Rejected (422)

## Checkpoint 1: User detail page loaded for sales user
- **When**: After Step 2 — clicking sales@nexa-test.co.uk row in users list
- **Screenshot file**: `step-2-user-detail-page-with-access-groups.png`
- **What to look for**:
  - User detail page is displayed for sales@nexa-test.co.uk
  - Access Groups assignment panel is visible
  - Current groups (SALES_STAFF and possibly QA_TESTER) shown as tags/chips
  - A multi-select or tag-removal UI is available for managing groups

## Checkpoint 2: All access groups removed — empty selection state
- **When**: After Step 3 — removing all access group tags/chips
- **Screenshot file**: `step-3-empty-access-groups-selection.png`
- **What to look for**:
  - All access group tags/chips have been removed
  - The assignment panel shows an empty state (no groups selected)
  - Save button should still be visible/clickable

## Checkpoint 3: 422 error displayed after save attempt
- **When**: After Step 4 — clicking Save with zero access groups
- **Screenshot file**: `step-4-422-error-empty-groups-rejected.png`
- **What to look for**:
  - Error toast or inline error message visible
  - Message text includes "At least one access group is required" or similar
  - Form remains on the same page (no navigation away)
  - Previous access group assignments should remain intact (not wiped)
  - No success indicators visible
