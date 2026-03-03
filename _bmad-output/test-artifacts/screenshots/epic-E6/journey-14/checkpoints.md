# Visual Checkpoints — Journey 14: System Access Group Protection Rules

## Checkpoint 1: Access Group List with System Badges
- **When**: After navigating to /system/access-groups and list loads
- **Screenshot file**: step-1-access-group-list-system-badges.png
- **What to look for**:
  - Page heading "Access Groups" visible
  - Data table with rows for access groups
  - System groups (FULL_ACCESS, READ_ONLY) display a "System" badge in the System column
  - Non-system groups do NOT have the "System" badge
  - Table columns visible: Code, Name, System, User Count, Created

## Checkpoint 2: System Group Detail with Protection Banner
- **When**: After clicking FULL_ACCESS row to open detail page
- **Screenshot file**: step-2-system-group-detail-banner.png
- **What to look for**:
  - Page heading shows "Full Access" (the group name)
  - Blue info banner visible at top: "This is a system access group. Its code cannot be changed and it cannot be deactivated."
  - "System" badge visible next to the group name (in header area)
  - Code field shows "FULL_ACCESS" and appears read-only/disabled (monospace, greyed out)
  - Save button and overflow menu (more actions) button visible in action bar

## Checkpoint 3: Overflow Menu with Disabled Deactivate
- **When**: After clicking the overflow (more actions) button
- **Screenshot file**: step-3-overflow-menu-deactivate-disabled.png
- **What to look for**:
  - Dropdown menu is open
  - "Deactivate" menu item is visible but disabled (greyed out, not clickable)
  - This confirms system groups cannot be deactivated via the UI
