# Journey 4: Reject Oversized File Upload — Visual Checkpoints

## Checkpoint 1: Invoice Detail Page Loaded
- **When**: After navigating to /ar/invoices/{invoiceId}
- **Screenshot file**: `step-1-invoice-detail-loaded.png`
- **What to look for**: Invoice detail page fully rendered with header showing invoice number (INV-2026-0042), status badge, action buttons. Page layout intact with no errors.

## Checkpoint 2: Attachment Panel Open
- **When**: After clicking the Attachments button in the ActionBar
- **Screenshot file**: `step-2-attachment-panel-open.png`
- **What to look for**: Right-side sheet/drawer open with AttachmentPanel visible. Panel title showing "crossCutting.attachments.title" (or translated text). FileUploadZone visible with drop zone area. Panel overlays the page content.

## Checkpoint 3: File Size Validation Error
- **When**: After attempting to upload an oversized 60MB file via the file picker
- **Screenshot file**: `step-3-file-rejected-oversized.png`
- **What to look for**: Red error text visible below the drop zone showing "crossCutting.attachments.fileTooLarge" (raw i18n key since namespace missing) or equivalent error message. No upload progress bar should appear. The drop zone should remain in idle state (not uploading). No network request to presign endpoint should have been made.

## Checkpoint 4: Error Message Detail
- **When**: Same moment as checkpoint 3, focused verification
- **Screenshot file**: `step-4-error-message-detail.png`
- **What to look for**: The error text uses `text-destructive` CSS class (red color). Message indicates the file exceeds the 50 MB maximum. No file appears in the attachment list. Upload zone is still interactive (not disabled).
