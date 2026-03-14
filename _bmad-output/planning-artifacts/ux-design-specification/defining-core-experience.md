# Defining Core Experience

## The Defining Interaction

**Nexa's "Tinder moment":** *"Tell the AI what you need, review what it prepared, approve it."*

Where Tinder is "swipe to match" and Instagram is "share perfect moments with filters," Nexa is **"speak your intent, approve the result."** Users will describe Nexa to colleagues as: *"I just tell it what I need and it does it — I only check that it's right."*

This interaction is novel in the ERP world. No competitor offers it. The closest analogy is voice banking ("transfer £500 to savings") but Nexa handles far more complex multi-field, multi-line business documents. The novelty requires careful trust-building but offers enormous differentiation.

## User Mental Model

**Current mental model (legacy ERP):** "I navigate to the right screen, fill in every field, and hit Save." Users think in terms of *screens*, *fields*, and *menus*. They've learned which screens to use for which tasks over months of training. They expect complexity.

**Nexa's target mental model:** "I tell the system what I need, it prepares it, I check and approve." Users think in terms of *intent*, *review*, and *decision*. They don't need to know which module handles what — they describe the business outcome.

**Bridging the gap:**
- Legacy users will instinctively reach for traditional forms — the form path must always be available and clearly signposted ("Switch to manual entry" button on every AI-prepared record)
- New users will start with AI and may never learn the form path — that's fine, the AI path is the primary path
- The transition moment: when a legacy user first says "create an invoice for Acme" and gets a correct, pre-filled invoice back in 3 seconds — this is when the mental model shifts
- **Workaround preservation:** Legacy users have developed muscle memory (keyboard shortcuts, favourite screens). Nexa preserves this through keyboard shortcuts (Cmd+K for AI, Cmd+N for new record, Cmd+S for save) and saved views (pinned to favourites toolbar)

## Success Criteria

The defining experience succeeds when:

| Criteria | Metric | Measurement |
|----------|--------|-------------|
| **Speed** | AI-prepared record appears in <3 seconds | Time from intent submission to rendered form |
| **Accuracy** | >=90% of fields correct for known customers | Percentage of fields requiring no manual correction |
| **Trust** | Users approve without changing green fields | Percentage of high-confidence fields left unchanged |
| **Adoption** | 70% of records created via AI path by month 3 | Ratio of AI-created vs. manually-created records |
| **Delight** | NPS >50 within first quarter | Post-task survey after AI record creation |
| **Recovery** | <10 seconds to fix any incorrect field | Time from spotting error to correcting it |
| **Fallback** | Form path accessible in 1 click | Number of clicks to switch from AI to manual |

## Novel UX Patterns

Nexa introduces three novel patterns not found in any competing ERP:

**1. Confidence-Scored Form Fields**
Every AI-filled field shows a confidence indicator: green dot (>=90%, auto-suggested), amber dot (70–89%, review recommended), red dot (<70%, manual entry needed). This is borrowed from medical AI and document extraction UIs but has never been applied to ERP forms. Users learn to trust green fields quickly, focus review time on amber fields, and type only into red fields.

**2. The Briefing as Home Screen**
Instead of a dashboard, users land on a personalised, AI-curated briefing — a prioritised list of business items requiring attention, each with context and a one-tap action. This replaces the "check 15 screens" morning routine with a single, intelligent view. The briefing adapts to the user's role, time of day, and business state.

**3. Cross-Module Event Flow Tracker**
A horizontal process visualisation showing the full lifecycle of a business transaction (Quote → Order → Dispatch → Invoice → Payment) with real-time status updates as downstream entities are created. Users can see where any transaction sits in the entire business process without navigating between modules. No ERP shows this.

## Experience Mechanics

**1. Initiation — How Users Start:**

| Entry Point | Trigger | Context |
|-------------|---------|---------|
| AI Command Input | User types or speaks intent | Always visible in header bar (Cmd+K to focus) |
| Briefing Action | User taps action on briefing item | Briefing home screen, one-tap |
| Quick Action Button | User clicks "+ New" in any entity list | Module context provides entity type |
| Document Upload | User drags/uploads a file | AI auto-detects document type |
| Contextual Action | User clicks action from a related record | Cross-module link (e.g., "Create Invoice" from Sales Order) |

**2. Interaction — What Happens:**

```
User Input → AI Processing (streaming) → Form Render with Confidence Scores
                                              │
                                    ┌─────────┼─────────┐
                                    │         │         │
                              Green Fields  Amber Fields  Red Fields
                              (auto-filled) (review)    (manual)
                                    │         │         │
                                    └─────────┼─────────┘
                                              │
                                     User Reviews & Edits
                                              │
                                     Approve / Save Draft
                                              │
                                   Record Committed + Events Fire
```

- AI processing streams via SSE — user sees fields filling progressively (200ms stagger between fields)
- Form renders in standard layout (same layout as manual entry) with confidence indicators overlaid
- User can click any field to edit, regardless of confidence level
- "AI suggested because..." tooltip available on hover/tap for any AI-filled field
- Approve button is primary action (purple, prominent); Save Draft is secondary; Cancel is tertiary

**3. Feedback — How Users Know It's Working:**

- **During AI processing:** Pulsing purple animation on the AI input area, streaming field population
- **Field confidence:** Colour-coded dots with counts ("12 confident, 3 to review, 1 manual")
- **Validation:** Inline field validation appears immediately on edit (green checkmark or red error with message)
- **Approval:** Smooth status transition animation (Draft → Posted), success toast with link to created record
- **Error:** Amber inline banner with specific error and suggested fix (never a generic "something went wrong")

**4. Completion — What Happens After:**

- Record status changes (visible via `<StatusBadge>` animation)
- Downstream events fire: stock reserved, GL entries posted, notification sent to relevant users
- Success toast: "Invoice INV-2026-0047 created for Acme Ltd — £4,250.00" with "View" link
- Briefing updates (if applicable): item marked as completed or removed
- User returns to their previous context (list view, briefing, or related record)
