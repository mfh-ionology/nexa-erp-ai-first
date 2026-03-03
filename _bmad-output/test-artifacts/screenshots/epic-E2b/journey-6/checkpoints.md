# Visual Checkpoint Manifest — Journey 6: View Access Group Detail with Permission Matrix

## Checkpoint 1: FULL_ACCESS Detail Page Loaded
- **When**: After step 2 — clicking FULL_ACCESS row navigates to detail page
- **Screenshot file**: `step-2-full-access-detail-page.png`
- **What to look for**:
  - T7 Settings page layout with breadcrumb showing "System > Access Groups > Full Access"
  - Title "Full Access" visible at top
  - Active status badge visible
  - [Save Settings] button present in action bar
  - System group banner/warning visible (indicating this is a system group — code cannot be changed, cannot be deleted)
  - Code field showing "FULL_ACCESS" — should be read-only for system groups

## Checkpoint 2: Permission Matrix Grid Visible
- **When**: After step 4 — verifying the permission matrix grid element
- **Screenshot file**: `step-4-permission-matrix.png`
- **What to look for**:
  - Checkbox grid visible with column headers: canAccess, canNew, canView, canEdit, canDelete
  - Resources grouped by module (System section expanded)
  - All 6 system resources listed: User Management, User Detail, Company Profile, Resource Registry, Access Group List, Access Group Detail
  - For FULL_ACCESS group: ALL checkboxes in ALL rows should be checked (full permissions)
  - Grid should be interactive (checkboxes not disabled — admin can modify system group permissions)

## Checkpoint 3: Field Overrides Section Visible
- **When**: After step 6 — verifying the Field Overrides section
- **Screenshot file**: `step-6-field-overrides-section.png`
- **What to look for**:
  - Field Overrides section/panel visible below or beside the permission matrix
  - Resource selector dropdown present (for selecting which resource to configure field overrides on)
  - No overrides configured for FULL_ACCESS (empty state — this group has full access, no fields hidden or read-only)
  - May show an empty table or a message like "No field overrides configured"
