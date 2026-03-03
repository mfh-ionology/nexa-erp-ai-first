# Journey 7: Create a General Note — Visual Checkpoints

## Checkpoint 1: Invoice Detail Page Loaded
- **When**: After step 1 — navigation to `/ar/invoices/{invoiceId}`
- **Screenshot file**: `step-1-invoice-detail-loaded.png`
- **What to look for**: Invoice detail page rendered with header showing "INV-2026-0042", status badge, info grid, and line items. This confirms the base page loaded before attempting to interact with Notes tab.

## Checkpoint 2: Notes Tab Panel Visible
- **When**: After step 2 — clicking the Notes tab
- **Screenshot file**: `step-2-notes-tab-active.png`
- **What to look for**: Notes tab should be selected/active. NotesPanel renders as tab content showing either empty state (if no notes yet) or existing notes in a timeline. An "Add Note" button should be visible at the top of the panel.

## Checkpoint 3: Add Note Form Expanded
- **When**: After step 3 — clicking the Add Note button
- **Screenshot file**: `step-3-add-note-form-expanded.png`
- **What to look for**: AddNoteForm expanded showing: textarea input field (min 80px height), note type selector dropdown (defaulting to "General"), and submit/cancel buttons. The type selector should NOT include "SYSTEM" as an option.

## Checkpoint 4: Note Form Filled and Ready to Submit
- **When**: After step 5 — filling the note form with content and selecting GENERAL type
- **Screenshot file**: `step-5-note-form-filled.png`
- **What to look for**: Textarea contains the test note text "Initial review completed. All line items verified against purchase order PO-2026-0015." Note type is set to "General" (default). The "Add Note" submit button should be enabled (not disabled/greyed out).

## Checkpoint 5: Note Created — Timeline Updated
- **When**: After step 7 — verifying the new note appears in the timeline
- **Screenshot file**: `step-7-note-in-timeline.png`
- **What to look for**: New note card at top of timeline with: grey "General" type badge, current user name as author, "just now" relative timestamp, full note content text visible, timeline connector line on the left side, overflow menu (three dots) for edit/pin actions.
