# Epic E10 — Email Integration: v0 Prompt

> **Usage:** Paste the **Design System Base** from `epic-E5-E5b-v0-prompt.md` (lines 1-185) FIRST, then append the epic-specific section below.

---

## EPIC-SPECIFIC SECTION: E10 — Email Integration

### Epic Context

Email template management and document-to-email composition for sending invoices, POs, statements as PDF attachments via SMTP.

**Sidebar location:** System > Email Templates

---

### Screen 1: Email Template Editor

**Template:** T7 — Settings (split-pane variant)
**Route:** `/system/email-templates/:id`
**Story:** E10.S2

```
┌─────────────────────────────────────────────────────────────┐
│ [← Back] Email Template: Sales Invoice       [Preview] [Save]│
├──────────────────────────┬──────────────────────────────────┤
│ ── Editor ────────────── │ ── Live Preview ───────────────  │
│                          │                                  │
│ Name: [Sales Invoice   ] │ ┌──────────────────────────────┐ │
│ Document Type: [Invoice] │ │ Subject:                     │ │
│ Language: [en ▼]         │ │ Invoice INV-00234 from       │ │
│                          │ │ Acme Ltd                     │ │
│ Subject:                 │ │                              │ │
│ [Invoice {{number}} from │ │ Dear Mr Smith,               │ │
│  {{company_name}}       ]│ │                              │ │
│                          │ │ Please find attached invoice │ │
│ Body (HTML):             │ │ INV-00234 for £4,250.00.     │ │
│ ┌─────────────────────┐  │ │                              │ │
│ │ Dear {{contact}},   │  │ │ Payment is due by            │ │
│ │                     │  │ │ 15 March 2026.               │ │
│ │ Please find attach  │  │ │                              │ │
│ │ ed invoice {{numb   │  │ │ Kind regards,                │ │
│ │ er}} for {{total}}. │  │ │ Acme Ltd                     │ │
│ │                     │  │ └──────────────────────────────┘ │
│ │ Payment due:        │  │                                  │
│ │ {{due_date}}.       │  │ Variables Available:             │
│ │                     │  │ ┌────────────────────────────┐   │
│ │ {{signature}}       │  │ │ number    │ Invoice number │   │
│ └─────────────────────┘  │ │ total     │ £4,250.00      │   │
│                          │ │ due_date  │ 15 Mar 2026    │   │
│ [{{] triggers variable   │ │ contact   │ Mr Smith       │   │
│ autocomplete dropdown    │ │ company   │ Acme Ltd       │   │
│                          │ │ signature │ Kind regards...│   │
│                          │ │ bank_dtls │ Sort: 12-34... │   │
│                          │ └────────────────────────────┘   │
├──────────────────────────┴──────────────────────────────────┤
│ Version: 3  │  Last edited: 2h ago by Sarah                  │
└─────────────────────────────────────────────────────────────┘
```

**Components needed:**
- Split-pane layout: left editor (50%), right preview (50%) — resizable divider
- Left pane form fields: Name (text input), Document Type (select: Invoice, PO, Credit Note, Statement), Language (select: en, fr, de)
- Subject template input with `{{` autocomplete (Popover + Command list)
- HTML body editor with Handlebars syntax highlighting (monospace font: JetBrains Mono)
- `{{` keystroke triggers autocomplete dropdown showing available variables for selected document type
- Right pane: rendered HTML preview in card (debounced 500ms update on keystroke)
- Variables panel: table of available variables with name + sample value, click to insert
- Preview button opens full rendered email dialog with sample data
- Version footer: "Version N | Last edited: Xh ago by Name"
- Action bar: Back button (ghost), Preview (outline), Save (primary `#7c3aed`)
- Duplicate, Deactivate, View Versions in overflow menu

**Variable Sets by Document Type:**
- Invoice: `number, total, due_date, contact, company_name, signature, bank_details, currency, tax_total, line_items`
- PO: `number, total, supplier_name, delivery_date, signature, currency`
- Credit Note: `number, total, original_invoice, contact, company_name, signature`
- Statement: `customer_name, balance, due_amount, period_start, period_end, company_name`

**Responsive:**
- Desktop: Full split-pane as designed
- Tablet: Preview becomes collapsible tab below editor
- Phone: Single column — editor only, "Preview" button opens full-screen preview sheet

---

### Component 1: Email Composition Dialog

