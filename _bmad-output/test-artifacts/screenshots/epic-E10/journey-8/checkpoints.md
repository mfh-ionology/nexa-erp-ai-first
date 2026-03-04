# Visual Checkpoint Manifest — Journey 8: Send Email Blocked Without TO Recipient

## Checkpoint 1: Email dialog opened with pre-filled TO recipient
- **When**: After opening email dialog from POSTED invoice (step 2)
- **Screenshot file**: `step-2-email-dialog-with-to-chip.png`
- **What to look for**: Email composition dialog visible with purple top border, dialog title includes invoice number, To field contains at least one email chip (customer email), Send Email button enabled (primary purple)

## Checkpoint 2: TO field empty after removing chip
- **When**: After clicking × to remove the pre-filled TO email chip (step 3)
- **Screenshot file**: `step-3-to-field-empty.png`
- **What to look for**: To field is now empty (no email chips), placeholder text may be visible, Send Email button should now be disabled (greyed out) because canSend requires toEmails.length > 0

## Checkpoint 3: Send blocked — validation error shown
- **When**: After clicking Send Email with empty TO field (step 4)
- **Screenshot file**: `step-4-send-blocked-validation.png`
- **What to look for**: Dialog remains open (not closed), To field may show error styling (red border), Send Email button was disabled so click may have no effect, or if somehow clicked shows error. No success toast. Dialog still visible with all fields.
