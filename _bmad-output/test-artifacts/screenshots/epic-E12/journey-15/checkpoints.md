# Journey 15: Verify Duplicate Name Constraint (409 Conflict) — Visual Checkpoints

## CP-1: Template list loaded
- **When**: After navigating to /settings/document-templates and waiting for list to render
- **Screenshot file**: step-1-template-list-loaded.png
- **What to look for**: Template list page with grouped templates visible, including SALES_INVOICE group. No loading skeletons. "Add Template" button visible.

## CP-2: Form filled with duplicate data before save
- **When**: After filling document type (SALES_INVOICE), name ("E2E Test Invoice Template"), and HTML template, just before clicking Save
- **Screenshot file**: step-2-form-filled-duplicate-data.png
- **What to look for**: Editor form with "New Template" heading. Document Type shows "Sales Invoice". Name field has "E2E Test Invoice Template". HTML template textarea has content. "Create Template" button visible.

## CP-3: 409 conflict error toast displayed
- **When**: After clicking "Create Template" and receiving the 409 error
- **Screenshot file**: step-3-conflict-error-toast.png
- **What to look for**: Error toast notification visible (sonner toast, typically red/destructive styling) with duplicate name conflict message. Form remains open — "New Template" heading still visible. Form is not dismissed.

## CP-4: Back to list after cancel
- **When**: After clicking Cancel to return to list view
- **Screenshot file**: step-4-back-to-list-no-duplicate.png
- **What to look for**: Template list displayed again. No duplicate "E2E Test Invoice Template" entry visible (only one if created by setup). Editor form is gone.