**Container:** Dialog (centered modal, 600px wide)
**Trigger:** "Email" action in Action Bar overflow menu on document detail pages
**Story:** E10.S3

```
┌─ Send Invoice INV-00234 via Email                        [✕] ─┐
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ From: [accounts@acme.co.uk ▼]                                 │
│                                                                │
│ To:   [accounts@customer.co.uk ✕] [john@customer.co.uk ✕]    │
│       [+ Add recipient                                    ]    │
│                                                                │
│ [+ Cc] [+ Bcc]                              ← expand toggles  │
│                                                                │
│ ─────────────────────────────────────────────────────────────  │
│                                                                │
│ Subject: [Invoice INV-00234 from Acme Ltd                  ]   │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Dear Mr Smith,                                           │   │
│ │                                                          │   │
│ │ Please find attached invoice INV-00234 for £4,250.00    │   │
│ │ dated 1 March 2026.                                      │   │
│ │                                                          │   │
│ │ Payment is due by 15 March 2026.                         │   │
│ │                                                          │   │
│ │ Kind regards,                                            │   │
│ │ Acme Ltd                                                 │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                │
│ ── Attachments ──────────────────────────────────────────────  │
│ ┌──────────────────────────────────────────────────────┐      │
│ │ 📄 Invoice-INV-00234.pdf  │  142 KB  │ Auto-generated │ [✕] │
│ └──────────────────────────────────────────────────────┘      │
│ [+ Attach File]                                                │
│                                                                │
│ ── Template ─────────────────────────────────────────────────  │
│ Template: [Sales Invoice ▼]           [Reset to Template]      │
│                                                                │
│                                         [Cancel] [Send Email]  │
└────────────────────────────────────────────────────────────────┘
```

**Components needed:**
- Dialog header: document title + close button, purple accent top border
- From field: dropdown of company email aliases (accounts@, sales@, support@)
- To field: multi-email chip input, pre-filled from customer/supplier contact email, validate RFC 5322
- Cc/Bcc: initially hidden behind `[+ Cc]` / `[+ Bcc]` toggle links, same multi-email chips
- Separator between header fields and body
- Subject: single-line text input, pre-filled from resolved template
- Body: tall textarea (300px min height) with rich text capabilities, pre-filled from resolved template
- Attachment section: auto-generated PDF shown as card (file icon, name, size), remove button
- Additional attachments via `[+ Attach File]` button (uses E8 presign upload)
- Template selector: dropdown to switch templates, "Reset to Template" ghost button
- Action buttons: Cancel (ghost), Send Email (primary `#7c3aed`, loading spinner on click)
- Success: toast notification "Email queued for delivery" with checkmark
- Error: toast with retry option
- Duplicate recipient prevention: warn on duplicate email addresses

**Email Chip Input Behaviour:**
- Type email and press Enter/comma to create chip
- Chip shows email with ✕ remove button
- Invalid emails highlighted in red with tooltip
- Autocomplete from recent contacts (optional enhancement)

**Responsive:**
- Desktop: 600px centered modal as designed
- Tablet: 90% viewport width modal
- Phone: Full-screen sheet (bottom-up), stacked layout, Send button fixed at bottom

---

## Generation Instructions

Generate all screens listed above as React components using:
- Shadcn UI components (already installed: accordion, alert-dialog, avatar, badge, breadcrumb, button, card, checkbox, collapsible, command, dialog, dropdown-menu, form, input, label, popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip)
- Tailwind CSS 4 classes
- TypeScript
- Lucide React icons

For each screen, provide:
1. The main page component
2. Any new sub-components listed under "Components needed"
3. Mock data that demonstrates the layout with realistic ERP data (UK company names, GBP amounts, realistic statuses)

Ensure:
- Page background is `#f4f2ff` throughout
- All cards use 12px radius and purple-tinted hover shadow
- Amounts use JetBrains Mono font
- Status badges use the semantic colour palette defined in the base
- All animations use fadeInUp/slideIn/stepIn as specified
- Loading states use skeleton patterns, not spinners
- Empty states have illustration + message + CTA
- Focus rings use `ring-2 ring-[#7c3aed]/30` on all interactive elements
- The overall feel is premium and polished — NOT generic SaaS
- Email template editor: code editor area uses monospace font with syntax-aware colouring for `{{variables}}`
- Email composition dialog: professional email client feel, clean field layout
- Variable autocomplete: smooth popover dropdown, purple highlight on selected item
