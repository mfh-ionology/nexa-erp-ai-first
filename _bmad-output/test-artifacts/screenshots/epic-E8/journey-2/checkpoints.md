# Visual Checkpoint Manifest — Journey 2: Download an Attachment

## Checkpoint 1: Invoice detail page loaded
- **When**: After navigating to /ar/invoices/{invoiceId}
- **Screenshot file**: step-1-invoice-detail-page.png
- **What to look for**: Invoice detail page rendered with invoice number (INV-2026-0042), status badge visible, ActionBar toolbar present at top of page

## Checkpoint 2: Attachment panel open with file listed
- **When**: After clicking Attachments button in ActionBar
- **Screenshot file**: step-2-attachment-panel-open.png
- **What to look for**: Right-side Sheet panel visible with "Attachments" heading, previously uploaded file "test-document.pdf" visible in the list with filename, file size, and uploader info. Download button (Download icon) visible on hover/focus within the attachment row.

## Checkpoint 3: Download initiated
- **When**: After clicking the download button on 'test-document.pdf'
- **Screenshot file**: step-3-download-initiated.png
- **What to look for**: No error toast or message visible. The download button should still be present. Network response should have returned a presigned download URL. No visual error states in the panel.
