# Journey 6: Switch Email Template via Template Selector — Visual Checkpoints

## Checkpoint 1: Email dialog opened with default template
- **When**: After step 2 — email composition dialog opens with default INVOICE_SEND template
- **Screenshot file**: `step-2-email-dialog-default-template.png`
- **What to look for**: Email composition dialog visible with purple accent top border, template selector dropdown showing current template name, subject pre-filled with template-rendered value containing "Invoice", body textarea populated with template content

## Checkpoint 2: Subject manually modified
- **When**: After step 4 — subject field has been manually overridden
- **Screenshot file**: `step-4-subject-manually-modified.png`
- **What to look for**: Subject input now shows "Custom subject override" instead of the template-rendered subject, body unchanged

## Checkpoint 3: Template selector dropdown open
- **When**: After step 5 — template dropdown clicked open
- **Screenshot file**: `step-5-template-dropdown-open.png`
- **What to look for**: Dropdown open showing list of available templates for CustomerInvoice document type, including the default INVOICE_SEND template

## Checkpoint 4: Fields reset to template values
- **When**: After step 7 — "Reset to Template" button clicked
- **Screenshot file**: `step-7-fields-reset-to-template.png`
- **What to look for**: Subject field restored to template-rendered value (no longer shows "Custom subject override"), body field shows freshly rendered template content
