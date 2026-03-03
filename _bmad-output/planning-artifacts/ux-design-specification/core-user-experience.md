# Core User Experience

## Defining Experience

The **core interaction loop** for every Nexa user is **"Told, Shown, Approve, Done"**:

1. **Told** — The user states intent in natural language: *"Create an invoice for Acme Ltd for the March widget order"*
2. **Shown** — The AI pre-fills the complete record using business context (customer terms, order history, default VAT rates, seasonal pricing) and presents it in the standard form layout with confidence indicators on each field
3. **Approve** — The user reviews, adjusts any flagged fields, and taps Approve
4. **Done** — The record is committed, downstream events fire (stock reserved, GL entries posted, notification sent), and the user sees confirmation with a link to the created entity

This loop applies universally: invoices, purchase orders, journal entries, leave requests, production orders, customer records, and every other entity. The AI path and the traditional form path produce identical records through the same API — the difference is who fills in the fields.

**The single most frequent action** is reviewing and approving AI-prepared records. Users spend more time *validating* than *typing*. This inverts the traditional ERP time profile from 80% data entry / 20% review to 20% intent expression / 80% business decision-making.

**Secondary core actions** (in frequency order):
- Morning briefing review with one-tap actions (daily, all personas)
- List browsing with AI-powered filtering and saved views (hourly, all personas)
- Document upload and AI extraction review (daily, Finance/AP)
- Batch approval of matched transactions (daily, Finance)
- Status checking across cross-module flows (hourly, Sales/Warehouse)

## Platform Strategy

| Dimension | Decision | Rationale |
|-----------|----------|-----------|
| **Primary platform** | Web SPA (responsive) | UK SME users on varied devices; no app store friction |
| **Desktop** (1024px+) | Full experience: sidebar nav, split panels, AI dock | David, Priya, Fatima, Tom, Claire — primary work device |
| **Tablet** (768–1023px) | Touch-optimised: collapsible sidebar, larger touch targets (48x48px), barcode scanning | Marcus in warehouse — needs one-handed operation |
| **Phone** (375–767px) | Briefing-first: AI briefing as home, stacked layouts, bottom tab nav, swipe gestures | Sarah on commute — review and approve, not create |
| **Offline** | Not required for MVP | SaaS model, always-connected UK SME offices |
| **Framework** | React 19 + Vite 6 + Tailwind CSS 4 + Shadcn UI | Architecture decision — component library with Radix primitives |
| **Real-time** | Server-Sent Events (SSE) per tenant | Status changes, notifications, collaborative awareness |
| **AI integration** | Claude API via backend proxy | No direct client-to-AI calls; streaming responses via SSE |

**Breakpoint system:**
- `sm`: 375px — Phone (portrait)
- `md`: 768px — Tablet / Phone (landscape)
- `lg`: 1024px — Small desktop / Tablet (landscape)
- `xl`: 1280px — Desktop
- `2xl`: 1536px — Large desktop

**Touch target minimums:** 44x44px on phone, 48x48px on tablet (exceeds WCAG 2.5.8 minimum of 24x24px).

## Permission-Driven UI Behaviour (Access Groups)

Nexa uses a **granular Access Group system** (Epic E2b) to control what each user can see and do. The fixed 5-level role hierarchy (`SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER`) no longer drives page or action permissions -- those are driven by access groups. Users are assigned 1+ access groups per company, and the most permissive setting wins when groups conflict.

The UI adapts dynamically based on the user's resolved permissions:

### Navigation Filtering

The sidebar navigation is built from the **Resource table**, filtered by the current user's resolved permissions. Only resources where the user has `canAccess: true` (across any of their assigned access groups) appear in the navigation tree. Modules with zero accessible resources are hidden entirely. This means:

- Two users with different access groups see different sidebar menus
- A "Sales Staff" user sees Sales Orders, Quotes, and Customers -- but not GL Journals or Payroll
- Adding a new access group to a user immediately updates their navigation (after cache refresh, TTL 60s)
- `SUPER_ADMIN` users see all resources regardless of access group assignment

### Action Button Visibility

Each page's action buttons (New, Edit, Delete) are shown or hidden based on the permission flags from `AccessGroupPermission`:

| Permission Flag | UI Effect |
|-----------------|-----------|
| `canAccess: true` | Page appears in navigation; user can open the page |
| `canNew: false` | `[+ New]` button is hidden on the entity list (T1) |
| `canEdit: false` | `[Save]` and `[Edit]` buttons are hidden on detail views (T2, T3); form renders read-only |
| `canDelete: false` | `[Delete]` option is hidden from the overflow menu (T2, T3) |
| `canView: false` | Row click on list view is disabled; record cannot be opened |

This combines with status-driven visibility (Action Bar Rule 1): an action must be both permitted by the state machine AND permitted by the user's access groups. If either denies it, the action is hidden.

### Field-Level Visibility

The `AccessGroupFieldOverride` table provides per-field, per-resource, per-group visibility control with three states:

| Visibility | UI Effect |
|------------|-----------|
| `VISIBLE` (default) | Field renders normally -- editable in edit mode, visible in read mode |
| `READ_ONLY` | Field renders with a lock icon and grey background; value is displayed but cannot be edited. The API response includes `_fieldMeta: { fieldPath: "readOnly" }` |
| `HIDDEN` | Field is completely removed from the form layout. The API strips the field from the response JSON. The user has no awareness that the field exists |

Example: A "Sales Staff" access group hides `costPrice` and `margin` fields on the Sales Order detail page, preventing sales users from seeing cost information.

### Admin UI for Access Groups

