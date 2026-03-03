# Visual Checkpoints — Journey 9: Confirm an AI Action Proposal

## Checkpoint 1: Action Confirmed — Record Created
- **When**: After clicking the "Confirm" button on the action proposal card and waiting for execution to complete
- **Screenshot file**: `step-1-action-confirmed-record-created.png`
- **What to look for**:
  - The action proposal card has transitioned from its initial state to a success/confirmed state
  - A "Record Created" message or success indicator is visible (green checkmark, success icon)
  - The created entity details are shown: entity type (CustomerInvoice), entity ID, display reference (e.g., "INV-000042")
  - An AI confirmation text message like "Invoice INV-000042 created successfully for Acme Corp — £5,000"
  - The Confirm/Reject buttons are no longer active (replaced by success state)

## Checkpoint 2: Record Reference and Navigation Link Visible
- **When**: After the record_created message has fully rendered with all details
- **Screenshot file**: `step-3-record-link-visible.png`
- **What to look for**:
  - A clickable link or button to navigate to the newly created record (e.g., "View INV-000042")
  - The display reference number is clearly visible
  - The full conversation flow is visible: user request → AI text response → action proposal (confirmed) → record created confirmation
  - No error states or broken UI elements
  - The conversation area is scrolled to show the most recent messages
