# Visual Checkpoints — Journey 4: Create Knowledge Article via Dialog

## Checkpoint 1: Knowledge Page Initial Load
- **When**: After navigating to /ai/admin/knowledge and page loads
- **Screenshot**: `step-1-knowledge-page-loaded.png`
- **What to look for**: Knowledge Management heading visible, Knowledge Articles tab active, "Create Article" button visible (outline style), "Upload Document" button visible (primary purple), purple background

## Checkpoint 2: Create Article Dialog Open
- **When**: After clicking "Create Article" button
- **Screenshot**: `step-2-create-article-dialog-open.png`
- **What to look for**: Modal dialog visible with title field, category select dropdown, content textarea, Save/Submit button, 12px border radius, overlay backdrop

## Checkpoint 3: Form Filled with Test Data
- **When**: After filling title, category, and content fields
- **Screenshot**: `step-3-form-filled.png`
- **What to look for**: Title field shows "EU Reverse Charge VAT Rules", category shows "Terminology" selected, content textarea shows the VAT code text, Save button should be enabled

## Checkpoint 4: Article Created — Success Toast & List Updated
- **When**: After clicking Save and dialog closes
- **Screenshot**: `step-4-article-created-success.png`
- **What to look for**: Success toast visible with text about article created/indexed, dialog dismissed, new article "EU Reverse Charge VAT Rules" visible in the Terminology section, source badge "Admin" (purple), confidence 1.0
