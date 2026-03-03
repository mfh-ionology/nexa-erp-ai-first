# Visual Checkpoint Manifest — Journey #7: Edit Access Group Name and Description

## Checkpoint 1: QA_TESTER Detail Page Loaded
- **When**: After Step 2 — clicking QA_TESTER row navigates to its detail page
- **Screenshot file**: `step-2-qa-tester-detail-page.png`
- **What to look for**:
  - T7 Settings template layout with detail page for QA_TESTER
  - Heading shows "QA Tester" (original name)
  - Code field shows "QA_TESTER" (read-only or displayed as identifier)
  - Name and description fields are editable inputs
  - [Save Settings] button visible in action bar
  - No "System" badge (this is a custom group)

## Checkpoint 2: Save Success — Updated Metadata
- **When**: After Step 4 — clicking [Save Settings] after editing name and description
- **Screenshot file**: `step-4-save-success-updated-metadata.png`
- **What to look for**:
  - Success toast visible with text like "Access group updated"
  - Page title/heading now shows "QA Testing Team" (the updated name)
  - Description field shows "Updated description for the QA testing access group"
  - Code still shows "QA_TESTER" (code is immutable after creation)
  - No error messages

## Checkpoint 3: List Shows Updated Name
- **When**: After Step 5 — navigating back to /system/access-groups list
- **Screenshot file**: `step-5-list-shows-updated-name.png`
- **What to look for**:
  - Access Groups list page with all groups visible
  - QA_TESTER row now displays "QA Testing Team" as the name column value
  - QA_TESTER row does NOT have a "System" badge (isSystem: false)
  - All 12 pre-built system groups still present with "System" badges
