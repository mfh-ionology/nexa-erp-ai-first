# Missing Functionality - Epic E10

> Auto-generated during frontend E2E testing

## Missing: Email template pre-fill not populating dialog fields
- **Journey**: Journey 2 — Verify Pre-filled Email Fields from Template, Step 5 (From field)
- **Expected**: When the email composition dialog opens for a POSTED invoice, all fields should be pre-filled from the email template via the `useDocumentEmailPreview` hook: From (company SMTP email), To (customer email chip), Subject (rendered template "Invoice {number} from {company}"), Body (rendered template HTML with customer greeting and invoice details), Attachment (auto-generated PDF card with filename "Invoice-INV-XXXXX.pdf")
- **Actual**: The dialog opens but ALL fields are empty — From is blank, To shows only placeholder "Add recipient email" with no customer email chip, Subject shows placeholder "Email subject", Body shows placeholder "Email body", Attachments shows "PDF will be generated when available" instead of an auto-generated PDF card. The preview API appears to return no data.
- **Related Story**: E10-3
- **Suggested Story Title**: Fix email preview API to populate composition dialog with template-rendered fields and customer data

## Missing: PDF auto-generated attachment card not displayed
- **Journey**: Journey 2 — Verify Pre-filled Email Fields from Template, Step 9 (PDF attachment)
- **Expected**: Attachment card shows PDF icon, filename like "Invoice-INV-XXXXX.pdf", file size, and "Auto-generated" badge
- **Actual**: Attachments section shows "PDF will be generated when available" — no attachment card is rendered
- **Related Story**: E10-3
- **Suggested Story Title**: Implement auto-generated PDF attachment for document email composition

## Missing: Template selector dropdown not rendered in email composition dialog
- **Journey**: Journey 6 — Switch Email Template via Template Selector, Step 3
- **Expected**: A template selector dropdown should be visible in the email composition dialog showing the current template name (e.g. "INVOICE_SEND"), along with a "Reset to Template" ghost button. Users should be able to switch between available templates for the CustomerInvoice document type.
- **Actual**: The TemplateSelector component returns null because `templates.length === 0`. The API endpoint for fetching email templates by document type returns no templates, so the dropdown and "Reset to Template" button are not rendered at all. This blocks the entire template-switching workflow (steps 3-7).
- **Related Story**: E10-3
- **Suggested Story Title**: Seed email templates and fix template list API to populate template selector dropdown

## Missing: Invalid email chip does not show red/error styling
- **Journey**: Journey 4 — Email Recipient Validation — Invalid Format, Step 4
- **Expected**: Invalid email addresses (e.g. "not-an-email", "missing@domain") should be displayed as chips with red/error styling (red border, red background tint) and an error tooltip indicating RFC 5322 validation failure, visually distinct from valid email chips
- **Actual**: Invalid email chips are created and can be removed (chip CRUD works), but they use the same purple/neutral styling as valid email chips. There is no visual differentiation between valid and invalid email addresses.
- **Related Story**: E10-3
- **Suggested Story Title**: Add visual error styling (red highlight) for invalid email recipient chips

## Missing: No pre-filled customer email in To field (related to template pre-fill issue)
- **Journey**: Journey 4 — Email Recipient Validation — Invalid Format, Step 2
- **Expected**: When the email dialog opens, the To field should already contain the customer's email address as a chip (auto-resolved from the invoice's customer record)
- **Actual**: To field is empty — no customer email chip is present. This is a consequence of the email preview API not returning data (already documented in Journey 2).
- **Related Story**: E10-3
- **Suggested Story Title**: Fix email preview API to populate composition dialog with template-rendered fields and customer data

## Missing: SMTP configuration not set up — email send fails with validation error
- **Journey**: Journey 7 — Send Document Email Successfully, Step 5-6
- **Expected**: After filling To, Subject, and Body fields and clicking Send Email, the email should be queued and a success toast "Email queued for delivery" should appear, and the dialog should close
- **Actual**: Clicking Send Email shows an error toast "Please correct the errors below". The From field (readonly, populated from company SMTP config) is empty because no SMTP settings are configured. The backend validation rejects the send request. The dialog remains open. After cancelling, the invoice detail page is restored correctly.
- **Related Story**: E10-3
- **Suggested Story Title**: Configure SMTP settings in dev seed data so email send flow works end-to-end

## Missing: Invoice detail page does not vary by route param — always shows static POSTED invoice
- **Journey**: Journey 9 — Email Action Hidden for Non-Sendable Status, Step 2-4
- **Expected**: Clicking a DRAFT invoice (INV-2026-0057) from the list should navigate to that invoice's detail page showing DRAFT status badge. The overflow menu should then hide or disable the "Email to Customer" action since DRAFT is not in the SENDABLE_STATUS_MAP.
- **Actual**: The invoice detail page (`invoice-detail-page.tsx`) is a static mock that always renders INV-2026-0042 with hardcoded `mockStatus = 'POSTED'` and "Overdue" badge, regardless of which invoice was clicked. The `useEmailAction` hook always receives `status: 'POSTED'`, so `canEmail` is always `true` and "Email to Customer" is always enabled in the overflow menu. The route param `$id` is not used to look up invoice data.
- **Related Story**: E10-3
- **Suggested Story Title**: Wire invoice detail page to route param and display correct invoice data/status per record

## Missing: PDF attachment preview card — no interactive card with filename, size, badge, or remove button
- **Journey**: Journey 10 — Attachment Preview Card Display and Interaction, Steps 3-5
- **Expected**: Email composition dialog should display a styled PDF attachment preview card with: PDF file icon, filename matching "Invoice-INV-XXXXX.pdf", file size text, "Auto-generated" badge (purple-tinted styling, 12px radius, custom shadow), and a × remove button to detach the file before sending
- **Actual**: Attachments section shows only "PDF will be generated when available." — no interactive card, no filename, no file size, no badge, and no remove button. The entire attachment preview card component appears unimplemented.
- **Related Story**: E10-3
- **Suggested Story Title**: Implement interactive PDF attachment preview card with auto-generation, file info display, and remove action

