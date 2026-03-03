# Visual Checkpoint Manifest — Journey 1: Upload Attachment via Drag-and-Drop

## Checkpoint 1: Invoice Detail Page Loaded
- **When**: After navigating to `/ar/invoices/{id}` (Step 1)
- **Screenshot file**: `step-1-invoice-detail-page.png`
- **What to look for**: Invoice detail page rendered with "INV-2026-0042" heading visible. ActionBar should be present with Attachments button (paperclip icon) and Links button in the persistent tools zone. If ActionBar is missing, this indicates the cross-cutting features are not wired to this page.

## Checkpoint 2: Attachment Panel Open (Empty State)
- **When**: After clicking Attachments button in ActionBar (Steps 3-4)
- **Screenshot file**: `step-4-attachment-panel-empty.png`
- **What to look for**: Right-side Sheet panel (dialog role) showing: header with "Attachments" title, dashed-border FileUploadZone with upload icon and "Click or drag files here" instruction text, empty state message below ("No attachments yet"). Panel should be ~400px wide.

## Checkpoint 3: Upload Progress
- **When**: After file is selected/dropped and upload begins (Step 6)
- **Screenshot file**: `step-6-upload-progress.png`
- **What to look for**: UploadProgressBar visible showing file name "test-document.pdf", animated progress bar filling, status text showing current phase (presigning → uploading → confirming). Cancel button should be available.

## Checkpoint 4: Upload Complete — File in List
- **When**: After upload completes and attachment appears in list (Steps 7-8)
- **Screenshot file**: `step-8-attachment-list-with-file.png`
- **What to look for**: AttachmentPanel showing: header with count badge "1", FileUploadZone still at top, uploaded file row below with PDF icon, filename "test-document.pdf", size "240 KB", timestamp "just now", and action buttons (download/delete).

## Checkpoint 5: ActionBar Badge Updated
- **When**: After closing the panel and verifying ActionBar badge (Steps 9-10)
- **Screenshot file**: `step-10-actionbar-badge-updated.png`
- **What to look for**: ActionBar persistent tools zone showing Attachments button with count badge "(1)" next to the paperclip icon, confirming the count persists even after the panel is closed.
