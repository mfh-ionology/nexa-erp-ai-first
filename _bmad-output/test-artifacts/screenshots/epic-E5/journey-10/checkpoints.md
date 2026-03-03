# Visual Checkpoint Manifest — Journey 10: Reject an AI Action Proposal

## Checkpoint 1: Action proposal card for SEND_EMAIL
- **When**: After step 3 — AI has processed the email request and rendered the action proposal card
- **Screenshot file**: `step-3-send-email-action-proposal.png`
- **What to look for**:
  - Action proposal card visible in the Co-Pilot drawer conversation
  - Card shows action type SEND_EMAIL
  - Preview shows email details (recipient: Acme Corp, subject about overdue payment, draft body)
  - Confirm button (primary/green) visible and enabled
  - Reject button (secondary/red) visible and enabled
  - Confidence score displayed with colour coding

## Checkpoint 2: Rejection acknowledged — action cancelled
- **When**: After step 4 — User clicked Reject, AI has acknowledged the cancellation
- **Screenshot file**: `step-4-action-rejected-cancelled.png`
- **What to look for**:
  - Action proposal card shows cancelled/rejected state (greyed out, crossed out, or status badge)
  - AI acknowledgement message visible: "Action cancelled. No changes were made." or similar
  - No error state — conversation is intact and healthy
  - Chat input field is ready for the next message
  - Confirm/Reject buttons are no longer clickable (disabled or removed)

## Checkpoint 3: Conversation continues after rejection
- **When**: After step 6 — User sent a follow-up message and AI responded normally
- **Screenshot file**: `step-6-conversation-continues.png`
- **What to look for**:
  - Full conversation thread visible: original request, action proposal (rejected), cancellation acknowledgement, follow-up user message, AI follow-up response
  - AI response to "What else needs my attention?" is a normal, contextual response (not an error)
  - Conversation flow is unbroken — rejection did not disrupt the chat
  - Chat input field remains active for further messages
