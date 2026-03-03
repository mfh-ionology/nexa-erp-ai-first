# Visual Checkpoint Manifest — Journey 3: Reject Executable File Upload

## Checkpoint 1: Invoice detail page loaded
- **When**: After navigating to /ar/invoices/{invoiceId} (Step 1)
- **Screenshot file**: step-1-invoice-detail-page.png
- **What to look for**: Invoice detail page rendered with INV-2026-0042 heading, status badge, info grid, and line items. Page is fully loaded with no errors.

## Checkpoint 2: Attachment panel open (pre-upload)
- **When**: After clicking Attachments button in ActionBar (Step 2)
- **Screenshot file**: step-2-attachment-panel-open.png
- **What to look for**: AttachmentPanel Sheet slides in from right. Panel header shows "Attachments" title. FileUploadZone with dashed border and upload icon visible. Empty state message shown if no existing attachments.

## Checkpoint 3: Validation error for blocked file type
- **When**: After attempting to upload malicious.exe (Steps 3-4)
- **Screenshot file**: step-4-blocked-file-validation-error.png
- **What to look for**: Red validation error text visible below the FileUploadZone indicating ".exe" files are not permitted. The error uses translation key `crossCutting.attachments.blockedFileType`. No upload progress bar should appear — the file should be rejected client-side before any API call.

## Checkpoint 4: Attachment list unchanged
- **When**: After verifying no attachment was added (Step 5)
- **Screenshot file**: step-5-attachment-list-unchanged.png
- **What to look for**: The attachment list remains in its previous state (empty state if no prior attachments, or same list as before). No new file entry for "malicious.exe" should appear. No progress bar, no upload activity indicators.
