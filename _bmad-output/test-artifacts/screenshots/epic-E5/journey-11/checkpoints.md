# Visual Checkpoint Manifest — Journey 11: Financial Actions Always Require User Confirmation

## Journey Overview
Verify that financial actions (post journal, process payment) ALWAYS require explicit user confirmation regardless of confidence score (NFR16). AI never auto-executes financial transactions.

---

## Checkpoint 1: POST_JOURNAL action proposal requires approval
- **When**: After Step 3 — user sends "Post journal entry: debit Office Supplies £500, credit Cash £500" and the AI returns an action proposal
- **Screenshot file**: `step-3-post-journal-action-proposal.png`
- **What to look for**:
  - Action proposal card visible for POST_JOURNAL action type
  - Card shows journal details (debit Office Supplies £500, credit Cash £500)
  - An 'Approval Required' or 'Financial action — confirmation required' label/badge visible
  - Confirm and Reject buttons prominently displayed and enabled
  - The journal entry is NOT auto-executed — it is staged for user approval
  - Confidence score visible with colour coding (even if high >=90%, action is not auto-executed)

## Checkpoint 2: Approval Required indicator is clearly visible
- **When**: After Step 4 — verifying the 'Approval Required' indicator on the financial action card
- **Screenshot file**: `step-4-approval-required-indicator.png`
- **What to look for**:
  - A visual badge, label, or icon clearly communicates this is a financial action requiring confirmation
  - The action has NOT been auto-executed (no success/completed state visible)
  - The proposal is in a pending/awaiting-approval state

## Checkpoint 3: CREATE_PAYMENT also requires approval (guardrail confirmed)
- **When**: After Step 6 — user sends "Process payment of £2,000 to Smith & Sons Ltd" and the AI returns a second action proposal
- **Screenshot file**: `step-6-payment-action-proposal.png`
- **What to look for**:
  - Second action proposal card visible for CREATE_PAYMENT action type
  - Payment details shown (£2,000, Smith & Sons Ltd)
  - This proposal ALSO requires explicit confirmation — not auto-executed
  - Both the journal and payment proposals required approval — confirming the financial guardrail applies universally
  - Confirm and Reject buttons visible on the payment proposal card
