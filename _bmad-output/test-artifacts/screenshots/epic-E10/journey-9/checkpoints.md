# Journey 9: Email Action Hidden for Non-Sendable Status — Visual Checkpoints

## Checkpoint 1: Invoice List Page Loaded
- **When**: After navigating to /ar/invoices
- **Screenshot file**: step-1-invoice-list-page.png
- **What to look for**: AR Invoices list page with data table visible, sidebar with AR section active, filter tabs (All, Pending, Paid, Overdue, Draft) visible
- **Visual result**: PASS — Invoice list page loaded correctly with all filter tabs, data table shows invoices with status badges

## Checkpoint 2: Draft Invoice Detail Page
- **When**: After clicking Draft tab and then clicking draft invoice INV-2026-0057
- **Screenshot file**: step-2-draft-invoice-detail.png
- **What to look for**: Invoice detail page showing DRAFT status badge, not POSTED/Overdue
- **Visual result**: FAIL — Detail page shows INV-2026-0042 with "Overdue" status badge instead of INV-2026-0057 with "Draft". The detail page is a static mock that always renders the same hardcoded invoice data regardless of route param.

## Checkpoint 3: Overflow Menu — Email Action Hidden or Disabled
- **When**: After clicking the More Actions overflow menu on the (expected) DRAFT invoice
- **Screenshot file**: step-4-overflow-menu-email-hidden.png
- **What to look for**: "Email to Customer" should be absent or greyed out/disabled for DRAFT invoices
- **Visual result**: FAIL — "Email to Customer" is fully enabled in the overflow menu because the detail page always uses `mockStatus = 'POSTED'`. The menu shows: Email to Customer, Export PDF, Duplicate, Void, View Audit Log — all enabled.
