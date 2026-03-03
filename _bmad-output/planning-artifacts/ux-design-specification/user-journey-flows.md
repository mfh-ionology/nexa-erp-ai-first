# User Journey Flows

## Journey 1: Morning Briefing (Sarah — Business Owner, Phone)

**Trigger:** Sarah opens Nexa app at 7:15am on her phone during commute.

```mermaid
flowchart TD
    A[Open App] --> B[Personalised Briefing Loads]
    B --> C{Review Priority Items}
    C --> D[3 Overdue Invoices - £12,400]
    C --> E[2 POs Awaiting Approval]
    C --> F[Revenue ↑12% vs Last Month]
    C --> G[1 Leave Request Pending]
    D --> H{Tap: Chase Overdue}
    H --> I[AI Drafts Chase Email]
    I --> J{Review & Send?}
    J -->|Approve| K[Email Sent ✓]
    J -->|Edit| L[Modify Email → Send]
    E --> M{Tap: Review PO}
    M --> N[PO Detail with Context]
    N --> O{Approve / Reject?}
    O -->|Approve| P[PO Approved ✓]
    O -->|Reject| Q[Add Reason → Rejected]
    K --> R[Item Fades from Briefing]
    P --> R
    R --> S{More Items?}
    S -->|Yes| C
    S -->|No| T[Briefing Complete ✓]
```

**Duration target:** 15 minutes for full briefing review (replaces 2-hour desktop session).

## Journey 2: AI Invoice Creation (David — Finance Manager, Desktop)

**Trigger:** David needs to invoice Acme Ltd for March widget delivery.

```mermaid
flowchart TD
    A[Cmd+K or Click AI Input] --> B[Type: 'Invoice Acme for March widgets']
    B --> C[AI Processes Intent - 2s]
    C --> D[Invoice Form Renders with Confidence Scores]
    D --> E{Review Fields}
    E --> F[12 Green Fields ≥90%]
    E --> G[2 Amber Fields 70-89%]
    E --> H[1 Red Field <70%]
    F --> I[Skip - Trust AI]
    G --> J[Review: Delivery Date, Payment Terms]
    J --> K{Correct?}
    K -->|Yes| L[Leave as-is]
    K -->|No| M[Edit Field Manually]
    H --> N[Enter: PO Reference Number]
    I --> O[All Fields Reviewed]
    L --> O
    M --> O
    N --> O
    O --> P{Click Approve}
    P --> Q[Invoice Created - INV-2026-0047]
    Q --> R[GL Entries Posted]
    Q --> S[Customer Notified]
    Q --> T[Success Toast with Link]
    T --> U[Return to Invoice List]
```

**Duration target:** <60 seconds from intent to approved invoice.

## Journey 3: Document Upload & Extraction (David — Supplier Invoice)

**Trigger:** David receives a supplier invoice PDF by email.

```mermaid
flowchart TD
    A[Drag PDF to Upload Zone] --> B[AI Detects: Supplier Invoice]
    B --> C[Side-by-Side View Renders]
    C --> D[Left: Original PDF with Bounding Boxes]
    C --> E[Right: Extracted Form with Confidence]
    E --> F{Review Extraction}
    F --> G[Vendor: Matched to Supplier Record ✓]
    F --> H[Line Items: 5 of 5 Extracted ✓]
    F --> I[Amounts: VAT Calculated ✓]
    F --> J[PO Match: PO-2026-0089 Found ✓]
    J --> K{PO Match Correct?}
    K -->|Yes| L[Quantities & Prices Match ✓]
    K -->|No| M[Select Correct PO]
    L --> N{Approve Purchase Invoice?}
    N -->|Approve| O[PI Created + GL Posted]
    N -->|Save Draft| P[Saved for Later Review]
    O --> Q[Moved to AP Aging]
```

**Duration target:** <3 minutes from upload to approved PI (replaces 45 min manual entry).

## Journey 4: Month-End Close (David — Finance Manager)

**Trigger:** Last working day of the month; David opens Month-End checklist.

```mermaid
flowchart TD
    A[Open Month-End Close] --> B[AI-Generated Checklist Loads]
    B --> C[Step 1: Bank Reconciliation]
    C --> D[AI Pre-Matched 47/50 Transactions]
    D --> E{Batch Approve Matched?}
    E -->|Approve 47| F[47 Matched ✓]
    F --> G[Handle 3 Exceptions Manually]
    G --> H[Step 1 Complete ✓ - Progress: 1/8]
    H --> I[Step 2: Review Accruals]
    I --> J[AI Suggests 3 Accrual Journals]
    J --> K{Review & Approve?}
    K -->|Approve| L[Journals Posted ✓]
    L --> M[Step 2 Complete ✓ - Progress: 2/8]
    M --> N[Steps 3-7: Depreciation, Prepayments, etc.]
    N --> O[Step 8: Generate Trial Balance]
    O --> P[AI Highlights Variances vs Last Month]
    P --> Q{Period Close?}
    Q -->|Close| R[Period Locked ✓]
    R --> S[Month-End Complete - Summary Report]
```

