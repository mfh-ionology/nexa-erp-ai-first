# Visual Checkpoint Manifest — Journey 18: Smart Suggestions Change with Page Context

## Checkpoint 1: Dashboard Quick Prompt Chips
- **When**: After Step 3 — Co-Pilot drawer opened on Dashboard page
- **Screenshot file**: step-3-dashboard-chips.png
- **What to look for**:
  - Co-Pilot drawer is open on the right side
  - Quick prompt chips are visible at the bottom of the drawer
  - Chips show dashboard/general-context suggestions: 'Morning briefing', 'What needs my attention?', 'Revenue this month' (or similar role-based prompts)
  - Current page is the Dashboard (breadcrumb or URL confirms `/`)

## Checkpoint 2: Customer Detail Quick Prompt Chips
- **When**: After Step 5 — navigated to Customer Detail page with Co-Pilot still open
- **Screenshot file**: step-5-customer-detail-chips.png
- **What to look for**:
  - Co-Pilot drawer is still open on the right side
  - Quick prompt chips have CHANGED from Dashboard chips
  - Chips now show customer-context suggestions: 'Invoice this customer', 'Show payment history', 'Credit check', 'View outstanding'
  - Current page is a Customer Detail page (page title or breadcrumb confirms customer entity)

## Checkpoint 3: Payment History Response After Chip Click
- **When**: After Step 6 — clicked 'Show payment history' chip and AI responded
- **Screenshot file**: step-6-payment-history-response.png
- **What to look for**:
  - Conversation area shows auto-submitted prompt 'Show payment history' as a user message
  - AI streaming/completed response about customer payment history is visible
  - The interaction was triggered by a one-tap chip click (seamless UX)
  - No errors visible in conversation area

## Checkpoint 4: Invoice List Quick Prompt Chips
- **When**: After Step 8 — navigated to Invoice List page with Co-Pilot still open
- **Screenshot file**: step-8-invoice-list-chips.png
- **What to look for**:
  - Co-Pilot drawer is still open on the right side
  - Quick prompt chips have CHANGED again from customer-context chips
  - Chips now show invoice-list-context suggestions: 'Show overdue', 'Create invoice', 'Export all', 'Send statements'
  - Current page is the Invoice List page (breadcrumb or URL confirms `/ar/invoices`)
  - Three different pages have shown three different sets of contextual suggestions
