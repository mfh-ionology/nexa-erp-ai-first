# Visual Checkpoints — Journey 15: User List and Access Group Assignment

## Checkpoint 1: User List Page Loaded
- **When**: After step 1 — navigate to /system/users
- **Screenshot file**: step-1-user-list-page.png
- **What to look for**:
  - Page title heading "Users" visible
  - Breadcrumb navigation showing "System > Users"
  - Data table with columns: Name, Email, Role, Access Groups, Status, Last Login
  - Role column shows coloured badges (e.g. "Admin", "Staff")
  - Status column shows Active/Inactive badges
  - Search input visible in action bar area
  - No "+ New" button (users created via auth registration)

## Checkpoint 2: Search Filter Applied
- **When**: After step 2 — type "admin" in search input
- **Screenshot file**: step-2-search-filtered.png
- **What to look for**:
  - Search input contains text "admin"
  - Table rows filtered to show only users matching "admin" (by name or email)
  - Reduced number of rows compared to full list

## Checkpoint 3: User Detail Page
- **When**: After step 3 — click first user row
- **Screenshot file**: step-3-user-detail-page.png
- **What to look for**:
  - Page heading shows user's full name (e.g. "Admin Demo")
  - Breadcrumb: System > Users > [User Name]
  - Status badge (Active/Inactive) in header area
  - "User Profile" card showing: Email, Role (badge), Status (badge), Last Login
  - Below profile: "Access Groups" card with assigned group tags as removable badges
  - "Add Access Group" button visible
  - "Save Access Groups" button visible (should be disabled — no changes yet)

## Checkpoint 4: Combobox Open
- **When**: After step 4 — click "Add Access Group" button
- **Screenshot file**: step-4-combobox-open.png
- **What to look for**:
  - Popover visible with searchable combobox listing active access groups
  - Search input placeholder "Search access groups..." visible
  - Available groups listed (excluding already-assigned groups)
  - Each group shows name and optional description

## Checkpoint 5: VIEW_ONLY Group Added
- **When**: After step 6 — select VIEW_ONLY from combobox
- **Screenshot file**: step-6-view-only-tag-added.png
- **What to look for**:
  - New "VIEW_ONLY" tag/badge appears in the Access Groups assignment panel
  - Existing assigned group tags still present
  - "Save Access Groups" button is now enabled (no longer disabled)
  - Combobox is closed

## Checkpoint 6: Save Success Toast
- **When**: After step 7 — click "Save Access Groups"
- **Screenshot file**: step-7-save-success-toast.png
- **What to look for**:
  - Success toast message "Access groups updated successfully" visible
  - "Save Access Groups" button returns to disabled state
  - All assigned group tags still visible (including VIEW_ONLY)

## Checkpoint 7: VIEW_ONLY Tag Removed
- **When**: After step 8 — click X button on VIEW_ONLY tag
- **Screenshot file**: step-8-view-only-removed.png
- **What to look for**:
  - VIEW_ONLY tag no longer present in the assignment panel
  - Other group tags still visible
  - "Save Access Groups" button is enabled again (unsaved changes)