**Duration target:** 1 day (replaces 3-day manual process).

## Journey 5: CRM Pipeline to Invoice (Priya — Sales Manager)

**Trigger:** Priya moves a deal to "Won" in the CRM pipeline.

```mermaid
flowchart TD
    A[Drag Deal to 'Won' Column] --> B[Deal Status: Won ✓]
    B --> C{Create Sales Order?}
    C -->|Yes| D[AI Pre-fills SO from Deal Data]
    D --> E[Customer, Products, Quantities, Terms]
    E --> F{Review & Approve SO?}
    F -->|Approve| G[SO Created - Inventory Reserved]
    G --> H[EventFlowTracker: Deal → SO → ...]
    H --> I{Dispatch Ready?}
    I -->|Yes| J[Create Delivery Note]
    J --> K[Warehouse Notified]
    K --> L{Delivered?}
    L -->|Yes| M[Create Invoice from SO]
    M --> N[AI Pre-fills Invoice from SO + DN]
    N --> O{Approve Invoice?}
    O -->|Approve| P[Invoice Sent to Customer]
    P --> Q[EventFlowTracker: Deal → SO → DN → INV → ...]
```

## Journey 6: Access Group Management (Tom — System Administrator, Desktop)

**Trigger:** Tom needs to set up permissions for a new Sales Clerk user who should create and view sales orders but not delete them, and should not see cost price fields.

```mermaid
flowchart TD
    A[Navigate: System > Access Groups] --> B[Access Group List Loads]
    B --> C{Existing Group Fits?}
    C -->|Yes: Sales Staff| D[Open Sales Staff Group]
    C -->|No| E[Click + New Access Group]
    E --> F[Enter: Code, Name, Description]
    F --> G[Permission Matrix Grid Loads]
    D --> G
    G --> H[Rows: Resources grouped by module]
    G --> I[Columns: canAccess, canNew, canView, canEdit, canDelete]
    H --> J{Set Permissions via Checkboxes}
    J --> K[Sales Orders: Access ✓, New ✓, View ✓, Edit ✓, Delete ✗]
    J --> L[GL Journals: All ✗ - Hidden from Navigation]
    J --> M[Customers: Access ✓, View ✓, Edit ✗, Delete ✗]
    K --> N{Configure Field Overrides?}
    N -->|Yes| O[Open Field Overrides Panel]
    O --> P[Sales Order Detail: costPrice → HIDDEN]
    O --> Q[Sales Order Detail: margin → HIDDEN]
    P --> R[Save Access Group]
    Q --> R
    N -->|No| R
    R --> S[Navigate: System > Users]
    S --> T[Open New User Record]
    T --> U{Assign Access Groups}
    U --> V[Select: Sales Staff Group]
    V --> W[Save User]
    W --> X[user.accessGroups.assigned Event Fires]
    X --> Y[Permission Cache Invalidated]
    Y --> Z[User Sees Sales-Only Navigation on Next Login]
```

**Duration target:** <5 minutes for assigning an existing access group to a user; <15 minutes for creating a new custom access group with field overrides.

**Key UX details:**
- The permission matrix is a grid of checkboxes — admins can scan an entire group's permissions at a glance
- Resources are grouped by module with collapsible sections for efficient browsing
- Pre-built access groups (Sales Staff, Finance Clerk, etc.) are available immediately after company creation from the default data import
- Cloning an existing group is available via the overflow menu, allowing quick creation of variants

## Journey Patterns

**Common patterns across all journeys:**

1. **AI-Prepare-Review-Approve** — Every creation journey follows: express intent → AI prepares → review with confidence indicators → approve. This is the universal pattern.

2. **Progressive Status Tracking** — Each entity created updates the `<EventFlowTracker>` on related entities. Users always see where they are in the cross-module flow.

3. **Batch Processing** — Where multiple items need the same action (approve, match, chase), batch operations are available. Individual exception handling follows.

4. **One-Tap Actions** — Briefing items, notifications, and approval requests all support one-tap action (approve, reject, view, chase) without navigating to a detail page first.

5. **Contextual Creation** — Records are often created from the context of a parent record (Invoice from SO, PI from PO, Journal from checklist), and the AI uses that context to pre-fill with higher confidence.

## Flow Optimisation Principles

1. **Zero-Navigation Principle** — If an action can be completed without leaving the current view, it should be. Inline approval, inline status change, inline chase email.

2. **Progressive Commitment** — Start with the simplest action (one-tap approve), escalate only when needed (edit a field, add a note, reject with reason). Don't front-load complexity.

3. **Context Preservation** — After completing an action, return the user to their previous context. Don't dump them on a generic home screen. If they were in the briefing, return to the briefing. If they were in a list, return to the list with the updated item.

4. **Error Prevention over Error Handling** — AI confidence scoring, inline validation, and smart defaults prevent errors before they happen. When errors do occur, the fix is inline (not a separate error page) with a suggested resolution.
