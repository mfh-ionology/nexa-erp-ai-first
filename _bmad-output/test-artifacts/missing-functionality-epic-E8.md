# Missing Functionality - Epic E8

> Auto-generated during frontend E2E testing

## Missing: Cross-cutting ActionBar with Attachments button not wired into invoice detail page
- **Journey**: Journey 2 (Download an Attachment), Step 2
- **Expected**: The invoice detail page (/ar/invoices/$id) should display an ActionBar toolbar with persistent "Attachments" and "Links" buttons (with count badges) as specified in E8.4 (Cross-Cutting UI). Clicking "Attachments" should open the AttachmentPanel Sheet.
- **Actual**: The invoice detail page uses custom header actions ("Send Reminder", "Print", overflow menu) from the v0 design reference. No "Attachments" button exists on the page. The reusable ActionBar component with cross-cutting persistent tools is not integrated.
- **Related Story**: E8.4
- **Suggested Story Title**: Wire cross-cutting ActionBar (Attachments + Links persistent tools) into record detail pages (AR Invoices)

## Missing: Client-side executable file type rejection cannot be tested (blocked by missing ActionBar)
- **Journey**: Journey 3 (Reject Executable File Upload), Step 2
- **Expected**: The invoice detail page should have an Attachments button in the ActionBar. Clicking it opens the AttachmentPanel with FileUploadZone. Uploading a .exe file should trigger client-side validation rejecting the file before any presign API call is made, displaying a "file type not allowed" error (crossCutting.attachments.blockedFileType).
- **Actual**: Test cannot proceed past Step 2 because the Attachments button does not exist on the invoice detail page. The FileUploadZone component has the validation logic (blocked extensions: .exe, .bat, .sh, .cmd, .com, .msi, .ps1, .vbs), but it cannot be reached without the ActionBar integration.
- **Related Story**: E8.4
- **Suggested Story Title**: Wire cross-cutting ActionBar (Attachments + Links persistent tools) into record detail pages (AR Invoices)

## Missing: Client-side oversized file rejection cannot be tested (blocked by missing ActionBar)
- **Journey**: Journey 4 (Reject Oversized File Upload), Step 2
- **Expected**: The invoice detail page should have an Attachments button in the ActionBar. Clicking it opens the AttachmentPanel with FileUploadZone. Uploading a file exceeding 50MB should trigger client-side validation rejecting the file before any presign API call is made, displaying a "file too large" error (crossCutting.attachments.fileTooLarge with maxMB=50).
- **Actual**: Test cannot proceed past Step 2 because the Attachments button does not exist on the invoice detail page. The FileUploadZone component has the validation logic (DEFAULT_MAX_SIZE = 50 * 1024 * 1024), but it cannot be reached without the ActionBar integration. The invoice detail page uses a bespoke v0 static mock header with "Send Reminder", "Print", and overflow menu — no cross-cutting persistent tools.
- **Related Story**: E8.4
- **Suggested Story Title**: Wire cross-cutting ActionBar (Attachments + Links persistent tools) into record detail pages (AR Invoices)

## Missing: Attachment delete flow cannot be tested (blocked by missing ActionBar)
- **Journey**: Journey 5 (Delete Attachment as MANAGER), Step 2
- **Expected**: The invoice detail page (/ar/invoices/$id) should display an ActionBar toolbar with persistent "Attachments" button. Clicking it opens the AttachmentPanel containing an existing attachment with a visible delete button (Trash2 icon) for MANAGER/SUPER_ADMIN users. Clicking delete should show an AlertDialog confirmation, and confirming should remove the attachment and display empty state.
- **Actual**: Test cannot proceed past Step 2 because the Attachments button does not exist on the invoice detail page. The AttachmentPanel, AttachmentList (with delete gating via canDelete prop), and AlertDialog confirmation components all exist and are unit-tested, but cannot be reached from the invoice detail page without the ActionBar integration. The page uses a static v0 mock header with "Send Reminder", "Print", and overflow menu.
- **Related Story**: E8.4
- **Suggested Story Title**: Wire cross-cutting ActionBar (Attachments + Links persistent tools) into record detail pages (AR Invoices)

## Missing: RBAC attachment delete restriction cannot be tested — no Attachments button on invoice detail page, no STAFF user seeded
- **Journey**: Journey 6 (STAFF User Cannot Delete Attachments), Step 2
- **Expected**: A STAFF-role user logs in and navigates to /ar/invoices/$id. The invoice detail page should display an ActionBar with persistent "Attachments" button. Clicking it opens the AttachmentPanel showing existing attachments. For STAFF role, the download button should be visible but the delete button (Trash2 icon) should be hidden (canDelete=false per RBAC, controlled by usePermission hook in AttachmentPanel).
- **Actual**: Two blockers prevent this test: (1) The invoice detail page has no Attachments button — it uses a static v0 mock header with "Send Reminder", "Print", and overflow menu instead of the reusable ActionBar with cross-cutting persistent tools. (2) No STAFF-role user exists in the seed data — only admin@nexa-erp.dev with SUPER_ADMIN role is seeded. The RBAC logic (canDelete gating in AttachmentList component, line 125) exists but cannot be E2E tested without both prerequisites.
- **Related Story**: E8.4
- **Suggested Story Title**: Wire cross-cutting ActionBar into record detail pages AND seed STAFF/MANAGER test users for RBAC E2E testing

## Missing: Notes tab not wired into invoice detail page — cannot create a General Note
- **Journey**: Journey 7 (Create a General Note), Step 2
- **Expected**: The invoice detail page (/ar/invoices/$id) should use the RecordDetailPage (T2 template) with a tabbed layout. A "Notes" tab (with MessageSquare icon) should be visible alongside "Details" and other tabs. Clicking the Notes tab should render the NotesTab/NotesPanel component, which shows an "Add Note" button, a timeline of existing notes, and the AddNoteForm for creating new notes with type selector (General/Internal/Customer Visible).
- **Actual**: The invoice detail page is a static v0 design reference mock. It has no tab structure at all — the page renders a flat layout with header (INV-2026-0042 + Overdue badge), info grid, line items table, status timeline, and AI insight card. The NotesTab, NotesPanel, NoteCard, and AddNoteForm components all exist in `apps/web/src/features/cross-cutting/components/` and are fully unit-tested, but they are not integrated into any record detail page. The page needs to be converted from a static mock to the T2 RecordDetailPage template with tabs.
- **Related Story**: E8.4
- **Suggested Story Title**: Convert invoice detail page from static v0 mock to T2 RecordDetailPage template with cross-cutting tabs (Notes, Attachments, Links)
