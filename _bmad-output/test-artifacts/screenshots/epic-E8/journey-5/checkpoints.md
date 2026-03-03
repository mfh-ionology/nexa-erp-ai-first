# Journey 5: Delete Attachment as MANAGER — Visual Checkpoints

## Checkpoint 1: Invoice detail page loaded
- **When**: After navigating to /ar/invoices/{invoiceId} and page renders
- **Screenshot file**: step-1-invoice-detail-page.png
- **What to look for**: Invoice detail page with heading "INV-2026-0042", info grid, line items table. ActionBar visible with Attachments button.

## Checkpoint 2: Attachment panel with existing attachment
- **When**: After opening the AttachmentPanel and confirming an attachment is listed
- **Screenshot file**: step-2-panel-with-attachment.png
- **What to look for**: Right-side Sheet panel open. Attachment list shows at least one file (e.g. "test-document.pdf") with file size, uploader name, and date. Upload zone visible at top. Delete button (Trash2 icon) visible on attachment row — confirms MANAGER/SUPER_ADMIN delete permission.

## Checkpoint 3: Delete confirmation dialog
- **When**: After clicking the delete (Trash2) button on the attachment row
- **Screenshot file**: step-3-delete-confirmation-dialog.png
- **What to look for**: AlertDialog overlay visible with title asking to confirm deletion. Description warns about permanent deletion. Two buttons: Cancel and a red/destructive Delete/Confirm button.

## Checkpoint 4: Empty state after deletion
- **When**: After confirming deletion and waiting for the list to update
- **Screenshot file**: step-4-empty-state-after-delete.png
- **What to look for**: AttachmentPanel shows empty state — file icon illustration with "No attachments yet" message. No attachment rows visible. Count badge removed from panel header (no badge or badge shows 0).
