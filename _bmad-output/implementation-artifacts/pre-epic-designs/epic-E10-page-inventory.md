# Epic E10 — Email Integration: Page Inventory

**Date:** 2026-03-04
**Epic:** E10 — Email Integration
**Dependencies:** E9 (Notifications), E8 (Attachments for file handling)
**Status:** Pending Approval

---

## Page / Component Inventory

### 1. Email Template Editor (Settings Page)

| Property | Value |
|----------|-------|
| **Type** | Full page |
| **Template** | T7 — Settings (split-pane variant) |
| **Route** | `/system/email-templates/:id` |
| **Story** | E10.S2 |
| **Sidebar** | System > Email Templates |
| **Role** | ADMIN |

**Description:** Split-pane editor for creating and managing email templates with Handlebars variable support. Left pane has form fields (name, document type, language) and an HTML code editor with `{{variable}}` autocomplete. Right pane shows a live rendered preview that updates on keystroke (debounced 500ms). Footer shows version history. Templates are scoped per document type (Invoice, PO, Credit Note, Statement).

**Key Interactions:**
- Type `{{` in subject or body to trigger variable autocomplete dropdown
- Select document type to change available variable list
- Preview updates in real-time as editor content changes
- Save creates/updates EmailTemplate record via API
- "Preview" button opens full rendered email in dialog with sample data
- Version badge shows last edit info

**Components Needed:**
- `<EmailTemplateEditor>` — Main split-pane layout
- `<TemplateCodeEditor>` — HTML editor with Handlebars syntax highlighting
- `<TemplatePreviewPane>` — Rendered HTML preview
- `<VariableAutocomplete>` — `{{` triggered dropdown of valid variables
- `<VariableListPanel>` — Available variables for selected document type
- `<TemplateVersionBadge>` — Footer version info

---

### 2. Email Composition Dialog (Modal)

| Property | Value |
|----------|-------|
| **Type** | Dialog modal (600px wide) |
| **Template** | Dialog (centered modal) |
| **Route** | N/A (triggered from Action Bar overflow on document detail pages) |
| **Story** | E10.S3 |
| **Trigger** | "Email" action in overflow menu on Invoice, PO, Statement detail pages |
| **Role** | MANAGER+ |

**Description:** Modal dialog for composing and sending documents as email with PDF attachment. Pre-fills from email template with resolved Handlebars variables from the current document. Shows From (company alias dropdown), To (pre-filled from contact, multi-email chips), Cc/Bcc (collapsible), Subject, Body (rich text), and Attachments (auto-generated PDF + optional additional files). Template selector allows switching templates and resetting content.

**Key Interactions:**
- Dialog opens from "Email" in action bar overflow menu
- Fields pre-filled from email template + document data
- To/Cc/Bcc fields support multiple email addresses with chip inputs
- Auto-generated PDF attachment shown with remove option
- Additional file attachments via file picker (uses E8 attachment upload pipeline)
- Template selector dropdown switches templates, "Reset to Template" repopulates
- Send button shows loading state, then success toast
- Validation: valid email addresses, no duplicates, document in sendable state

**Components Needed:**
- `<EmailCompositionDialog>` — Main dialog container
- `<EmailRecipientField>` — Multi-email chip input with validation
- `<EmailBodyEditor>` — Rich text or HTML editor for body
- `<AttachmentPreview>` — PDF attachment card with remove
- `<TemplateSelector>` — Dropdown to switch/reset templates

---

## Template Assignment Summary

| # | Page/Component | Template | Story | New Components |
|---|---------------|----------|-------|----------------|
| 1 | Email Template Editor | T7 (Settings, split-pane) | E10.S2 | EmailTemplateEditor, TemplateCodeEditor, TemplatePreviewPane, VariableAutocomplete, VariableListPanel |
| 2 | Email Composition Dialog | Dialog (modal) | E10.S3 | EmailCompositionDialog, EmailRecipientField, EmailBodyEditor, AttachmentPreview, TemplateSelector |

---

## Shadcn Components Required

| Component | Status | Notes |
|-----------|--------|-------|
| `Dialog` | Already installed | For email composition modal |
| `Form` | Already installed | Template editor form |
| `Input` | Already installed | Standard text inputs |
| `Select` | Already installed | Document type, language, template selector |
| `Button` | Already installed | Save, Send, Cancel |
| `Textarea` | Already installed | Email body fallback |
| `Card` | Already installed | Preview pane, attachment card |
| `Badge` | Already installed | Variable pills, version badge |
| `Popover` | Already installed | Variable autocomplete |
| `Command` | Already installed | Autocomplete list |
| `Sonner/Toast` | Already installed | Success/error feedback |
| `Separator` | Already installed | Section dividers |
| `Tooltip` | Already installed | Variable descriptions |

---

## Notes

- **No Email List Page (T1) in MVP** — Email history/sent items page deferred. The composition dialog covers the primary send use case.
- **HTML Editor** — Template body uses HTML with Handlebars. Consider Monaco Editor for syntax highlighting or a lighter code editor component.
- **Document Types** — SALES_INVOICE, PURCHASE_ORDER, CUSTOMER_STATEMENT, CREDIT_NOTE initially. Expandable per document module.
- **E12 Dependency** — The auto-generated PDF attachment depends on E12 (Document Templates & PDF). If E12 is not yet done, the attachment section can show a placeholder or use a basic PDF generation.
- **Integration Points** — The "Email" action must be added to the Action Bar overflow menu on existing document detail pages (T3 template).
