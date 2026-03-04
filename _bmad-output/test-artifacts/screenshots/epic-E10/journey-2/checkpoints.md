# Visual Checkpoints — Journey 2: Verify Pre-filled Email Fields from Template

## Checkpoint 1: Email dialog opened with pre-filled fields
- **When**: After step 4 — clicking Email to Customer menu item
- **Screenshot file**: step-4-email-dialog-opened.png
- **What to look for**: Email composition dialog visible with purple accent top border, title includes invoice number, From field populated with company email, To field has customer email chip, Subject populated from template, Body textarea has template content, PDF attachment card at bottom

## Checkpoint 2: From field shows company email (read-only)
- **When**: After step 5 — verifying From field
- **Screenshot file**: step-5-from-field-populated.png
- **What to look for**: From field shows a company email address (read-only input, not editable), greyed/dimmed background indicating non-interactive

## Checkpoint 3: To field with customer email chip
- **When**: After step 6 — verifying To field
- **Screenshot file**: step-6-to-field-customer-chip.png
- **What to look for**: To field contains an email chip with purple-tinted styling, customer email address visible within the chip, chip has an X remove button

## Checkpoint 4: Subject matches template pattern
- **When**: After step 7 — verifying Subject field
- **Screenshot file**: step-7-subject-from-template.png
- **What to look for**: Subject input field contains text matching pattern "Invoice {number} from {company}" — actual invoice number and company name substituted

## Checkpoint 5: PDF attachment card
- **When**: After step 9 — verifying PDF attachment preview
- **Screenshot file**: step-9-pdf-attachment-card.png
- **What to look for**: PDF attachment card with purple-tinted styling (12px radius, custom shadow), showing PDF file icon (red), filename matching "Invoice-INV-XXXXX.pdf" pattern, file size text, and "Auto-generated" badge in purple
