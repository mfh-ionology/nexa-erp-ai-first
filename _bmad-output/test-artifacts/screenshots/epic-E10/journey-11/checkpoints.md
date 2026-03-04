# Visual Checkpoints — Journey 11: Cancel and Close Email Dialog

## Checkpoint 1: Email dialog opened with pre-filled fields
- **When**: After step 2 — opened email dialog from POSTED invoice
- **Screenshot**: `step-2-email-dialog-opened.png`
- **What to look for**: Email composition dialog visible with pre-filled Subject/To fields, Cancel and Send Email buttons in footer, purple accent top border

## Checkpoint 2: Dialog closed after Cancel click (no toast)
- **When**: After step 4 — clicked Cancel button after modifying subject
- **Screenshot**: `step-4-dialog-closed-after-cancel.png`
- **What to look for**: Invoice detail page fully visible, no dialog overlay, no toast notifications (email was NOT sent)

## Checkpoint 3: Dialog reopened with original template fields
- **When**: After step 6 — reopened the email dialog
- **Screenshot**: `step-6-dialog-reopened-original-fields.png`
- **What to look for**: Email dialog visible again, Subject field has original template-rendered value (NOT "Modified subject text"), confirming cancel discarded changes

## Checkpoint 4: Dialog closed via header X button
- **When**: After step 7 — closed dialog via × button in header
- **Screenshot**: `step-7-dialog-closed-via-x-button.png`
- **What to look for**: Invoice detail page visible again, dialog fully closed, no toast notifications
