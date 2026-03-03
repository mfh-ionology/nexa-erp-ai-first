# Visual Checkpoint Manifest — Journey #17: System Access Group Cannot Be Deleted

## Journey Summary
Admin navigates to the READ_ONLY system access group detail page, attempts to deactivate it,
and verifies the operation is blocked because system groups cannot be deleted/deactivated.

---

## Checkpoint 1: READ_ONLY Detail Page with System Group Banner
- **When**: After step 2 — clicking the READ_ONLY row in the access groups table
- **Screenshot file**: step-2-read-only-detail-page.png
- **What to look for**:
  - T7 Settings page layout for READ_ONLY group
  - System group banner visible with text like "This is a system access group — code cannot be changed and it cannot be deleted"
  - Group code "READ_ONLY" displayed (read-only)
  - Group name "Read Only" displayed
  - Active status badge visible
  - Save Settings button present

## Checkpoint 2: Overflow Menu with Disabled Deactivate Option
- **When**: After step 4 — opening the overflow/More Actions menu and checking the Deactivate option
- **Screenshot file**: step-4-overflow-menu-deactivate-disabled.png
- **What to look for**:
  - Overflow menu (More Actions) is open
  - Deactivate option is visible but disabled/greyed out
  - Tooltip or visual indicator explaining system groups cannot be deactivated
  - No way for the user to proceed with deletion of this system group
