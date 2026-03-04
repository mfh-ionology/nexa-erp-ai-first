# Visual Checkpoints — Journey 10: Attachment Preview Card Display and Interaction

## Checkpoint 1: Email Dialog with Attachment Card
- **When**: After opening email composition dialog (step 2)
- **Screenshot**: `step-2-email-dialog-with-attachment.png`
- **What to look for**: Email composition dialog visible with PDF attachment preview card at the bottom. Card should show: PDF file icon, filename matching 'Invoice-INV-XXXXX.pdf' pattern, file size text, 'Auto-generated' badge, × remove button. Card should have purple-tinted styling with 12px radius and custom shadow.
- **Visual Review Result**: FAIL — Attachments section shows only "PDF will be generated when available." placeholder text. No interactive PDF card, no filename, no file size, no badge, no remove button. Additionally, From field is empty, To field has no customer email chip, Subject/Body show only placeholder text — all fields are unpopulated.

## Checkpoint 2: Attachment Card Removed
- **When**: After clicking × remove button on the attachment card (step 4)
- **Screenshot**: `step-4-attachment-removed.png`
- **What to look for**: Attachment preview card is no longer visible. The attachment area may show an '[+ Attach File]' button or be empty. The rest of the email dialog (To, Subject, Body fields) should still be intact.
- **Visual Review Result**: SKIPPED — No attachment card exists to remove. Screenshot shows same state as checkpoint 1 since the test early-returned after detecting the placeholder.
