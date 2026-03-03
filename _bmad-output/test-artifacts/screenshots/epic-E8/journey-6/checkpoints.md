# Visual Checkpoint Manifest — Journey 6: STAFF User Cannot Delete Attachments

## Journey Description
Verify that a STAFF-role user can view and download attachments but the delete button is hidden per RBAC rules.

## Checkpoints

### Checkpoint 1: Invoice Detail Page Loaded (as STAFF)
- **When**: After Step 1 — navigation to invoice detail page
- **Screenshot file**: `step-1-invoice-detail-loaded-staff.png`
- **What to look for**: Invoice detail page rendered with heading "INV-2026-0042", page content visible. User should be authenticated as STAFF role (no admin-only UI elements visible).

### Checkpoint 2: Attachment Panel Open with List
- **When**: After Step 2 — clicking Attachments button in ActionBar
- **Screenshot file**: `step-2-attachment-panel-open.png`
- **What to look for**: Attachment side panel (Sheet) is visible on the right side. Panel title says "Attachments". Attachment list shows at least one existing attachment row with file name, size, and upload metadata.

### Checkpoint 3: RBAC Verification — Download Visible, Delete Hidden
- **When**: After Steps 3-4 — verifying download button visible and delete button absent
- **Screenshot file**: `step-4-rbac-no-delete-button.png`
- **What to look for**: Attachment row showing ONLY the download button (Download icon). No trash/delete icon visible anywhere on any attachment row, confirming RBAC restriction for STAFF role. This is the critical visual checkpoint for this journey.
