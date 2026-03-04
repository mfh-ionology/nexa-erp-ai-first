# Visual Checkpoints — Journey 1: Open Email Dialog from Invoice Detail

## Checkpoint 1: Invoice List Page Loaded
- **When**: After navigating to /ar/invoices (Step 1)
- **Screenshot**: `step-1-invoice-list-page.png`
- **What to look for**: AR Invoices list page with data table showing invoice rows, sidebar with AR section active, at least one invoice with POSTED status badge visible

## Checkpoint 2: Invoice Detail with Action Bar
- **When**: After clicking a POSTED invoice and verifying action bar (Step 3)
- **Screenshot**: `step-3-invoice-detail-action-bar.png`
- **What to look for**: Invoice detail page loaded with POSTED status badge, action bar visible at top with More Actions (⋯) overflow menu button present

## Checkpoint 3: Overflow Menu with Email Action
- **When**: After opening the overflow menu and verifying Email option (Step 5)
- **Screenshot**: `step-5-overflow-menu-email-action.png`
- **What to look for**: Dropdown open showing Document Actions section, "Email to Customer" menu item with Mail icon visible and enabled (not greyed out)

## Checkpoint 4: Email Composition Dialog Open
- **When**: After clicking Email to Customer and verifying dialog (Step 7)
- **Screenshot**: `step-7-email-composition-dialog.png`
- **What to look for**: 600px centered modal with purple accent top border, dialog title includes invoice number (e.g. "Send Invoice INV-XXXXX via Email"), From dropdown populated, To field has customer email chip, Subject contains "Invoice" text from template, Body area has rendered template HTML, PDF attachment card at bottom with filename and auto-generated badge, Cancel and Send Email buttons in footer
