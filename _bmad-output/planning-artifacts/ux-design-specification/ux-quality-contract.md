# UX Quality Contract

Every screen in Nexa ERP must pass three categories of quality criteria before it is considered complete. These categories serve as testable objectives for development agents and reviewers.

## 1. Design Consistency

Every screen MUST:
- Use one of the 8 Standardised Screen Templates (T1–T8) — no custom layouts without explicit approval
- Implement the Action Bar System with correct zone placement (Primary Actions, Persistent Tools, Overflow Menu)
- Limit Primary Actions to maximum 2 buttons, driven by current entity status
- Show Attachments and Links as persistent tool buttons with count badges
- Group overflow actions into the 5 standard sections (Document, Status, Record, AI, History)
- Hide inapplicable actions entirely — never grey out
- Use the approved colour system, typography scale, and spacing tokens from the Visual Foundation
- Follow the StatusBadge semantic colour system for all status displays
- Use consistent field grouping within tabs/sections matching the template specifications

## 2. Functional Completeness

Every screen MUST:
- Load all required data and display it in the correct template layout
- Support full CRUD operations appropriate to the entity (create, read, update, delete/archive)
- Show loading states (skeleton screens, not spinners) during data fetch
- Show empty states with clear calls-to-action when no data exists
- Support the AI path ("Told, Shown, Approve, Done") alongside the traditional form path
- Implement inline validation with field-level error messages (not just form-level)
- Handle error states gracefully — API errors show toast + recovery action, not generic messages
- Support keyboard navigation (Tab order, Enter to submit, Escape to cancel)
- Provide Co-Pilot drawer context awareness — the AI knows what screen the user is viewing

## 3. Action Correctness

Every user action MUST produce a defined, testable outcome:

| Action | Expected Outcome |
|--------|-----------------|
| **Save** | Toast "Record saved" (3s), stay on current screen, refresh data |
| **Save & Close** | Toast "Record saved" (3s), navigate to parent list, new/updated record visible in list |
| **Cancel** | If dirty: confirmation dialog "Discard unsaved changes?" → Yes discards, No returns to form. If clean: navigate to parent list |
| **Delete/Archive** | Confirmation dialog with entity name and consequence description → on confirm: toast "Record archived" (3s), navigate to parent list, record removed from default view (visible in "Show archived" filter) |
| **Status Change** | Button shows only valid next transitions (from state machine). On click: confirmation if destructive (e.g., Void), toast "Status changed to X" (3s), UI updates immediately (optimistic), downstream events fire (per event catalog) |
| **Approve** | Toast "Approved" (3s), status badge updates, action bar reconfigures for new status, downstream records created (e.g., GL entries, stock movements) |
| **Reject** | Reason dialog (required), toast "Rejected — returned to [originator]" (3s), status reverts, notification sent to originator |
| **Bulk Action** | Selection count shown in action bar ("3 selected"), bulk action confirmation with count, progress toast for >5 items, summary toast on completion ("3 invoices approved, 1 failed — click to review") |
| **AI Command** | Co-Pilot drawer opens (if closed), streaming response with typing indicator, result presented as pre-filled form or answer card, user approves/dismisses |
| **Attachment Upload** | Progress indicator on Attachments button, toast on completion "File attached" (3s), count badge increments |

## 4. Visual Design Fidelity (Concept D)

Every frontend screen MUST visually match the approved Concept D prototype (`_bmad-output/planning-artifacts/ux-prototypes/concept-d-purple-copilot.html`). Specifically:

- **Cards**: `border-radius: 12px`, shadow `0 1px 3px rgba(0,0,0,0.06)`, hover shadow `0 4px 12px rgba(124,58,237,0.1)`, transition `all 0.2s ease`
- **Buttons**: Primary `#7c3aed` with white text, `border-radius: 8px`, hover `#5b21b6`
- **Inputs**: `border-radius: 6px`, focus border `#7c3aed`, focus ring `#7c3aed`
- **Badges**: Pill shape `border-radius: 99px`, semantic status colours with icon + colour + text (never colour alone)
- **Mega-menu**: 380px slide-from-left overlay, white background, active item `#7c3aed` bg + white text, hover `#f5f3ff`
- **Favourites toolbar**: 40px height, white bg, icon+label chips, overflow chevron
- **Module context bar**: 32px height, `#f4f2ff` bg, pill-shaped category buttons
- **Header**: 56px height, white bg, purple "N" logo mark, centered search, right-side notification + avatar
- **Typography**: Plus Jakarta Sans for headings/navigation (`font-serif` in Tailwind), Inter for body/labels (`font-sans`), JetBrains Mono for amounts/codes (`font-mono`)
- **Page Background**: `#f4f2ff` (not white, not grey)
- **Animations**: fadeInUp (0.4s), slideIn (0.3s), stepIn (0.5s) with staggered delays, `prefers-reduced-motion` respected
- **Co-Pilot drawer**: Purple pulsing left border, AI messages grey, user messages purple, quick prompt chips `#ede9fe`/`#6d28d9`
- **AI chip**: `#ede9fe` bg, `#6d28d9` text, 11px, pill shape, sparkle prefix

**Standard v0 card class pattern:**
```
className="animate-fade-in-up rounded-xl border border-border bg-card p-5
  shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow
  hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
```

**Standard v0 table row class pattern:**
```
className="border-b border-border/60 transition-colors hover:bg-[#f5f3ff]/50"
```

**Verification method:** Open `concept-d-purple-copilot.html` in a browser alongside the running app and compare visually. Stock/generic Shadcn defaults are NOT acceptable — every component must be restyled to match the prototype.

## Epic-Level Page Design Process

This specification provides the foundation design system, templates, components, and interaction patterns. **Module-specific page inventories and detailed per-page designs are produced at Epic level** before implementation begins.

For each Epic, the following process is followed (see CLAUDE.md "Epic Page Approval Gate"):

1. The assistant produces a page inventory listing every screen in the Epic, mapping each to a template (T1–T8) and defining its Action Bar configuration, AI interactions, field groupings, and status-driven behaviour
2. Mohammed reviews and approves the page inventory — adding, removing, or refining pages as needed
3. Only after approval does implementation begin

**Items designed at Epic level include:**
- Per-module screen inventories (which screens, which templates, which fields)
- Module-specific status change UX (valid transitions per entity, confirmation dialogs, cascade effects)
- First-run / setup wizard flows per module
- Role-based briefing content per persona
- Print/PDF layout specifications per document type
- Data import/export wizard configurations per entity type
- Module-specific keyboard shortcuts beyond the global set
- Module-specific error pages and recovery flows

This process ensures every screen gets genuine design thinking grounded in the actual Epic's business requirements, rather than speculative bulk design.

---
