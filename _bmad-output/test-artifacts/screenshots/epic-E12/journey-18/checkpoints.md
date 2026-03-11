# Journey 18: Delete a Template Version with Confirmation Dialog — Visual Checkpoints

## CP-1: Template detail view with version visible
- **When**: After navigating to 'E2E Test Invoice Template' detail view (step 2)
- **Screenshot file**: step-2-detail-view-with-version.png
- **What to look for**: Template detail heading shows 'E2E Test Invoice Template'. Versions section displays at least 1 version card (French locale, priority visible). 'Create Version' button visible.

## CP-2: Delete confirmation dialog appears
- **When**: After clicking Delete in version overflow menu (step 4)
- **Screenshot file**: step-4-delete-confirmation-dialog.png
- **What to look for**: Confirmation dialog/modal visible with warning text about permanent deletion (hard-delete). Red 'Delete' confirmation button and 'Cancel' button visible. Dialog overlay dims the background.

## CP-3: Version still present after Cancel
- **When**: After clicking Cancel in confirmation dialog (step 5-6)
- **Screenshot file**: step-6-version-still-present-after-cancel.png
- **What to look for**: Dialog closed. French version card still visible in the versions list. Version count unchanged. No toast or error messages.

## CP-4: Version deleted after confirmation
- **When**: After confirming deletion (step 9)
- **Screenshot file**: step-9-version-deleted-success.png
- **What to look for**: Version removed from list. Versions section now shows '(0)' count or empty state. Empty state message visible in versions area (dashed border box). Success toast may be shown.
