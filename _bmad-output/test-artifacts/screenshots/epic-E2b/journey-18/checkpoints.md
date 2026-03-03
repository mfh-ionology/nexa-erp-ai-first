# Visual Checkpoints — Journey #18: Soft-Delete Custom Access Group

## Checkpoint 1: User access group assignment saved (only SALES_STAFF)
- **When**: After Step 4 — saving updated access group assignments for sales user
- **Screenshot file**: step-4-sales-user-access-groups-updated.png
- **What to look for**: Success toast visible confirming update, Access Groups panel showing only SALES_STAFF (QA_TESTER removed), no error messages

## Checkpoint 2: QA_TESTER detail page showing overflow menu with Deactivate option
- **When**: After Step 8 — clicking Deactivate in overflow menu triggers confirmation dialog
- **Screenshot file**: step-8-deactivate-confirmation-dialog.png
- **What to look for**: Confirmation dialog visible asking "Are you sure you want to deactivate QA Testing Team?", dialog has Confirm/Cancel buttons, detail page visible in background

## Checkpoint 3: Access group deactivated — redirected to list
- **When**: After Step 9 — confirming deactivation
- **Screenshot file**: step-9-deactivation-success-list.png
- **What to look for**: Success toast "Access group deactivated", redirected to access group list page, QA_TESTER no longer visible in the active group list (isActive filter defaults to true)
