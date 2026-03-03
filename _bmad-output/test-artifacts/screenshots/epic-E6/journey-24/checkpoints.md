# Visual Checkpoints — Journey 24: ActionBar Status-Driven Actions Demo

## Checkpoint 1: Access Group List Page
- **When**: After Step 1 — navigating to /system/access-groups
- **Screenshot file**: step-1-access-group-list.png
- **What to look for**: Access group list page loaded with table rows visible. At least one custom (non-system) access group row present alongside system groups. Page header shows "Access Groups" title with breadcrumbs (System > Access Groups).

## Checkpoint 2: Access Group Detail Page with Action Bar
- **When**: After Step 2 — clicking on a custom (non-system) access group row
- **Screenshot file**: step-2-detail-page-action-bar.png
- **What to look for**: Detail page loaded with group name as heading. Action bar area visible with Save button (disabled, since no changes made) and three-dots overflow menu trigger button. Code field shown as read-only. Name and Description fields editable. No "System" badge visible (since this is a custom group). Tabs for Permissions and Field Overrides visible.

## Checkpoint 3: Overflow Menu Open
- **When**: After Step 3 — clicking the three-dots overflow menu trigger
- **Screenshot file**: step-3-overflow-menu-open.png
- **What to look for**: Dropdown menu visible with "Deactivate" menu item. Deactivate option should be enabled (not disabled/greyed out) since this is a custom group. Destructive styling (red text) on the Deactivate item. Trash icon next to Deactivate text.

## Checkpoint 4: Deactivation Confirmation Dialog
- **When**: After Step 4 — clicking "Deactivate" in the overflow menu
- **Screenshot file**: step-4-deactivate-confirmation-dialog.png
- **What to look for**: Modal dialog visible with title "Deactivate Access Group". Description text contains the group name and warns about permission loss. Two buttons: Cancel (ghost variant) and Deactivate (red/destructive variant). Page content dimmed/overlaid behind the dialog.

## Checkpoint 5: Dialog Dismissed
- **When**: After Step 5 — clicking Cancel in the confirmation dialog
- **Screenshot file**: step-5-dialog-dismissed.png
- **What to look for**: Confirmation dialog no longer visible. Detail page is back in normal state. Save button still disabled (no changes were made). Overflow menu trigger still present. URL still shows the access group detail page (not redirected).
