# Visual Checkpoints — Journey 3: Create a Credit Note Template for Filter Testing

## CP-1: Document Templates page loaded
- **When**: After navigating to /settings/document-templates and waiting for content
- **Screenshot**: step-1-document-templates-loaded.png
- **What to look for**: Page heading "Document Templates" visible, "Add Template" button with purple background, accordion sections showing seeded templates grouped by document type

## CP-2: Template editor form opened
- **When**: After clicking "Add Template" button
- **Screenshot**: step-2-template-editor-form.png
- **What to look for**: Editor form visible with Document Type dropdown, Name input, Description textarea, page settings, branding toggles, and HTML template textarea. Form should be empty/default state.

## CP-3: Credit Note form populated
- **When**: After filling all form fields with CREDIT_NOTE template data
- **Screenshot**: step-3-form-populated.png
- **What to look for**: Document Type shows "Credit Note", Name field contains "E2E Credit Note Compact", Description filled, Page Size shows "A5", Orientation shows "Landscape", Show Logo OFF, Show Bank Details OFF, Show VAT Number ON, Show Company Reg OFF, HTML template textarea populated with credit note HTML.

## CP-4: Save success — toast and list refresh
- **When**: After clicking Save and waiting for response
- **Screenshot**: step-4-save-success.png
- **What to look for**: Success toast visible with text indicating template was created. List view should be showing (Add Template button visible again). CREDIT_NOTE section should now show 2 templates — the seeded default and the new "E2E Credit Note Compact" with green Active badge, A5/landscape metadata displayed.
