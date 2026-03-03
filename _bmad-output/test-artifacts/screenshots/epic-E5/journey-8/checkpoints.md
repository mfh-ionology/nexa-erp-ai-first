# Visual Checkpoint Manifest — Journey 8: Receive an AI Action Proposal

## Checkpoint 1: Action Proposal Card Displayed
- **When**: After Step 3 — user sends "Create an invoice for Acme Corp for £5,000 for consulting services" and AI processes it
- **Screenshot file**: step-3-action-proposal-card-displayed.png
- **What to look for**:
  - User message bubble on the right side of conversation area
  - AI text response visible explaining what it will do
  - Action proposal card rendered below the AI text with:
    - Action type label: CREATE_INVOICE
    - Entity type: CustomerInvoice
    - Description: mentions Acme Corp, £5,000, consulting services
    - Preview data showing proposed field values (customer, amount, description)
    - Confidence score with colour indicator (green >= 90%, amber 70-89%, red < 70%)
    - Two action buttons: "Confirm" (primary/green) and "Reject" (secondary/red)
  - No error messages or broken layouts

## Checkpoint 2: Confidence Score Detail
- **When**: After Step 4 — verify confidence score display
- **Screenshot file**: step-4-confidence-score-detail.png
- **What to look for**:
  - Confidence score visually prominent on the action card
  - Colour coding applied correctly (green/amber/red based on threshold)
  - Score value displayed as percentage or decimal (e.g. "95%" or "0.95")
  - Confidence level label may be visible ("high", "review", "low")

## Checkpoint 3: Preview Data and Action Buttons
- **When**: After Step 5-6 — verify preview data fields and action buttons
- **Screenshot file**: step-6-preview-data-and-buttons.png
- **What to look for**:
  - Preview data card showing proposed record fields clearly:
    - Customer name: Acme Corp
    - Amount: £5,000
    - Description: consulting services
    - Any other inferred fields (date, currency, etc.)
  - "Confirm" button clearly styled as primary action (green/blue)
  - "Reject" button clearly styled as destructive/secondary (red/grey)
  - Both buttons appear clickable and not disabled
