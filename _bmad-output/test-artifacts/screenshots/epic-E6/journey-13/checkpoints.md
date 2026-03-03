# Visual Checkpoint Manifest — Journey 13: Deactivate a Custom Access Group

## Checkpoint 1: Access Group Detail Page Loaded
- **When**: After step 2 — clicking TEST_SALES_REP row and navigating to its detail page
- **Screenshot file**: step-2-access-group-detail-loaded.png
- **What to look for**: Detail page for "Test Sales Representative" visible. Heading shows the group name. No system group banner (this is a custom group). Page has Permissions tab and possibly other tabs.

## Checkpoint 2: Overflow Menu with Deactivate Option
- **When**: After step 3 — clicking the overflow menu (more actions) button
- **Screenshot file**: step-3-overflow-menu-deactivate-visible.png
- **What to look for**: Dropdown/popover menu visible with a "Deactivate" option. The option should be enabled (not greyed out) since this is a custom group, not a system group. Menu may also contain other actions.

## Checkpoint 3: Deactivate Confirmation Dialog
- **When**: After step 4 — clicking Deactivate in the overflow menu
- **Screenshot file**: step-4-deactivate-confirmation-dialog.png
- **What to look for**: Confirmation dialog/modal visible with title containing "Deactivate". Body text warning about consequences: "Deactivate TEST_SALES_REP? Users assigned to this group will lose its permissions." Two buttons: "Cancel" and "Deactivate" (destructive action button).

## Checkpoint 4: Success Toast and Redirected to List
- **When**: After step 5 — confirming deactivation
- **Screenshot file**: step-5-deactivated-success-toast.png
- **What to look for**: Redirected back to Access Groups list page. Success toast visible with text like "Access group deactivated". The deactivated group (TEST_SALES_REP) should no longer appear in the default list view (or should show as inactive/deactivated).
