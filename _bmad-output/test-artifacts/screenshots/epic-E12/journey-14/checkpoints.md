# Journey 14: Verify Form Validation Errors — Visual Checkpoints

## CP-1: Template list loaded
- **When**: After navigating to /settings/document-templates
- **Screenshot**: `step-1-template-list-loaded.png`
- **What to look for**: Template list page visible with grouped templates, "Add Template" button visible

## CP-2: Empty form opened
- **When**: After clicking "Add Template" button
- **Screenshot**: `step-2-empty-form-opened.png`
- **What to look for**: Editor form open with heading "New Template", all fields empty/default, Document Type showing placeholder "Select document type", Name field empty, HTML Template textarea empty

## CP-3: Required field validation errors
- **When**: After clicking "Create Template" (Save) without filling any fields
- **Screenshot**: `step-3-required-field-errors.png`
- **What to look for**: Red validation error messages visible below required fields: "Document type is required", "Name is required", "HTML template is required". Form remains open — no success toast. Save button still visible.

## CP-4: Margin validation error
- **When**: After entering 150 in the Margin Top field and triggering validation
- **Screenshot**: `step-4-margin-validation-error.png`
- **What to look for**: Margin Top input shows error state (red border or error text) indicating value exceeds maximum of 100mm. Other margin fields remain valid with default values.

## CP-5: Back to list after cancel
- **When**: After clicking Cancel button
- **Screenshot**: `step-5-back-to-list-after-cancel.png`
- **What to look for**: Template list visible again. No new template created. Same template count as before.