The access group management screen (System > Access Groups) uses a **permission matrix grid**: rows are resources (grouped by module), columns are action flags (`canAccess`, `canNew`, `canView`, `canEdit`, `canDelete`), and cells are checkboxes. This gives administrators a clear, spreadsheet-like view of what each group can do. Field overrides are managed in a secondary panel per resource, listing field paths with a `VISIBLE / READ_ONLY / HIDDEN` dropdown for each.

Pre-built access groups (Full Access, Sales Manager, Finance Clerk, etc.) ship with sensible defaults via the default data file and are marked as `isSystem: true` -- they cannot be deleted but can be modified and cloned.

## Effortless Interactions

These interactions must feel **zero-effort** — the user's cognitive load should be near zero:

1. **Morning Briefing** — User opens Nexa, sees a personalised briefing driven by their access group permissions. Only items for resources the user can access appear in the briefing. No navigation, no clicking through to dashboards. Sarah sees "3 overdue invoices (£12,400), 2 POs awaiting approval, revenue ↑12% vs last month" with one-tap actions for each item. A warehouse user would not see invoice or PO items -- only stock and dispatch items relevant to their access groups.

2. **AI Record Creation** — User types natural language intent, AI returns a fully-formed record. The user's job is to review green-highlighted confident fields (>=90%), inspect amber fields (70–89%), and fill only red fields (<70%). For a returning customer's standard order, this means reviewing a complete invoice with zero manual field entry.

3. **Document Understanding** — User uploads/photographs/emails a supplier invoice. AI extracts vendor, line items, amounts, dates, VAT. Matches to existing PO. Presents side-by-side: original document (with bounding boxes) on left, extracted form on right. One-click approve if all fields are green.

4. **Batch Operations** — Bank feed matching: AI matches 47/50 transactions, user reviews batch, taps "Approve All Matched", manually handles 3 exceptions. Same pattern for payroll review, month-end journal batches, and bulk status updates.

5. **Cross-Module Navigation** — From an invoice, one click to the originating sales order, the customer record, the delivery note, the GL entries, or the payment. No module switching, no re-searching. The `<EventFlowTracker>` component shows the full lifecycle horizontally.

6. **Saved Views** — User asks AI "show me overdue invoices over £1,000 sorted by amount" and gets a filtered, sorted list instantly. Save it as a named view. Star it as a favourite. It appears in their sidebar navigation.

## Critical Success Moments

These are the make-or-break moments that determine whether Nexa succeeds or fails:

| Moment | Persona | What Must Happen | Failure Mode |
|--------|---------|------------------|--------------|
| **First Briefing** | New User | Within 5 minutes of first login, user sees a personalised briefing with real data and thinks "this knows my business" | Generic/empty dashboard, no sense of intelligence |
| **First AI Invoice** | David | User says "invoice Acme for March widgets", gets back a complete invoice with correct terms, VAT, line items — reviews and approves in under 60 seconds | Wrong customer terms, missing line items, requires >50% manual correction |
| **First Document Upload** | David | User uploads a supplier PDF, sees extracted data appear field-by-field with confidence indicators, matches to PO automatically | Extraction fails, no PO match, user must re-type everything |
| **Morning Routine** | Sarah | 15-minute phone review replaces 2-hour desktop slog. Every briefing item has a one-tap action. Period comparisons show business trajectory. | Briefing is just a notification list, no actions, no comparisons |
| **Month-End Close** | David | AI-prepared checklist with pre-matched bank feeds, suggested accruals, and batch approval. 3-day process becomes 1 day. | Still requires manual matching, no checklist, same 3 days |
| **Stock Check** | Marcus | Scan barcode on tablet, see real-time stock across all locations, with incoming PO and allocated SO quantities. Under 3 seconds. | Slow response, stale data, no cross-location visibility |
| **System Setup** | Tom | Initial company setup wizard: 10 guided steps, AI suggests chart of accounts from industry template, imports opening balances. Under 2 hours. | 50-page manual, 3-day setup, requires consultant |

## Experience Principles

Five principles that guide every UX decision in Nexa ERP:

1. **AI Prepares, Human Decides** — The AI's job is to eliminate data entry, not decision-making. Every AI action produces a reviewable proposal, never a committed fact. Financial actions NEVER execute without explicit user approval (NFR16). The user is always the authority; the AI is always the assistant.

2. **Show the Delta, Not the Number** — Every metric, KPI, and status must show change over time: vs. last period, vs. budget, vs. target. "Revenue £142K" is meaningless; "Revenue £142K ↑12% vs last month" tells a story. This applies to the briefing, dashboards, report summaries, and inline entity metrics.

3. **One Entity, Full Context** — When a user is looking at any record, they can see its full lifecycle (order → dispatch → invoice → payment), its related entities (customer, items, GL entries), and its current status — without navigating away. Cross-module awareness is built into every detail view through the `<EventFlowTracker>` and related-entity panels.

4. **Progressive Disclosure, Never Hiding** — Complex forms (313-field customer, 280-field invoice) use tabbed layouts with the most-used fields on the primary tab and specialised fields on secondary tabs. Nothing is hidden or removed — power users can always reach every field. The AI path shows only the fields that matter for this specific record; the form path shows the full layout. Both are always one click apart.

5. **Consistent Status Language** — All 37 entity state machines use the same 9 semantic categories (Initial → InProgress → AwaitingAction → Success → Partial → Cancelled → Error → Warning → Terminal) with consistent colours, icons, and animations. A user who understands invoice status immediately understands PO status, leave request status, and production order status. The `<StatusBadge>` component is the single source of truth.
