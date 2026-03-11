# Visual Checkpoints — Journey 5: Upload Document Flow

## Checkpoint 1: Knowledge Articles Tab Loaded
- **When**: After navigating to /ai/admin/knowledge and page loads
- **Screenshot**: `step-1-knowledge-articles-loaded.png`
- **What to look for**: Knowledge Management heading visible, Knowledge Articles tab active, article cards displayed (or empty state), "Upload Document" purple button visible in action bar

## Checkpoint 2: Upload Dialog Open
- **When**: After clicking "Upload Document" button
- **Screenshot**: `step-2-upload-dialog-open.png`
- **What to look for**: Modal dialog with "Upload Document" title, dashed-border drag-drop zone with "Drop files here or click to browse" text, "or paste content" separator, Content textarea, Title input, Category selector, Cancel and "Upload & Create" buttons. Upload & Create button should be disabled (no content yet).

## Checkpoint 3: Form Filled with Content
- **When**: After pasting content, filling title, and selecting category
- **Screenshot**: `step-3-form-filled.png`
- **What to look for**: Content textarea populated with markdown text about PO Approval Workflow, Title field shows "PO Approval Workflow SOP", Category dropdown shows "Business Processes", Upload & Create button should now be enabled (purple)

## Checkpoint 4: Success — Article Created
- **When**: After clicking Upload & Create and waiting for response
- **Screenshot**: `step-4-article-created-success.png`
- **What to look for**: Dialog should be closed, success toast visible ("Knowledge article created and indexed"), new article "PO Approval Workflow SOP" should appear in the Business Processes category accordion group, card shows "Admin Uploaded" source badge, chunk count in metadata
